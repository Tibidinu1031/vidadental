import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker, {toUtc, timesFor, validDate, validateBooking, deliverJobs} from '../backend/worker.mjs';
const NOW = Date.parse('2026-10-23T07:00:00Z');
function fixture() {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../backend/schema.sql', import.meta.url), 'utf8'));
  const wrap = (sql, values = []) => ({
    sql, values,
    bind(...args) {return wrap(sql, args);},
    async first() {return db.prepare(sql).get(...values) || null;},
    async all() {return {results: db.prepare(sql).all(...values)};},
    async run() {return {meta: db.prepare(sql).run(...values)};}
  });
  const DB = {prepare: sql => wrap(sql), async batch(statements) {db.exec('BEGIN'); try {const results = statements.map(statement => db.prepare(statement.sql).run(...statement.values)); db.exec('COMMIT'); return results;} catch (error) {db.exec('ROLLBACK'); throw error;}}};
  const env = {DB, ADMIN_TOKEN: 'test-token-with-more-than-thirty-two-characters', RESEND_API_KEY: 'test-only', RATE_SALT: 'test-only-salt', MAIL_FROM: 'Vidadental <programari@example.com>', CLINIC_EMAIL: 'receptie@example.com', ALLOWED_ORIGINS: 'https://clinic.example'};
  const emails = []; const tasks = [];
  const ctx = {waitUntil(task) {tasks.push(task);}};
  const sender = async (url, options) => {emails.push({key: options.headers['Idempotency-Key'], ...JSON.parse(options.body)}); return Response.json({id: 'test-mail'});};
  const booking = {name: 'Pacient Test', phone: '0712345678', email: 'pacient@example.com', service: 'Consultație', date: '2026-10-26', time: '13:00', reminder: true, consent: true, requestId: crypto.randomUUID()};
  async function call(path, method = 'GET', body, admin = false, origin = 'https://clinic.example') {
    return worker.fetch(new Request('https://api.example' + path, {method, headers: {'Origin': origin, ...(body ? {'Content-Type': 'application/json'} : {}), ...(admin ? {Authorization: 'Bearer ' + env.ADMIN_TOKEN} : {})}, ...(body ? {body: JSON.stringify(body)} : {})}), env, ctx);
  }
  return {db, env, emails, sender, booking, call, async drain() {while (tasks.length) await Promise.all(tasks.splice(0));}};
}
test('Bucharest appointments preserve local time through daylight-saving changes', () => {
  assert.equal(new Date(toUtc('2026-10-23', '13:00')).toISOString(), '2026-10-23T10:00:00.000Z');
  assert.equal(new Date(toUtc('2026-10-26', '13:00')).toISOString(), '2026-10-26T11:00:00.000Z');
  assert.equal(new Date(toUtc('2027-03-29', '09:00')).toISOString(), '2027-03-29T06:00:00.000Z');
});
test('validation rejects invalid dates, closed days, short notice and missing consent', () => {
  const f = fixture();
  assert.ok(validateBooking(f.booking, NOW));
  assert.equal(validDate('2026-02-30'), false);
  assert.deepEqual(timesFor('2026-10-24', NOW), []);
  for (const data of [{...f.booking, consent: false}, {...f.booking, date: '2026-10-24'}, {...f.booking, email: 'invalid'}, {...f.booking, requestId: 'invalid'}, {...f.booking, website: 'spam'}, {...f.booking, date: '2026-10-23', time: '09:00'}]) assert.equal(validateBooking(data, NOW), false);
  f.db.close();
});
test('appointment API, conflicts, authorization, confirmation and reminder lifecycle', async t => {
  const f = fixture(), originalNow = Date.now, originalFetch = globalThis.fetch;
  Date.now = () => NOW; globalThis.fetch = f.sender;
  t.after(() => {Date.now = originalNow; globalThis.fetch = originalFetch; f.db.close();});
  const first = await f.call('/appointments', 'POST', f.booking); assert.equal(first.status, 201); const {id} = await first.json(); await f.drain();
  assert.equal(f.emails.length, 1); assert.deepEqual(f.emails[0].to, ['receptie@example.com']);
  const repeat = await f.call('/appointments', 'POST', f.booking); assert.equal((await repeat.json()).id, id);
  const conflict = await f.call('/appointments', 'POST', {...f.booking, requestId: crypto.randomUUID()}); assert.equal(conflict.status, 409);
  const available = await (await f.call('/slots?date=2026-10-26')).json(); assert.ok(!available.slots.includes('13:00'));
  assert.equal((await f.call('/admin/appointments')).status, 401);
  assert.equal((await f.call('/appointments', 'POST', f.booking, false, 'https://evil.example')).status, 403);
  assert.equal((await f.call('/admin/appointments/' + id, 'PATCH', {status: 'confirmed'}, true)).status, 200); await f.drain();
  assert.equal(f.emails.length, 2); assert.deepEqual(f.emails[1].to, ['pacient@example.com']);
  const reminder = f.db.prepare("SELECT * FROM mail_jobs WHERE kind='reminder'").get();
  assert.equal(reminder.due_at, toUtc(f.booking.date, f.booking.time) - 24 * 3600_000);
  assert.equal(await deliverJobs(f.env, reminder.due_at - 1, f.sender), 0);
  assert.equal(await deliverJobs(f.env, reminder.due_at, f.sender), 1);
  assert.equal(await deliverJobs(f.env, reminder.due_at + 15 * 60_000, f.sender), 0);
  assert.equal(f.emails.length, 3); assert.match(f.emails[2].text, /ora 13:00/);
});
test('cancellation suppresses pending reminders and releases the slot', async t => {
  const f = fixture(), originalNow = Date.now, originalFetch = globalThis.fetch;
  Date.now = () => NOW; globalThis.fetch = f.sender;
  t.after(() => {Date.now = originalNow; globalThis.fetch = originalFetch; f.db.close();});
  const {id} = await (await f.call('/appointments', 'POST', f.booking)).json(); await f.drain();
  await f.call('/admin/appointments/' + id, 'PATCH', {status: 'confirmed'}, true); await f.drain();
  await f.call('/admin/appointments/' + id, 'PATCH', {status: 'cancelled'}, true); await f.drain();
  const before = f.emails.length;
  await deliverJobs(f.env, toUtc(f.booking.date, f.booking.time) - 23 * 3600_000, f.sender);
  assert.equal(f.emails.length, before);
  const available = await (await f.call('/slots?date=2026-10-26')).json(); assert.ok(available.slots.includes('13:00'));
});
test('failed email remains queued, retries with the same idempotency key', async t => {
  const f = fixture(), originalNow = Date.now, originalFetch = globalThis.fetch;
  Date.now = () => NOW; globalThis.fetch = async () => new Response('', {status: 503});
  t.after(() => {Date.now = originalNow; globalThis.fetch = originalFetch; f.db.close();});
  const response = await f.call('/appointments', 'POST', f.booking); assert.equal(response.status, 201); await f.drain();
  const job = f.db.prepare('SELECT * FROM mail_jobs').get(); assert.equal(job.sent_at, null); assert.equal(job.attempts, 1);
  assert.equal(await deliverJobs(f.env, NOW + 15 * 60_000, f.sender), 1); assert.equal(f.emails[0].key, job.id);
});
test('closed dates reject new bookings, and expired requests release their slots', async t => {
  const f = fixture(), originalNow = Date.now, originalFetch = globalThis.fetch;
  Date.now = () => NOW; globalThis.fetch = f.sender;
  t.after(() => {Date.now = originalNow; globalThis.fetch = originalFetch; f.db.close();});
  await f.call('/admin/closures', 'POST', {date: f.booking.date}, true);
  assert.deepEqual((await (await f.call('/slots?date=' + f.booking.date)).json()).slots, []);
  assert.equal((await f.call('/appointments', 'POST', f.booking)).status, 409);
  await f.call('/admin/closures', 'DELETE', {date: f.booking.date}, true);
  await f.call('/appointments', 'POST', f.booking); await f.drain();
  Date.now = () => NOW + 49 * 3600_000;
  assert.ok((await (await f.call('/slots?date=' + f.booking.date)).json()).slots.includes('13:00'));
  assert.equal(f.db.prepare('SELECT status FROM appointments').get().status, 'expired');
});

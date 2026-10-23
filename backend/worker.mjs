const HOUR = 3600_000;
const DAY = 24 * HOUR;
const SERVICES = new Set(['Consultație', 'Implantologie', 'Estetică dentară', 'Ortodonție', 'Endodonție / chirurgie', 'Stomatologie copii', 'Igienizare & profilaxie']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function localDay(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now);
}
export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date;
}
export function toUtc(date, time) {
  const target = Date.parse(`${date}T${time}:00Z`);
  let candidate = target;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(candidate).map(part => [part.type, part.value]));
    const shown = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
    candidate += target - shown;
  }
  return candidate;
}
export function timesFor(date, now = Date.now()) {
  if (!validDate(date)) return [];
  const day = new Date(date + 'T12:00:00Z').getUTCDay();
  const times = [2, 5].includes(day) ? ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'] : [1, 3, 4].includes(day) ? ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] : [];
  return times.filter(time => toUtc(date, time) > now + 2 * HOUR && toUtc(date, time) <= now + 90 * DAY);
}
export function validateBooking(data, now = Date.now()) {
  if (!data || data.website || data.consent !== true || !UUID.test(data.requestId || '')) return false;
  if (typeof data.name !== 'string' || data.name.trim().length < 2 || data.name.length > 80 || /[\r\n\x00-\x1f]/.test(data.name)) return false;
  if (typeof data.phone !== 'string' || !/^[+()\d\s.-]{9,24}$/.test(data.phone) || data.phone.replace(/\D/g, '').length < 9) return false;
  if (typeof data.email !== 'string' || data.email.length > 120 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email)) return false;
  return SERVICES.has(data.service) && validDate(data.date) && timesFor(data.date, now).includes(data.time);
}
const stmt = (env, sql, ...values) => env.DB.prepare(sql).bind(...values);
function json(body, status = 200) {return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});}
async function authenticate(request, env) {
  const value = request.headers.get('Authorization') || '';
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32 || !value.startsWith('Bearer ')) return false;
  const digest = async input => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
  const [a, b] = await Promise.all([digest(value.slice(7)), digest(env.ADMIN_TOKEN)]);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]; return diff === 0;
}
async function expirePending(env, now) {await stmt(env, "UPDATE appointments SET status='expired',updated_at=? WHERE status='pending' AND (expires_at<? OR starts_at<=?)", now, now, now).run();}
async function slots(env, date, now) {
  if (!validDate(date)) return [];
  await expirePending(env, now);
  if (await stmt(env, 'SELECT date FROM closures WHERE date=?', date).first()) return [];
  const occupied = await stmt(env, "SELECT time FROM appointments WHERE date=? AND status IN ('pending','confirmed')", date).all();
  const taken = new Set(occupied.results.map(row => row.time)); return timesFor(date, now).filter(time => !taken.has(time));
}
async function limitRequests(request, env, now) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.RATE_SALT}:${Math.floor(now / HOUR)}:${ip}`)))].map(value => value.toString(16).padStart(2, '0')).join('');
  const row = await stmt(env, 'INSERT INTO rate_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count', hash, now + 2 * HOUR).first();
  return row.count <= 5;
}
async function readBody(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Error('Invalid content type');
  const reader = request.body?.getReader(); if (!reader) throw new Error('Empty request');
  let length = 0, text = ''; const decoder = new TextDecoder();
  while (true) {const {done, value} = await reader.read(); if (done) break; length += value.byteLength; if (length > 4096) {await reader.cancel(); throw new Error('Request too large');} text += decoder.decode(value, {stream: true});}
  text += decoder.decode(); return JSON.parse(text);
}
export function emailContent(appointment, kind) {
  const date = new Intl.DateTimeFormat('ro-RO', {timeZone: 'Europe/Bucharest', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}).format(appointment.starts_at);
  const when = `${date}, ora ${appointment.time}`;
  if (kind === 'clinic') return {subject: `Cerere de programare: ${when}`, text: `O cerere nouă așteaptă verificarea.\n\nNume: ${appointment.name}\nTelefon: ${appointment.phone}\nE-mail: ${appointment.email}\nVizită: ${appointment.service}\nMoment solicitat: ${when}\nReferință: ${appointment.id}\n\nConfirmă sau anulează cererea în panoul administrativ. Cererea expiră după 48 de ore sau la ora solicitată, oricare survine prima.`};
  const message = kind === 'confirmed' ? `Programarea ta la Vidadental este confirmată pentru ${when}.` : kind === 'reminder' ? `Îți reamintim de programarea ta la Vidadental: ${when}.` : `Programarea pentru ${when} a fost anulată. Contactează-ne pentru a găsi un alt moment potrivit.`;
  return {subject: kind === 'confirmed' ? 'Programarea ta este confirmată | Vidadental' : kind === 'reminder' ? 'Ne vedem curând | Vidadental' : 'Actualizare programare | Vidadental', text: `Bună, ${appointment.name}!\n\n${message}\n\nAdresa: Bulevardul Republicii 153, Bl. 29C, Ap. 4, parter, Ploiești.\nPentru modificări: 0745 166 956 sau 0722 581 034.\n\nReferință: ${appointment.id}\nCu grijă,\nEchipa Vidadental`};
}
export async function deliverJobs(env, now = Date.now(), send = fetch) {
  const jobs = await stmt(env, `SELECT j.*, a.name,a.phone,a.email,a.service,a.date,a.time,a.starts_at,a.status,a.reminder FROM mail_jobs j JOIN appointments a ON a.id=j.appointment_id WHERE j.sent_at IS NULL AND j.due_at<=? AND j.attempts<20 ORDER BY j.due_at LIMIT 40`, now).all();
  let sent = 0;
  for (const job of jobs.results) {
    const stale = (['confirmed', 'reminder'].includes(job.kind) && job.status !== 'confirmed') || (job.kind === 'cancelled' && job.status !== 'cancelled') || (job.kind === 'reminder' && (!job.reminder || job.starts_at <= now)) || (job.kind === 'clinic' && job.status !== 'pending');
    if (stale) {await stmt(env, 'UPDATE mail_jobs SET sent_at=?,last_error=? WHERE id=?', now, 'skipped: no longer applicable', job.id).run(); continue;}
    try {
      // A stable provider idempotency key prevents duplicate delivery after retries.
      const appointment = {...job, id: job.appointment_id}; const content = emailContent(appointment, job.kind);
      const response = await send('https://api.resend.com/emails', {method: 'POST', headers: {'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': job.id}, body: JSON.stringify({from: env.MAIL_FROM, to: [job.kind === 'clinic' ? env.CLINIC_EMAIL : job.email], reply_to: env.CLINIC_EMAIL, ...content}), signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('mail provider HTTP ' + response.status);
      await stmt(env, 'UPDATE mail_jobs SET sent_at=?,last_error=NULL WHERE id=?', now, job.id).run(); sent++;
    } catch (error) {
      // Persist only an operational category, never patient data or provider response bodies.
      await stmt(env, 'UPDATE mail_jobs SET attempts=attempts+1,last_error=?,due_at=? WHERE id=?', error.message.startsWith('mail provider') ? error.message : 'mail delivery network failure', now + 15 * 60_000, job.id).run();
    }
  }
  return sent;
}
async function handle(request, env, ctx) {
  const url = new URL(request.url), path = url.pathname, now = Date.now();
  if (request.method === 'OPTIONS') return new Response(null, {status: 204});
  if (!env.DB || !env.RESEND_API_KEY || !env.RATE_SALT || !env.MAIL_FROM || env.MAIL_FROM.includes('YOUR-')) return json({error: 'Serviciul de programări nu este încă activ.'}, 503);
  if (path === '/slots' && request.method === 'GET') return json({slots: await slots(env, url.searchParams.get('date'), now)});
  if (path === '/appointments' && request.method === 'POST') {
    let data; try {data = await readBody(request);} catch {return json({error: 'Cerere invalidă.'}, 400);}
    if (!validateBooking(data, now)) return json({error: 'Verifică datele și alege o oră la cel puțin două ore distanță.'}, 400);
    const existing = await stmt(env, 'SELECT id FROM appointments WHERE request_key=?', data.requestId).first(); if (existing) return json({id: existing.id, status: 'pending'});
    if (!await limitRequests(request, env, now)) return json({error: 'Prea multe cereri. Te rugăm să ne contactezi telefonic.'}, 429);
    if (!(await slots(env, data.date, now)).includes(data.time)) return json({error: 'Ora nu mai este disponibilă.'}, 409);
    const id = crypto.randomUUID(), starts = toUtc(data.date, data.time);
    try {
      await env.DB.batch([
        stmt(env, `INSERT INTO appointments (id,request_key,name,phone,email,service,date,time,starts_at,created_at,updated_at,expires_at,reminder,consent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, data.requestId, data.name.trim(), data.phone.trim(), data.email.trim(), data.service, data.date, data.time, starts, now, now, Math.min(now + 2 * DAY, starts), data.reminder === true ? 1 : 0, now),
        stmt(env, "INSERT INTO mail_jobs(id,appointment_id,kind,due_at) VALUES (?,?,'clinic',?)", `${id}:clinic`, id, now)
      ]);
    } catch (error) {
      const duplicate = await stmt(env, 'SELECT id FROM appointments WHERE request_key=?', data.requestId).first(); if (duplicate) return json({id: duplicate.id, status: 'pending'});
      if (/UNIQUE constraint/i.test(error.message)) return json({error: 'Ora nu mai este disponibilă.'}, 409); throw error;
    }
    ctx.waitUntil(deliverJobs(env)); return json({id, status: 'pending'}, 201);
  }
  if (path.startsWith('/admin/')) {
    if (!await authenticate(request, env)) return json({error: 'Autentificare necesară.'}, 401);
    await expirePending(env, now);
    if (path === '/admin/appointments' && request.method === 'GET') {
      const rows = await stmt(env, `SELECT a.*, (SELECT COUNT(*) FROM mail_jobs j WHERE j.appointment_id=a.id AND j.sent_at IS NULL AND j.attempts>0) AS email_issues FROM appointments a ORDER BY a.starts_at DESC LIMIT 300`).all();
      const closures = await stmt(env, 'SELECT date FROM closures WHERE date>=? ORDER BY date', localDay(now)).all(); return json({appointments: rows.results, closures: closures.results});
    }
    const match = path.match(/^\/admin\/appointments\/([0-9a-f-]+)$/i);
    if (match && request.method === 'PATCH') {
      let data; try {data = await readBody(request);} catch {return json({error: 'Cerere invalidă.'}, 400);}
      const appointment = await stmt(env, 'SELECT * FROM appointments WHERE id=?', match[1]).first(); if (!appointment) return json({error: 'Cererea nu există.'}, 404);
      if (!['confirmed', 'cancelled'].includes(data.status)) return json({error: 'Stare invalidă.'}, 400);
      if (appointment.status === data.status) return json({ok: true});
      if (!['pending', 'confirmed'].includes(appointment.status) || (data.status === 'confirmed' && appointment.starts_at <= now)) return json({error: 'Această cerere nu mai poate fi confirmată.'}, 409);
      const kind = data.status;
      const updates = [stmt(env, 'UPDATE appointments SET status=?,updated_at=? WHERE id=?', kind, now, appointment.id), stmt(env, 'INSERT OR IGNORE INTO mail_jobs(id,appointment_id,kind,due_at) VALUES (?,?,?,?)', `${appointment.id}:${kind}`, appointment.id, kind, now)];
      if (kind === 'confirmed' && appointment.reminder) updates.push(stmt(env, "INSERT OR IGNORE INTO mail_jobs(id,appointment_id,kind,due_at) VALUES (?,?,'reminder',?)", `${appointment.id}:reminder`, appointment.id, Math.max(now, appointment.starts_at - DAY)));
      await env.DB.batch(updates); ctx.waitUntil(deliverJobs(env)); return json({ok: true});
    }
    if (path === '/admin/closures' && ['POST', 'DELETE'].includes(request.method)) {
      let data; try {data = await readBody(request);} catch {return json({error: 'Cerere invalidă.'}, 400);}
      if (!validDate(data.date)) return json({error: 'Dată invalidă.'}, 400);
      if (request.method === 'POST') await stmt(env, 'INSERT OR IGNORE INTO closures(date) VALUES (?)', data.date).run();
      else await stmt(env, 'DELETE FROM closures WHERE date=?', data.date).run();
      return json({ok: true});
    }
    if (path === '/admin/retry-email' && request.method === 'POST') {
      await stmt(env, 'UPDATE mail_jobs SET attempts=0,due_at=? WHERE sent_at IS NULL', now).run(); ctx.waitUntil(deliverJobs(env)); return json({ok: true});
    }
  }
  return json({error: 'Ruta nu există.'}, 404);
}
export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin'); const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim());
    // Non-browser authenticated admin calls may omit Origin. Browser writes must match an explicit origin.
    if ((origin && !allowed.includes(origin)) || (!origin && request.method === 'POST' && new URL(request.url).pathname === '/appointments')) return json({error: 'Origine nepermisă.'}, 403);
    let response;
    try {response = await handle(request, env, ctx);} catch {response = json({error: 'Serviciul nu răspunde momentan. Te rugăm să reîncerci.'}, 500);}
    const headers = new Headers(response.headers);
    if (origin && allowed.includes(origin)) headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin'); headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS'); headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return new Response(response.body, {status: response.status, headers});
  },
  async scheduled(controller, env, ctx) {
    const now = controller.scheduledTime || Date.now();
    await expirePending(env, now);
    await deliverJobs(env, now);
    await env.DB.batch([
      stmt(env, 'DELETE FROM appointments WHERE starts_at<? OR (status IN (\'cancelled\',\'expired\') AND updated_at<?)', now - 90 * DAY, now - 30 * DAY),
      stmt(env, 'DELETE FROM rate_limits WHERE expires_at<?', now),
      stmt(env, 'DELETE FROM closures WHERE date<?', localDay(now - DAY))
    ]);
  }
};

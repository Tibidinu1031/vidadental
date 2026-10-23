(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const icons = window.VIDA_ICONS;
  let api = '', token = '', appointments = [], closures = [];
  const labels = {pending: 'În așteptare', confirmed: 'Confirmată', cancelled: 'Anulată', expired: 'Expirată'};
  $('#api-url').value = window.VIDA_CONFIG.apiBase;
  function message(text, error = false) {$('#admin-message').textContent = text; $('#admin-message').classList.toggle('error', error);}
  async function request(path, method = 'GET', data) {
    const response = await fetch(api + path, {method, headers: {Authorization: 'Bearer ' + token, ...(data ? {'Content-Type': 'application/json'} : {})}, ...(data ? {body: JSON.stringify(data)} : {}), signal: AbortSignal.timeout(20000)});
    const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Operațiunea nu a reușit.'); return body;
  }
  async function load() {
    try {const data = await request('/admin/appointments'); appointments = data.appointments; closures = data.closures; render(); $('#admin-login').hidden = true; $('#admin-dashboard').hidden = false; $('#logout').hidden = false; message('Agenda este actualizată.');} catch (error) {message(error.message, true);}
  }
  $('#admin-login').addEventListener('submit', event => {
    event.preventDefault(); const url = new URL($('#api-url').value);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {message('Folosește o adresă HTTPS.', true); return;}
    api = url.origin; token = $('#admin-token').value; $('#admin-token').value = ''; load();
  });
  function render() {
    const list = $('#appointments'); list.replaceChildren();
    const filter = $('#status-filter').value;
    const rows = appointments.filter(row => filter === 'all' || (filter === 'active' ? ['pending', 'confirmed'].includes(row.status) : row.status === filter)).sort((a, b) => a.starts_at - b.starts_at);
    if (!rows.length) {const empty = document.createElement('p'); empty.className = 'admin-empty'; empty.textContent = 'Nicio cerere în această categorie.'; list.append(empty);}
    rows.forEach(row => {
      const card = document.createElement('article'); card.className = 'appointment-card';
      const header = document.createElement('div'); header.className = 'appointment-header'; const heading = document.createElement('strong'); heading.textContent = row.name + ' · ' + new Date(row.starts_at).toLocaleString('ro-RO', {timeZone: 'Europe/Bucharest', dateStyle: 'medium', timeStyle: 'short'});
      const badge = document.createElement('span'); badge.className = 'badge ' + row.status; badge.textContent = labels[row.status]; header.append(heading, badge);
      const info = document.createElement('div'); info.className = 'appointment-info';
      [row.phone, row.email, row.service, row.reminder ? 'Reminder solicitat' : 'Fără reminder'].forEach(value => {const span = document.createElement('span'); span.textContent = value; info.append(span);});
      const actions = document.createElement('div'); actions.className = 'appointment-actions';
      for (const [status, text] of [['confirmed', 'Confirmă și trimite e-mail'], ['cancelled', 'Anulează și notifică']]) {
        if (status === 'confirmed' && row.status !== 'pending' || status === 'cancelled' && !['pending', 'confirmed'].includes(row.status)) continue;
        const button = document.createElement('button'); button.textContent = text; if (status === 'cancelled') button.className = 'cancel';
        button.addEventListener('click', async () => {
          if (!confirm(`${text} pentru ${row.name}, ${row.date}, ora ${row.time}?`)) return;
          button.disabled = true;
          try {await request('/admin/appointments/' + row.id, 'PATCH', {status}); await load(); message('Starea a fost salvată. E-mailul se trimite automat.');} catch (error) {message(error.message, true); button.disabled = false;}
        }); actions.append(button);
      }
      card.append(header, info, actions);
      if (row.email_issues) {const warning = document.createElement('p'); warning.className = 'mail-warning'; warning.textContent = 'Există e-mailuri nelivrate. Verifică serviciul Resend și reîncearcă.'; card.append(warning);}
      list.append(card);
    });
    const container = $('#closures'); container.replaceChildren();
    closures.forEach(row => {
      const chip = document.createElement('span'); chip.className = 'closure-chip'; chip.append(document.createTextNode(row.date)); const button = document.createElement('button'); button.append(icons.create('close')); button.setAttribute('aria-label', 'Deblochează ziua ' + row.date);
      button.addEventListener('click', async () => {try {await request('/admin/closures', 'DELETE', {date: row.date}); load();} catch (error) {message(error.message, true);}}); chip.append(button); container.append(chip);
    });
  }
  $('#status-filter').addEventListener('change', render);
  $('#refresh').addEventListener('click', load);
  $('#retry-mail').addEventListener('click', async () => {try {await request('/admin/retry-email', 'POST', {}); message('E-mailurile nelivrate sunt retrimise. Actualizează agenda peste câteva secunde.');} catch (error) {message(error.message, true);}});
  $('#closure-form').addEventListener('submit', async event => {event.preventDefault(); try {await request('/admin/closures', 'POST', {date: $('#closure-date').value}); load();} catch (error) {message(error.message, true);}});
  $('#logout').addEventListener('click', () => {token = ''; appointments = []; closures = []; $('#appointments').replaceChildren(); $('#closures').replaceChildren(); $('#admin-dashboard').hidden = true; $('#admin-login').hidden = false; $('#logout').hidden = true; message('Sesiunea a fost închisă.');});
  // Close the in-memory session after 15 minutes without activity.
  let timeout;
  function resetTimeout() {clearTimeout(timeout); timeout = setTimeout(() => {if (token) $('#logout').click();}, 15 * 60_000);}
  ['pointerdown', 'keydown'].forEach(event => document.addEventListener(event, resetTimeout, {passive: true})); resetTimeout();
})();

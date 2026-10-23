(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const config = window.VIDA_CONFIG;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const api = config.apiBase.replace(/\/$/, '');
  const months = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
  const today = new Date(new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date()) + 'T12:00:00');
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 90);
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const displayDate = key => new Date(key + 'T12:00:00').toLocaleDateString('ro-RO', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
  const form = $('#booking-form');
  let calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let selectedDate = '', selectedTime = '', slotRequest = 0, requestId = crypto.randomUUID?.() || String(Date.now());

  $('#year').textContent = new Date().getFullYear();
  if (!reducedMotion && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-motion');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
    }), {threshold: .08});
    $$('.reveal').forEach(element => observer.observe(element));
  }
  let scrollQueued = false;
  function updateScroll() {
    const scrollable = document.documentElement.scrollHeight - innerHeight;
    $('.scroll-progress').style.transform = `scaleX(${scrollable ? scrollY / scrollable : 0})`;
    $('#header').classList.toggle('scrolled', scrollY > 25);
    scrollQueued = false;
  }
  addEventListener('scroll', () => {if (!scrollQueued) {scrollQueued = true; requestAnimationFrame(updateScroll);}}, {passive: true});
  updateScroll();
  const menuButton = $('.menu-toggle');
  function closeMenu() {menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Deschide meniul'); $('#navigation').classList.remove('is-open'); document.body.classList.remove('menu-open');}
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Închide meniul' : 'Deschide meniul');
    $('#navigation').classList.toggle('is-open', open); document.body.classList.toggle('menu-open', open);
  });
  $$('#navigation a, .header-cta, .brand').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {if (event.key === 'Escape') closeMenu();});
  window.matchMedia('(min-width: 1001px)').addEventListener('change', event => {if (event.matches) closeMenu();});
  $$('.service-item').forEach(item => item.addEventListener('toggle', () => {if (item.open) $$('.service-item').filter(other => other !== item).forEach(other => other.open = false);}));
  $$('.service-book').forEach(button => button.addEventListener('click', () => {
    $('#service-select').value = button.dataset.service;
    $('#programare').scrollIntoView({behavior: reducedMotion ? 'instant' : 'smooth'});
    toast('Alege ziua și ora preferate pentru ' + button.dataset.service.toLowerCase() + '.');
  }));

  function renderReviews() {
    const track = $('#review-track');
    (window.VIDA_REVIEWS || []).forEach((review, index) => {
      const card = document.createElement('article'); card.className = 'review-card';
      const top = document.createElement('div'); top.className = 'review-card-top';
      const stars = document.createElement('span'); stars.className = 'stars'; stars.textContent = '★★★★★'; stars.setAttribute('aria-label', '5 din 5 stele');
      const google = document.createElement('span'); google.className = 'google-g'; google.textContent = 'G'; google.setAttribute('aria-hidden', 'true'); top.append(stars, google);
      const quote = document.createElement('blockquote'); quote.textContent = '„' + review.text + (/[.!?]$/.test(review.text) ? '' : '…') + '”';
      if (['Adriana C Georgescu', 'Lucian Manolache'].includes(review.name)) quote.lang = 'en';
      const author = document.createElement('div'); author.className = 'review-author';
      const img = document.createElement('img'); img.src = review.image; img.width = 39; img.height = 39; img.loading = 'lazy'; img.alt = 'Fotografia publică de profil a lui ' + review.name;
      const info = document.createElement('div'); const name = document.createElement('strong'); name.textContent = review.name;
      const source = document.createElement('small'); source.textContent = 'Recenzie Google · 5/5'; info.append(name, source);
      const link = document.createElement('a'); link.href = config.mapsUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '↗'; link.setAttribute('aria-label', 'Citește recenziile Vidadental pe Google Maps, inclusiv recenzia de la ' + review.name);
      author.append(img, info, link); card.append(top, quote, author); card.dataset.index = index; track.append(card);
    });
    const width = () => track.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap);
    const update = () => {
      const index = Math.min(9, Math.round(track.scrollLeft / width()));
      $('#review-position').textContent = String(index + 1).padStart(2, '0') + ' / 10';
      $('#review-prev').disabled = track.scrollLeft < 5;
      $('#review-next').disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 5;
    };
    $('#review-prev').addEventListener('click', () => track.scrollBy({left: -width(), behavior: reducedMotion ? 'instant' : 'smooth'}));
    $('#review-next').addEventListener('click', () => track.scrollBy({left: width(), behavior: reducedMotion ? 'instant' : 'smooth'}));
    track.addEventListener('scroll', update, {passive: true});
    track.addEventListener('keydown', event => {if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {event.preventDefault(); track.scrollBy({left: width() * (event.key === 'ArrowRight' ? 1 : -1), behavior: 'smooth'});}});
    addEventListener('resize', update); update();
  }
  renderReviews();

  function proposedSlots(key) {
    const day = new Date(key + 'T12:00:00').getDay();
    const times = [2, 5].includes(day) ? ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'] : [1, 3, 4].includes(day) ? ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] : [];
    const now = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hour12: false}).format(new Date());
    return key === dateKey(today) ? times.filter(time => time > now) : times;
  }
  function renderCalendar() {
    const month = calendarMonth.getMonth(), year = calendarMonth.getFullYear();
    $('#calendar-month').textContent = `${months[month]} ${year}`;
    $('#month-prev').disabled = year === today.getFullYear() && month === today.getMonth();
    $('#month-next').disabled = year === maxDate.getFullYear() && month === maxDate.getMonth();
    const grid = $('#calendar-grid'); grid.replaceChildren();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) {const blank = document.createElement('span'); blank.setAttribute('aria-hidden', 'true'); grid.append(blank);}
    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
      const date = new Date(year, month, day, 12), key = dateKey(date), button = document.createElement('button');
      button.type = 'button'; button.className = 'calendar-day'; button.textContent = day;
      button.setAttribute('aria-label', displayDate(key)); button.setAttribute('aria-pressed', String(selectedDate === key));
      button.disabled = date < today || date > maxDate || !proposedSlots(key).length;
      button.classList.toggle('today', key === dateKey(today)); button.classList.toggle('selected', selectedDate === key);
      button.addEventListener('click', () => {selectedDate = key; selectedTime = ''; renderCalendar(); loadSlots(key);}); grid.append(button);
    }
  }
  async function loadSlots(key) {
    const request = ++slotRequest; selectedTime = ''; $('#to-details').disabled = true;
    const container = $('#time-slots'); container.replaceChildren();
    $('#time-label').textContent = 'Ora preferată pentru ' + new Date(key + 'T12:00:00').toLocaleDateString('ro-RO', {day: 'numeric', month: 'long'});
    let times = proposedSlots(key);
    if (api) {
      $('#time-label').textContent = 'Verificăm orele disponibile…';
      try {
        const response = await fetch(api + '/slots?date=' + key, {signal: AbortSignal.timeout(10000)});
        if (!response.ok) throw new Error('availability');
        const body = await response.json(); times = body.slots;
      } catch {if (request === slotRequest) $('#time-label').textContent = 'Nu putem verifica orele acum. Reîncearcă sau sună-ne.'; return;}
    }
    if (request !== slotRequest) return;
    $('#time-label').textContent = times.length ? 'Alege ora preferată' : 'Nu mai sunt ore pentru această zi. Alege altă zi.';
    times.forEach(time => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'time-slot'; button.textContent = time; button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {selectedTime = time; $$('.time-slot').forEach(slot => {slot.classList.toggle('selected', slot === button); slot.setAttribute('aria-pressed', String(slot === button));}); $('#to-details').disabled = false;}); container.append(button);
    });
  }
  $('#month-prev').addEventListener('click', () => {calendarMonth.setMonth(calendarMonth.getMonth() - 1); renderCalendar();});
  $('#month-next').addEventListener('click', () => {calendarMonth.setMonth(calendarMonth.getMonth() + 1); renderCalendar();});
  renderCalendar();
  function showStep(step, focus = true) {
    $$('.booking-panel').forEach(panel => panel.hidden = Number(panel.dataset.panel) !== step);
    $$('.booking-steps li').forEach(item => {const active = Number(item.dataset.step) === step; item.classList.toggle('active', active); if (active) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');});
    if (focus) {const target = $(`.booking-panel[data-panel="${step}"]`); const first = $('input,button', target); first?.focus({preventScroll: true});}
  }
  $('#to-details').addEventListener('click', () => {if (selectedDate && selectedTime) showStep(2);});
  $$('[data-back]').forEach(button => button.addEventListener('click', () => showStep(Number(button.dataset.back))));
  if (!api) {
    $('#reminder-choice').hidden = true; form.elements.email.required = false;
    const emailLabel = form.elements.email.parentElement; emailLabel.firstChild.textContent = 'Adresa de e-mail (opțional)';
    $('#submit-booking').replaceChildren(document.createTextNode('Deschide WhatsApp '), Object.assign(document.createElement('span'), {textContent: '↗'}));
    $('#submit-note').textContent = 'Vei continua în WhatsApp cu un mesaj pregătit. Verifică-l și trimite-l pentru a solicita programarea. Clinica îți confirmă apoi data și ora.';
  } else {
    $('#availability-note').textContent = 'Orele se verifică în calendarul clinicii. Cererea devine programare după confirmare. Ora locală: România.';
    $('#submit-note').textContent = 'Trimitem solicitarea către clinică. Data și ora devin valabile după confirmarea echipei.';
  }
  function getData() {
    const data = Object.fromEntries(new FormData(form));
    return {name: data.name.trim(), phone: data.phone.trim(), email: data.email.trim(), service: data.service, date: selectedDate, time: selectedTime, consent: data.consent === 'on', reminder: Boolean(api) && data.reminder === 'on', website: data.website || '', requestId};
  }
  $('#to-summary').addEventListener('click', () => {
    const data = getData(); let error = '', invalidField;
    if (data.name.length < 2) {error = 'Completează numele tău.'; invalidField = form.elements.name;}
    else if (!/^[+()\d\s.-]{9,24}$/.test(data.phone) || data.phone.replace(/\D/g, '').length < 9) {error = 'Completează un număr de telefon valid.'; invalidField = form.elements.phone;}
    else if ((api || data.email) && !form.elements.email.validity.valid) {error = 'Completează o adresă de e-mail validă.'; invalidField = form.elements.email;}
    else if (!data.consent) {error = 'Este necesar acordul pentru a te contacta în legătură cu cererea.'; invalidField = form.elements.consent;}
    $('#details-error').textContent = error;
    if (error) {invalidField.focus(); return;}
    const summary = $('#booking-summary'); summary.replaceChildren();
    const rows = [['Vizita', data.service], ['Ziua', displayDate(data.date)], ['Ora preferată', data.time], ['Nume', data.name], ['Telefon', data.phone]];
    if (data.email) rows.push(['E-mail', data.email]);
    if (api) rows.push(['Reminder prin e-mail', data.reminder ? 'Cu o zi înainte, după confirmare' : 'Nu este solicitat']);
    rows.forEach(([label, value]) => {const row = document.createElement('div'); row.className = 'summary-row'; const key = document.createElement('span'), val = document.createElement('span'); key.textContent = label; val.textContent = value; row.append(key, val); summary.append(row);});
    showStep(3);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const data = getData(); if (!selectedDate || !selectedTime || !data.consent || data.website) return;
    if (!api) {
      const text = `Bună ziua! Doresc să solicit o programare la Vidadental Ploiești.\n\nNume: ${data.name}\nTelefon: ${data.phone}${data.email ? '\nE-mail: ' + data.email : ''}\nVizită: ${data.service}\nData preferată: ${displayDate(data.date)}\nOra preferată: ${data.time}\n\nVă rog să îmi confirmați disponibilitatea. Mulțumesc!`;
      const link = document.createElement('a'); link.href = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(text)}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click();
      toast('Trimite mesajul în WhatsApp. Programarea se confirmă de către clinică.'); return;
    }
    const button = $('#submit-booking'); button.disabled = true; button.textContent = 'Se trimite…'; $('#submit-error').textContent = '';
    try {
      const response = await fetch(api + '/appointments', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data), signal: AbortSignal.timeout(15000)});
      const body = await response.json();
      if (!response.ok) {if (response.status === 409) {selectedTime = ''; await loadSlots(selectedDate); showStep(1); toast('Ora tocmai a devenit indisponibilă. Alege alta.');} else throw new Error(body.error || 'Nu am putut trimite cererea. Reîncearcă sau sună-ne.'); return;}
      form.hidden = true; $('#booking-success').hidden = false; $('#success-reference').textContent = 'Referința cererii: ' + body.id;
      $('#booking-success h3').tabIndex = -1; $('#booking-success h3').focus();
    } catch (error) {$('#submit-error').textContent = error.name === 'TimeoutError' ? 'Răspunsul întârzie. Poți reîncerca în siguranță, folosind aceeași cerere.' : 'Nu am putut trimite cererea. Verifică conexiunea sau sună la 0745 166 956.';}
    finally {button.disabled = false; button.textContent = 'Trimite cererea ↗';}
  });
  $('#book-again').addEventListener('click', () => {form.reset(); form.hidden = false; $('#booking-success').hidden = true; selectedDate = ''; selectedTime = ''; requestId = crypto.randomUUID(); $('#time-slots').replaceChildren(); $('#time-label').textContent = 'Alege mai întâi o zi'; $('#to-details').disabled = true; renderCalendar(); showStep(1);});
  $('#load-map').addEventListener('click', () => {
    const iframe = document.createElement('iframe'); iframe.src = config.mapEmbed; iframe.title = 'Google Maps: pinul clinicii Vidadental, Bulevardul Republicii 153, Ploiești'; iframe.allowFullscreen = true; iframe.referrerPolicy = 'no-referrer-when-downgrade';
    $('#map-wrap').replaceChildren(iframe);
  });
  let toastTimer;
  function toast(message) {clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => $('#toast').hidden = true, 5500);}
  const legal = {
    privacy: `<h2>Confidențialitatea ta contează.</h2><p>Pentru informații privind prelucrarea datelor de către clinică, contactează Vidadental la <a href="mailto:contact@vidadental.ro">contact@vidadental.ro</a> sau la 0745 166 956.</p><h3>Solicitarea unei programări</h3><p>Folosim numele, telefonul, adresa de e-mail, tipul vizitei și preferința de dată și oră pentru gestionarea cererii. Te rugăm să nu incluzi informații medicale în mesajele de programare. Formularul nu salvează datele în stocarea browserului.</p><p>${api ? 'Cererea este transmisă serviciului de programări al clinicii, găzduit pe Cloudflare. Confirmările și reminderele solicitate sunt trimise prin Resend. Datele operaționale sunt șterse automat la 90 de zile după data vizitei sau la 30 de zile după anulare.' : 'La apăsarea butonului „Deschide WhatsApp”, detaliile introduse sunt incluse în linkul către WhatsApp. Trimiterea efectivă a mesajului se face de către tine în WhatsApp, unde se aplică politica acestui serviciu. Nu este activ un serviciu automat de remindere pe această versiune.'}</p><h3>Servicii externe</h3><p>Harta Google se încarcă doar când alegi acest lucru. Linkurile către Facebook, Instagram, Google și WhatsApp deschid servicii externe cu politici proprii. Fonturile, imaginile și fotografiile recenziilor sunt servite local.</p><h3>Întrebări și solicitări</h3><p>Pentru acces, corectare sau ștergere, scrie la contact@vidadental.ro. Consultă și <a href="https://vidadental.ro/politica-de-confidentialitate/" target="_blank" rel="noopener noreferrer">politica publicată de clinică</a>.</p>`,
    cookies: '<h2>Cookie-uri, pe înțelesul tău.</h2><p>Acest site nu adaugă cookie-uri de analiză sau publicitate și nu folosește stocarea locală pentru datele din formular.</p><p>Google Maps se încarcă numai la apăsarea butonului „Încarcă harta Google”. Google poate prelucra adresa IP și poate folosi cookie-uri conform politicilor proprii. Poți deschide locația direct în Google Maps fără a încărca harta aici.</p><p>WhatsApp, Facebook și Instagram sunt servicii externe, accesate doar prin linkurile pe care le alegi.</p>'
  };
  $$('[data-legal]').forEach(button => button.addEventListener('click', () => {$('#legal-content').innerHTML = legal[button.dataset.legal]; $('#legal-dialog').showModal();}));
  $('#close-legal').addEventListener('click', () => $('#legal-dialog').close());
  $('#legal-dialog').addEventListener('click', event => {if (event.target === $('#legal-dialog')) {const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();}});
})();

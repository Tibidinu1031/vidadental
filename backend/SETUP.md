# Activarea programărilor automate

Frontendul rămâne pe GitHub Pages. Acest backend rulează separat pe Cloudflare Workers. Vei avea nevoie de un cont Cloudflare, o bază D1 și un cont Resend cu domeniu de expediere verificat. Configurarea conturilor și eventualele costuri sunt gestionate de proprietarul clinicii.

## 1. Creează serviciul și baza de date

Cu Node.js 24, din folderul `backend`:

```powershell
npx wrangler@4 login
npx wrangler@4 d1 create vidadental-programari --location=eeur
```

Copiază identificatorul returnat în `database_id` din `wrangler.toml`. D1 este o bază nouă, fără date reale în acest proiect.

Aplică schema:

```powershell
npx wrangler@4 d1 execute vidadental-programari --remote --file=schema.sql
```

## 2. Configurează expedierea

În Resend, verifică domeniul de expediere prin înregistrările DNS cerute de serviciu și generează o cheie API de trimitere. Folosește o adresă reală a clinicii, de exemplu o adresă de programări de pe domeniul verificat.

În `wrangler.toml`:

```toml
ALLOWED_ORIGINS = "https://USERNAME.github.io"
MAIL_FROM = "Vidadental <programari@DOMENIUL-VERIFICAT.ro>"
CLINIC_EMAIL = "contact@vidadental.ro"
```

`ALLOWED_ORIGINS` conține origini exacte, fără calea repositoryului și fără slash final. Pentru mai multe domenii, separă originile prin virgulă. Nu folosi `*`. Folosește temporar `http://127.0.0.1:4173` numai pentru verificări locale.

Setează secretele în prompturile securizate ale Wrangler:

```powershell
npx wrangler@4 secret put RESEND_API_KEY
npx wrangler@4 secret put ADMIN_TOKEN
npx wrangler@4 secret put RATE_SALT
```

Generează două valori aleatoare distincte pentru `ADMIN_TOKEN` și `RATE_SALT`, fiecare de cel puțin 32 de caractere. `ADMIN_TOKEN` oferă acces la datele recepției. Nu îl adăuga în HTML, `config.js`, repository sau capturi de ecran. Nu introduce cheia Resend în frontend.

## 3. Publică backendul

```powershell
npx wrangler@4 deploy
```

Wrangler afișează adresa de forma `https://vidadental-programari.SUBDOMENIU.workers.dev`. Verifică și cronul `*/15 * * * *` în panoul Cloudflare. Rulează la fiecare 15 minute, pe UTC. Data și ora pacientului sunt convertite separat din `Europe/Bucharest`.

## 4. Conectează site-ul

În `assets/config.js`, completează:

```javascript
apiBase: 'https://vidadental-programari.SUBDOMENIU.workers.dev',
```

Publică modificarea pe GitHub Pages. Calendarul va încărca orele din API, adresa de e-mail va deveni obligatorie și va apărea opțiunea pentru reminder.

## 5. Recepția

Deschide `https://USERNAME.github.io/REPOSITORY/admin.html`. Introdu URL-ul API și cheia `ADMIN_TOKEN`. Cheia există doar în memoria paginii și sesiunea se închide după 15 minute fără activitate.

- Cererile noi apar „În așteptare” și trimit o notificare către recepție.
- Recepția verifică agenda internă și apasă „Confirmă și trimite e-mail”. Pacientul primește confirmarea pe e-mail.
- Dacă pacientul a optat pentru reminder, acesta este pus în coadă pentru 24 de ore înainte. Cronul îl procesează în următorul interval de 15 minute. Dacă o programare este confirmată cu mai puțin de 24 de ore înainte, reminderul devine eligibil imediat.
- Anularea trimite o notificare și oprește reminderul rămas în coadă.
- „Blochează ziua” oprește cereri noi în ziua aleasă. Nu anulează programările deja existente.
- Cererile neconfirmate expiră după 48 de ore sau la momentul solicitat, oricare survine prima. Orele sunt eliberate.

Calendarul rezervă ferestre de o oră pentru o singură agendă. Nu reprezintă o agendă separată pentru fiecare medic. Programul și intervalele sunt definite în `timesFor()` din `worker.mjs`; preferințele statice sunt în `proposedSlots()` din `assets/app.js`. Extinde aceste funcții dacă recepția dorește reguli diferite.

## 6. Verificare înainte de activare

Folosește inițial adrese de test controlate de tine, inclusiv `CLINIC_EMAIL`. Nu trimite mesaje de test către pacienți reali.

1. Trimite o cerere și verifică apariția la recepție.
2. Confirmă cererea și verifică e-mailul cu ora corectă din România.
3. Verifică rândul `reminder` în `mail_jobs` și data `due_at` la 24 de ore înainte.
4. Anulează o programare de test și verifică absența unui reminder nou.
5. Verifică în Resend livrările și în Cloudflare execuțiile cronului.

Testele automate se rulează din rădăcina proiectului cu `npm run check`. Folosesc SQLite în memorie și un expeditor simulat. Nu demonstrează livrarea reală prin contul tău Resend; aceasta se verifică după configurare.

## Comportament operațional

Trimiterile e-mail sunt salvate într-o coadă durabilă. La erori se reîncearcă la 15 minute, până la 20 de încercări. Același mesaj folosește aceeași cheie de idempotență la furnizor, iar un job livrat este marcat în D1. Recepția vede erorile și poate relansa încercările. Confirmarea salvată nu este pierdută dacă expeditorul este temporar indisponibil.

API-ul validează datele, blochează orele ocupate prin index unic, limitează cererile la 5/oră pentru un identificator derivat din IP cu salt și interval orar, verifică originile și cere token pentru administrare. Nu salvează IP-ul brut. Pentru trafic mare sau atacuri, activează suplimentar regulile de rată și protecția anti-bot din Cloudflare.

Datele programărilor sunt șterse automat la 90 de zile după vizită; cererile anulate sau expirate se șterg la 30 de zile după modificare. Această bază este un registru de programări, fără fișe medicale. Nu există sincronizare cu softul medical al clinicii, Google Calendar sau SMS.

Emailurile conțin date de contact și detalii de programare. Folosește conturi aprobate de clinică și completează informațiile operatorului și ale furnizorilor din nota de confidențialitate înainte de colectarea datelor reale.

## Documentație oficială

- [Cloudflare D1](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email)
- [Chei de idempotență Resend](https://resend.com/docs/dashboard/emails/idempotency-keys)

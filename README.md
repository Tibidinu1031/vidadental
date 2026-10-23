# Vidadental

Site în română, realizat în HTML, CSS și JavaScript, cu `index.html` în rădăcină. Fără framework și fără dependențe pentru partea publică. Căile către resurse sunt relative și funcționează inclusiv la `username.github.io/nume-repository/`.

## Ce este gata

- Design responsive, animații la scroll, meniu mobil, servicii extensibile, carusel și interacțiuni cu tastatura.
- Unde simetrice pe întregul fundal, într-un singur strat continuu, cu accente controlate de salvie și teracotă.
- Pictograme SVG locale pentru săgeți, stele, ornamente și controale, fără caractere care pot fi afișate ca emoji pe telefon.
- Hero dimensionat după înălțimea ecranului, inclusiv pe mobil, pentru a afișa din prima titlul, acțiunile și imaginea.
- 10 fragmente din recenzii Google de 5/5, cu fotografiile publice originale de profil și link către Google Maps.
- Textul solicitat: „Rating de 5/5 dupa 350+ review-uri in Google Maps”. Profilul Google afișa 360 de recenzii și 5/5 la verificarea din 23 octombrie 2026.
- Ambele telefoane, Facebook, Instagram, WhatsApp, adresă și hartă Google cu pinul verificat.
- Calendar în trei pași, validare, rezumat și cerere de programare prin WhatsApp.
- Backend separat pentru disponibilitate, confirmări, anulări și remindere prin e-mail cu aproximativ 24 de ore înainte.
- Panou pentru recepție în `admin.html`, cu date accesibile doar prin cheia secretă.
- Fonturi și imagini locale. Niciun script de tracking. Harta externă se încarcă la alegerea vizitatorului.

## Pornește local

Poți deschide direct `index.html`. Pentru dezvoltare și verificare în browser, cu Node.js 24:

```powershell
npm run dev
```

Deschide `http://127.0.0.1:4173`. Nu este necesar `npm install` pentru site.

```powershell
npm run check
npm run build
```

Verificările includ resurse, ancore, cele 10 recenzii, telefoanele, absența caracterelor de tip dash lung și 6 teste ale fluxului de programare pe SQLite în memorie. Buildul copiază doar fișierele publice în `dist/`.

## Publică pe GitHub Pages

1. Creează un repository pe GitHub și încarcă fișierele acestui folder.
2. În repository, mergi la **Settings > Pages > Source > GitHub Actions**.
3. Workflowul `.github/workflows/pages.yml` verifică site-ul și publică folderul `dist/` la fiecare push pe `main`. Se poate porni și manual din Actions.

Alternativ, pentru publicare directă din rădăcină, alege **Deploy from a branch > main > /(root)**. `index.html` este deja la locul potrivit. Cu această alternativă poți elimina workflowul Pages pentru a folosi un singur mecanism de publicare.

Dacă pornești de la acest folder gol de istoric Git:

```powershell
git init
git add .
git commit -m "Create Vidadental website"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

Înlocuiește `USERNAME` și `REPOSITORY`. Nu există chei sau credențiale în proiect. `research/`, `qa/`, fișierele de mediu și artefactele locale sunt ignorate de Git.

## Programări și remindere

În configurația livrată, `apiBase` este gol. Pacientul alege ziua și ora preferate, completează datele și deschide un mesaj pregătit în WhatsApp. Pacientul îl trimite personal. Site-ul nu pretinde că a înregistrat o programare confirmată. Adresa de e-mail este opțională în acest mod, iar opțiunea de reminder automat nu este afișată.

Conform alegerii tale, integrarea automată este pregătită, dar **nu este activată**. GitHub Pages găzduiește fișiere statice și nu execută joburi programate. Pentru activare ai instrucțiunile complete în [backend/SETUP.md](backend/SETUP.md).

Backendul folosește Cloudflare Workers, D1 și Resend. Confirmarea și anularea sunt făcute de recepție. Reminderul este trimis doar pentru programări confirmate și numai dacă pacientul l-a solicitat. Cronul rulează la fiecare 15 minute, inclusiv când site-ul este închis. Ora clinicii este `Europe/Bucharest`, cu schimbarea orei tratată automat. Nu este integrat cu o agendă medicală deja existentă sau cu Google Calendar; recepția trebuie să verifice agenda internă înainte de confirmare.

## Fișierele principale

| Fișier | Rol |
| --- | --- |
| `index.html` | Pagina publică, în root |
| `assets/styles.css` | Design și responsive |
| `assets/app.js` | Calendar, interacțiuni și formular |
| `assets/config.js` | API, WhatsApp și Google Maps |
| `assets/reviews.json` | Recenzii, identificatori Google și surse |
| `assets/reviews-data.js` | Aceleași recenzii, încărcabile și prin deschiderea directă a HTML-ului |
| `admin.html`, `assets/admin.js` | Panoul recepției |
| `backend/` | API, schemă D1, cron și ghid de activare |
| `tests/booking.test.mjs` | Testele fluxului de programare |
| `CREDITS.md` | Proveniența imaginilor, fonturilor și datelor |

La editarea recenziilor, păstrează sincronizate `reviews.json` și `reviews-data.js`. A doua variantă începe cu `window.VIDA_REVIEWS =` și se termină cu `;`. `npm run check` verifică sincronizarea.

## Înainte de lansarea clinicii

Confirmă cu clinica programul de lucru, componența actuală a echipei și alegerea numărului WhatsApp. Sunt preluate din sursele publice și linkurile furnizate. Folosirea WhatsApp pe 0722 581 034 trebuie validată de clinică, deoarece un număr public nu dovedește automat existența unui cont WhatsApp activ.

Imaginea principală este un portret editorial ilustrativ generat, fără a reprezenta un pacient real. Fotografiile medicale de prezentare provin din site-ul existent. Fotografiile recenziilor sunt originale. Sursele și promptul imaginii principale sunt în `CREDITS.md`.

Nota de confidențialitate descrie funcționarea implementată și include contactul clinicii. Completează denumirea juridică și datele operatorului împreună cu clinica înainte de activarea colectării automate. Pentru un domeniu propriu, adaugă URL-ul absolut al imaginii Open Graph și URL-ul canonic final după ce sunt cunoscute.

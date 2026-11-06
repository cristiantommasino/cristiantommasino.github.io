# Sito personale – Cristian Tommasino

Sito statico realizzato con [Astro](https://astro.build), pubblicato gratuitamente su GitHub Pages.
Tutti i contenuti stanno in file di testo nella cartella `src/data/`: per aggiornare il sito
non serve toccare il codice.

## Dove si modificano i contenuti

| Cosa | File |
|---|---|
| Nome, ruolo, bio breve e lunga, link (email, Scholar, ORCID, GitHub, LinkedIn, CV) | `src/data/profile.yaml` |
| Pubblicazioni | `src/data/publications.bib` |
| News | `src/data/news.yaml` |
| Linee di ricerca (testi, immagini, paper collegati) | `src/data/research.yaml` |
| Progetti | `src/data/projects.yaml` |
| Service (workshop, revisioni, comitati, talk) | `src/data/service.yaml` |
| Corsi, tesi supervisionate, proposte di tesi | `src/data/teaching.yaml` |
| Foto, CV in PDF, figure | cartella `public/` |

Ogni file ha in cima un commento che spiega i campi.

### Aggiungere una pubblicazione
Apri `publications.bib`, copia una voce esistente e modificala. Oltre ai campi BibTeX standard puoi usare:

- `pubtype` – `journal`, `review`, `conference`, `workshop`, `chapter`, `preprint`, `edited`, `thesis` (serve per i filtri)
- `abbr` – sigla della venue mostrata come etichetta (es. `IEEE ISBI`)
- `selected = {true}` – compare tra le "Selected publications" in home
- `pdf`, `code`, `arxiv`, `url` – link ai pulsanti PDF / Code / arXiv / Web

Il tuo nome viene messo in grassetto automaticamente. Questi campi extra vengono tolti dal BibTeX mostrato ai visitatori.
Puoi anche esportare il BibTeX da Scopus/Scholar e aggiungere solo `pubtype` e `abbr`.

### Aggiungere una news
In `news.yaml` aggiungi in qualunque punto:

```yaml
- date: 2026-12-01
  tag: talk
  text: Invited talk at [Nome evento](https://...) on cell graphs.
```

La home mostra le 5 più recenti; c'è anche un feed RSS (`/feed.xml`).

### Proposte di tesi
In `teaching.yaml` le proposte con `draft: true` sono visibili solo nell'anteprima locale, con l'etichetta "Bozza".
Metti `draft: false` per pubblicarle.

### Foto e immagini
- **Foto**: salva un JPG verticale (circa 600×750 px) come `public/images/profile.jpg`. Finché manca, compaiono le iniziali.
- **Figure di ricerca**: metti i file in `public/images/research/` e scrivi il percorso nel campo `image` di `research.yaml`
  (es. `images/research/nulite.png`), con una descrizione in `image_alt`. Se `image` è vuoto viene usata l'illustrazione schematica integrata.
- **CV**: sostituisci `public/cv/Cristian_Tommasino_CV.pdf` mantenendo lo stesso nome.
- **Anteprima social** (`public/og.png`): se cambi nome o ruolo, rigenerala con `python scripts/make-og.py`.

## Aggiornamenti automatici (ogni lunedì)

Il workflow `.github/workflows/update-data.yml` gira ogni lunedì alle 5:00 UTC (oppure a mano da
**Actions → Update data → Run workflow**) ed esegue `scripts/update-data.mjs`, che usa
[OpenAlex](https://openalex.org) tramite il tuo ORCID:

- **h-index e citazioni**: aggiorna `src/data/metrics.json`; se i numeri cambiano li salva direttamente
  e il sito si ripubblica da solo. In home compaiono con la nota "OpenAlex, mese anno".
  Per usare numeri tuoi (es. Scopus) scrivi il valore in `stats` di `profile.yaml` al posto di `auto:...`.
- **Nuove pubblicazioni**: confronta i tuoi lavori su OpenAlex con `publications.bib` (per DOI, arXiv o titolo)
  e apre una **pull request** con le voci mancanti, scaricate da doi.org. Controlla autori, venue e `pubtype`,
  aggiungi se vuoi `abbr`, `code`, `pdf`, poi fai *Merge*: a quel punto vanno online.

Perché il workflow possa aprire le pull request va abilitato una volta:
**Settings → Actions → General → Workflow permissions →** "Read and write permissions" e
"Allow GitHub Actions to create and approve pull requests" (nel repository, e se richiesto anche nelle
impostazioni dell'organizzazione).

In locale: `node scripts/update-data.mjs --dry-run` mostra cosa cambierebbe senza modificare i file.

## Pubblicare su GitHub Pages (la prima volta)

Il sito è ospitato da un'organizzazione GitHub gratuita, `cristiantommasino`, così l'indirizzo è
`https://cristiantommasino.github.io` senza rinominare l'account personale `cristian921`.

1. Crea l'organizzazione: su GitHub, **+ → New organization → Free**, nome `cristiantommasino`,
   "My personal account" come proprietario.
2. Nell'organizzazione crea un repository **pubblico** e **vuoto** (senza README) chiamato esattamente
   `cristiantommasino.github.io`.
3. Dalla cartella del progetto:
   ```bash
   git remote add origin https://github.com/cristiantommasino/cristiantommasino.github.io.git
   git push -u origin main
   ```
4. Nel repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. Il workflow `.github/workflows/deploy.yml` parte a ogni push; dopo 1–2 minuti il sito è online
   (lo stato si vede nella scheda **Actions**).

Con un repository di nome diverso (es. `website`) il sito sarebbe su
`https://cristiantommasino.github.io/website/`: funziona comunque, i link si adattano da soli.

### Dominio personalizzato (facoltativo)
In **Settings → Pages → Custom domain** inserisci il dominio (es. `cristiantommasino.it`) e configura il DNS
come indicato da GitHub. Non serve cambiare il codice: il workflow usa automaticamente l'indirizzo giusto.

## Aggiornare il sito

**Dal browser (senza installare nulla):** apri il file su github.com, clicca la matita ✏️, modifica e fai
*Commit changes*. Il sito si aggiorna da solo in 1–2 minuti. Se qualcosa non va, la scheda **Actions** mostra l'errore
(di solito una virgola o una parentesi graffa mancante nel `.bib`, o un'indentazione sbagliata nello YAML).

**In locale (per vedere l'anteprima prima di pubblicare):** installa [Node.js](https://nodejs.org) 22 o superiore, poi:

```bash
npm install
npm run dev
```

e apri http://localhost:4321. Con `npm run build` generi la versione finale nella cartella `dist/`.

## Struttura del codice

```
src/
  data/        contenuti modificabili (YAML + BibTeX)
  lib/         lettura dei dati e parser BibTeX
  components/  pezzi riutilizzabili (pubblicazione, news, icone, figure)
  layouts/     struttura comune delle pagine (header, footer, SEO)
  pages/       una pagina per sezione
  styles/      colori, caratteri e layout (palette H&E, tema chiaro/scuro)
public/        file copiati così come sono (favicon, og.png, CV, immagini)
```

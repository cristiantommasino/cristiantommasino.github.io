// Weekly data update (run by .github/workflows/update-data.yml, or locally with `npm run update-data`).
//
// 1. Citation metrics: reads h-index and citation count from OpenAlex (found via your ORCID)
//    and writes src/data/metrics.json (only when the numbers change).
// 2. New publications: lists your works on OpenAlex, finds those not yet in publications.bib
//    (by DOI, arXiv id or title), downloads their BibTeX from doi.org and appends them to
//    publications.bib under an "auto-imported" heading. The workflow opens a pull request
//    with them, so you can check authors, venue and pubtype before they go online.
//
// Options:  --dry-run   print what would change without writing files
//
// Requires Node 23.6+ (imports the TypeScript BibTeX parser directly).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { parseBibtex, cleanLatex } from '../src/lib/bibtex.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src', 'data');
const BIB = path.join(DATA, 'publications.bib');
const METRICS = path.join(DATA, 'metrics.json');
const DRY = process.argv.includes('--dry-run');
const UA = { 'User-Agent': 'academic-website-data-updater' };

// OpenAlex work types worth listing as publications (software, datasets, errata… are skipped).
const TYPE_MAP = {
  article: 'journal',
  review: 'review',
  'conference-paper': 'conference',
  'book-chapter': 'chapter',
  book: 'chapter',
  preprint: 'preprint',
};

const profile = yaml.load(fs.readFileSync(path.join(DATA, 'profile.yaml'), 'utf-8'));
const orcid = (profile.links?.orcid || '').match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/)?.[0];
if (!orcid) {
  console.error('No ORCID found in profile.yaml (links.orcid).');
  process.exit(1);
}

async function getJson(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const norm = (s = '') =>
  cleanLatex(s)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// ------------------------------------------------------------------ 1. metrics
const author = await getJson(`https://api.openalex.org/authors/orcid:${orcid}`);
const metrics = {
  source: 'OpenAlex',
  updated: new Date().toISOString().slice(0, 10),
  h_index: author.summary_stats?.h_index ?? null,
  citations: author.cited_by_count ?? null,
  works: author.works_count ?? null,
};
let old = {};
try {
  old = JSON.parse(fs.readFileSync(METRICS, 'utf-8'));
} catch {}
const metricsChanged = old.h_index !== metrics.h_index || old.citations !== metrics.citations;
console.log(`Metrics (OpenAlex): h-index ${metrics.h_index}, citations ${metrics.citations}${metricsChanged ? ' (changed)' : ' (unchanged)'}`);
if (metricsChanged && !DRY) fs.writeFileSync(METRICS, JSON.stringify(metrics, null, 2) + '\n');

// ------------------------------------------------------------------ 2. publications
const bibSrc = fs.readFileSync(BIB, 'utf-8');
const entries = parseBibtex(bibSrc);
const knownDois = new Set(entries.map((e) => (e.fields.doi || '').toLowerCase()).filter(Boolean));
const knownArxiv = new Set(entries.map((e) => e.fields.arxiv || e.fields.eprint || '').filter(Boolean));
const knownTitles = new Set(entries.map((e) => norm(e.fields.title)));
const knownKeys = new Set(entries.map((e) => e.key));

let works = [];
let cursor = '*';
while (cursor) {
  const page = await getJson(
    `https://api.openalex.org/works?filter=author.orcid:${orcid}&per-page=200&cursor=${encodeURIComponent(cursor)}` +
      '&select=id,doi,title,publication_year,type,authorships,primary_location',
  );
  works = works.concat(page.results);
  cursor = page.meta.next_cursor;
}

const fresh = works.filter((w) => {
  if (!TYPE_MAP[w.type] || !w.doi) return false;
  const doi = w.doi.replace('https://doi.org/', '').toLowerCase();
  const arxiv = doi.match(/^10\.48550\/arxiv\.(.+)$/)?.[1];
  return !knownDois.has(doi) && !(arxiv && knownArxiv.has(arxiv)) && !knownTitles.has(norm(w.title));
});

function makeKey(w) {
  const first = (w.authorships?.[0]?.author?.display_name || 'anon').split(' ').pop().toLowerCase().replace(/[^a-z]/g, '');
  const word = norm(w.title).split(' ').find((t) => t.length > 3) || 'paper';
  let key = `${first}${w.publication_year}${word}`;
  for (let i = 2; knownKeys.has(key); i++) key = `${first}${w.publication_year}${word}${i}`;
  knownKeys.add(key);
  return key;
}

function field(name, value) {
  return value ? `  ${name.padEnd(9)} = {${String(value).replace(/\s+/g, ' ').trim()}},` : null;
}

async function toBibtex(w) {
  const doi = w.doi.replace('https://doi.org/', '');
  const type = TYPE_MAP[w.type];
  let f = {};
  let bibType = { journal: 'article', review: 'article', conference: 'inproceedings', chapter: 'incollection', preprint: 'misc' }[type];
  // Prefer the publisher's metadata (Crossref/DataCite content negotiation).
  try {
    const res = await fetch(`https://doi.org/${doi}`, { headers: { ...UA, Accept: 'application/x-bibtex' } });
    if (res.ok) {
      const parsed = parseBibtex(await res.text())[0];
      if (parsed) {
        f = parsed.fields;
        if (['article', 'inproceedings', 'incollection', 'misc'].includes(parsed.type)) bibType = parsed.type;
      }
    }
  } catch {}
  const authors =
    f.author ||
    (w.authorships || [])
      .map((a) => a.author?.display_name)
      .filter(Boolean)
      .join(' and ');
  const venue = w.primary_location?.source?.display_name;
  const lines = [
    `@${bibType}{${makeKey(w)},`,
    field('author', authors),
    field('title', f.title || w.title),
    bibType === 'article' ? field('journal', f.journal || venue) : field('booktitle', f.booktitle || f.series || venue),
    field('volume', f.volume),
    field('number', f.number),
    field('pages', f.pages),
    field('publisher', bibType === 'incollection' ? f.publisher : null),
    field('year', f.year || w.publication_year),
    field('doi', doi),
    field('pubtype', type),
    field('abbr', ''),
  ].filter(Boolean);
  lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
  return `${lines.join('\n')}\n}`;
}

if (!fresh.length) {
  console.log('Publications: nothing new on OpenAlex.');
} else {
  console.log(`Publications: ${fresh.length} new on OpenAlex:`);
  const blocks = [];
  for (const w of fresh) {
    console.log(`  + ${w.publication_year} ${w.title}`);
    blocks.push(await toBibtex(w));
  }
  const header =
    `\n% ----------------------------------------------------------------------\n` +
    `% Auto-imported from OpenAlex on ${metrics.updated}: check authors, venue,\n` +
    `% pubtype and add abbr / code / pdf before merging.\n` +
    `% ----------------------------------------------------------------------\n\n`;
  const out = bibSrc.replace(/\s*$/, '\n') + header + blocks.join('\n\n') + '\n';
  if (DRY) console.log('\n' + header + blocks.join('\n\n'));
  else fs.writeFileSync(BIB, out);
}

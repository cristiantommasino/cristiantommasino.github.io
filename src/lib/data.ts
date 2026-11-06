// Loads the editable content in src/data/ at build time.
// Files are imported with ?raw so the dev server reloads the page when they change.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { parseBibtex, cleanLatex, splitAuthors, publicBibtex } from './bibtex';
import profileSrc from '../data/profile.yaml?raw';
import researchSrc from '../data/research.yaml?raw';
import projectsSrc from '../data/projects.yaml?raw';
import serviceSrc from '../data/service.yaml?raw';
import teachingSrc from '../data/teaching.yaml?raw';
import newsSrc from '../data/news.yaml?raw';
import bibSrc from '../data/publications.bib?raw';
import metricsData from '../data/metrics.json';

function readYaml<T>(src: string): T {
  return yaml.load(src) as T;
}

// ---------------------------------------------------------------- types

export interface Link {
  label: string;
  url: string;
}

export interface Profile {
  name: string;
  author_match: { last: string; first_initial: string };
  role: string;
  department: string;
  department_short: string;
  university: string;
  lab: string;
  lab_url: string;
  address: string[];
  tagline: string;
  photo: string;
  photo_alt: string;
  seo_description: string;
  bio_short: string;
  bio_long: string[];
  collaborating_labs?: { name: string; url: string; description: string }[];
  languages?: string[];
  research_interests?: string[];
  stats?: { value: string; label: string; note?: string }[];
  experience: TimelineItem[];
  education: TimelineItem[];
  links: Record<string, string>;
}

export interface TimelineItem {
  when: string;
  what: string;
  where: string;
  detail?: string;
}

export interface NewsItem {
  date: string;
  text: string;
  tag?: string;
}

export interface ResearchLine {
  id: string;
  title: string;
  short: string;
  description: string;
  keywords: string[];
  figure: string;
  image: string;
  image_alt: string;
  papers: string[];
  code?: Link[];
}

export interface Project {
  title: string;
  kind: string;
  status?: string;
  period: string;
  description: string;
  links: Link[];
  papers?: string[];
}

export interface ServiceGroup {
  group: string;
  items: { what: string; when?: string; detail?: string }[];
}

export interface Course {
  name: string;
  credits?: string;
  programme: string;
  years?: string;
  url?: string;
}

export interface Teaching {
  courses: Course[];
  assistance?: Course[];
  supervision: {
    summary: string;
    theses: { student: string; level: string; title: string; year: string; role: string }[];
  };
  proposals_intro: string;
  proposals: { title: string; level: string; draft?: boolean; description: string; skills?: string[] }[];
}

export interface Author {
  name: string;
  me: boolean;
}

export interface Publication {
  key: string;
  type: string; // journal | review | conference | workshop | chapter | preprint | edited | thesis
  title: string;
  authors: Author[];
  authorRole: 'authors' | 'editors';
  venue: string;
  details: string;
  abbr: string;
  year: number;
  selected: boolean;
  links: Link[];
  bibtex: string;
}

// ---------------------------------------------------------------- loaders

export const profile = readYaml<Profile>(profileSrc);
export const research = readYaml<ResearchLine[]>(researchSrc);
// Citation metrics written by scripts/update-data.mjs.
export const metrics: { source: string; updated: string; h_index: number | null; citations: number | null } = metricsData;

export const projects = readYaml<Project[]>(projectsSrc);
export const service = readYaml<ServiceGroup[]>(serviceSrc);
export const teaching = readYaml<Teaching>(teachingSrc);

// YAML turns full dates (2026-10-23) into Date objects; keep everything as "YYYY[-MM[-DD]]" strings.
const dateString = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

export const news: NewsItem[] = readYaml<NewsItem[]>(newsSrc)
  .map((n) => ({ ...n, date: dateString(n.date) }))
  .sort((a, b) => b.date.localeCompare(a.date));

export const PUB_TYPES: Record<string, string> = {
  journal: 'Journal',
  review: 'Review',
  conference: 'Conference',
  workshop: 'Workshop',
  chapter: 'Book chapter',
  preprint: 'Preprint',
  edited: 'Edited volume',
  thesis: 'Thesis',
};

function isMe(first: string, last: string): boolean {
  const m = profile.author_match;
  return (
    last.toLowerCase() === m.last.toLowerCase() &&
    first.trim().toUpperCase().startsWith(m.first_initial.toUpperCase())
  );
}

// "Giovanni Maria" -> "G. M." so that all author lists look alike (imported entries use full names).
function initials(first: string): string {
  return first
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.split('-').map((p) => (/^\p{L}\.$/u.test(p) ? p : `${p[0]}.`)).join('-'))
    .join(' ');
}

function toPublication(e: ReturnType<typeof parseBibtex>[number]): Publication {
  const f = e.fields;
  const people = f.author || f.editor || '';
  const authors = splitAuthors(people).map((a) => ({
    name: `${initials(a.first)} ${a.last}`.trim(),
    me: isMe(a.first, a.last),
  }));

  const venue = cleanLatex(f.journal || f.booktitle || f.series || f.school || (f.archiveprefix === 'arXiv' ? 'arXiv preprint' : '') || f.publisher || '');
  const details = [
    f.volume ? `vol. ${f.volume}` : '',
    f.number ? `no. ${f.number}` : '',
    f.pages ? `pp. ${cleanLatex(f.pages)}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const links: Link[] = [];
  const arxiv = f.arxiv || (f.archiveprefix === 'arXiv' ? f.eprint : '');
  if (f.pdf) links.push({ label: 'PDF', url: f.pdf });
  else if (arxiv) links.push({ label: 'PDF', url: `https://arxiv.org/pdf/${arxiv}` });
  if (arxiv) links.push({ label: 'arXiv', url: `https://arxiv.org/abs/${arxiv}` });
  if (f.code) links.push({ label: 'Code', url: f.code });
  if (f.doi) links.push({ label: 'DOI', url: `https://doi.org/${f.doi}` });
  if (f.url) links.push({ label: 'Web', url: f.url });

  return {
    key: e.key,
    type: f.pubtype || 'conference',
    title: cleanLatex(f.title),
    authors,
    authorRole: f.author ? 'authors' : 'editors',
    venue,
    details,
    abbr: cleanLatex(f.abbr || ''),
    year: parseInt(f.year, 10) || 0,
    selected: (f.selected || '').toLowerCase() === 'true',
    links,
    bibtex: publicBibtex(e),
  };
}

export const publications: Publication[] = parseBibtex(bibSrc)
  .map(toPublication)
  .sort((a, b) => b.year - a.year);

export const pubByKey = new Map(publications.map((p) => [p.key, p]));

// ---------------------------------------------------------------- helpers

// Prefix an internal path with the configured base (needed for project pages on GitHub Pages).
export function url(p: string = ''): string {
  if (/^(https?:|mailto:|#)/.test(p)) return p;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${p.replace(/^\//, '')}`;
}

// Very small inline Markdown: [label](url), *italic*, plus HTML escaping.
export function inlineMd(s: string = ''): string {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
      const ext = /^https?:/.test(href);
      return `<a href="${url(href)}"${ext ? ' rel="noopener"' : ''}>${label}</a>`;
    })
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(d: string): string {
  const [y, m, day] = d.split('-');
  if (day) return `${MONTHS[+m - 1]} ${+day}, ${y}`;
  if (m) return `${MONTHS[+m - 1]} ${y}`;
  return y;
}

export function photoExists(): boolean {
  return fs.existsSync(path.resolve(process.cwd(), 'public', profile.photo));
}

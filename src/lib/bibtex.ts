// Minimal BibTeX parser: enough for a hand-maintained publications file.
// Handles @type{key, field = {..} | ".." | number}, nested braces and % comments.

export interface BibEntry {
  type: string;
  key: string;
  fields: Record<string, string>;
  raw: string;
}

// Fields used only by the website, stripped from the BibTeX shown to visitors.
export const SITE_FIELDS = ['pubtype', 'abbr', 'selected', 'pdf', 'code', 'arxiv', 'award'];

export function parseBibtex(src: string): BibEntry[] {
  const entries: BibEntry[] = [];
  let i = 0;
  while (i < src.length) {
    const at = src.indexOf('@', i);
    if (at === -1) break;
    // Skip "@" inside % comment lines.
    const lineStart = src.lastIndexOf('\n', at) + 1;
    if (src.slice(lineStart, at).trimStart().startsWith('%')) {
      i = at + 1;
      continue;
    }
    const open = src.indexOf('{', at);
    if (open === -1) break;
    const type = src.slice(at + 1, open).trim().toLowerCase();
    // Find the matching closing brace of the entry.
    let depth = 0;
    let end = open;
    for (; end < src.length; end++) {
      const c = src[end];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = src.slice(open + 1, end);
    i = end + 1;
    if (type === 'comment' || type === 'preamble' || type === 'string') continue;

    const comma = body.indexOf(',');
    const key = body.slice(0, comma).trim();
    const fields = parseFields(body.slice(comma + 1));
    entries.push({ type, key, fields, raw: src.slice(at, end + 1) });
  }
  return entries;
}

function parseFields(s: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let i = 0;
  while (i < s.length) {
    const eq = s.indexOf('=', i);
    if (eq === -1) break;
    const name = s.slice(i, eq).replace(/[,\s]/g, '').toLowerCase();
    let j = eq + 1;
    while (/\s/.test(s[j])) j++;
    let value = '';
    if (s[j] === '{') {
      let depth = 0;
      let k = j;
      for (; k < s.length; k++) {
        if (s[k] === '{') depth++;
        else if (s[k] === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      value = s.slice(j + 1, k);
      i = k + 1;
    } else if (s[j] === '"') {
      const k = s.indexOf('"', j + 1);
      value = s.slice(j + 1, k);
      i = k + 1;
    } else {
      const m = /^[^,\n]+/.exec(s.slice(j));
      value = m ? m[0].trim() : '';
      i = j + value.length;
    }
    if (name) fields[name] = value.replace(/\s+/g, ' ').trim();
  }
  return fields;
}

// Convert common LaTeX escapes to plain text for display.
export function cleanLatex(s: string = ''): string {
  return s
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\_/g, '_')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/[{}]/g, '')
    .trim();
}

// "Last, F. and Other, A. B." -> [{ last, first }]
export function splitAuthors(s: string = ''): { first: string; last: string }[] {
  return s
    .split(/\s+and\s+/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      if (a.includes(',')) {
        const [last, first] = a.split(',').map((p) => p.trim());
        return { first: cleanLatex(first), last: cleanLatex(last) };
      }
      const parts = a.split(/\s+/);
      const last = parts.pop() || '';
      return { first: cleanLatex(parts.join(' ')), last: cleanLatex(last) };
    });
}

// BibTeX shown to visitors: the original entry without site-only fields.
export function publicBibtex(entry: BibEntry): string {
  const lines = entry.raw.split('\n');
  const kept = lines.filter((line) => {
    const m = /^\s*([A-Za-z]+)\s*=/.exec(line);
    return !(m && SITE_FIELDS.includes(m[1].toLowerCase()));
  });
  // Make sure the last field does not end with a dangling comma.
  let out = kept.join('\n');
  out = out.replace(/,(\s*)\}\s*$/, '$1}');
  return out.trim();
}

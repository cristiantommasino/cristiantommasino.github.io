// Prints the /cv/ page of the built site (dist/) to PDF with headless Chrome or Edge.
//   node scripts/make-cv-pdf.mjs            -> dist/cv/Cristian_Tommasino_CV.pdf
//   node scripts/make-cv-pdf.mjs --public   -> also copies it to public/cv/ (to commit it)
// Run `npm run build` first. Set CHROME_PATH if the browser is not found automatically.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const FILE = 'Cristian_Tommasino_CV.pdf';
const OUT = path.join(DIST, 'cv', FILE);

if (!fs.existsSync(path.join(DIST, 'cv', 'index.html'))) {
  console.error('dist/cv/index.html not found: run `npm run build` first.');
  process.exit(1);
}

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const browser = candidates.find((p) => fs.existsSync(p));
if (!browser) {
  console.error('Chrome/Edge not found. Set CHROME_PATH to the browser executable.');
  process.exit(1);
}

// Serve dist/ under the site's base path so that fonts and styles resolve as on the live site.
const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith(base)) p = '/' + p.slice(base.length);
  let file = path.join(DIST, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!file.startsWith(DIST) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}${base}cv/`;

// Async on purpose: the browser fetches the page from the server running in this same process.
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-pdf-'));
try {
  fs.rmSync(OUT, { force: true });
  await promisify(execFile)(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      `--user-data-dir=${profileDir}`,
      '--no-pdf-header-footer',
      '--virtual-time-budget=8000',
      `--print-to-pdf=${OUT}`,
      url,
    ],
    { timeout: 120000 },
  );
} finally {
  server.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
}

if (!fs.existsSync(OUT)) {
  console.error('PDF was not created.');
  process.exit(1);
}
console.log(`Written ${path.relative(ROOT, OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
if (process.argv.includes('--public')) {
  fs.copyFileSync(OUT, path.join(ROOT, 'public', 'cv', FILE));
  console.log(`Copied to public/cv/${FILE}`);
}

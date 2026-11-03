import type { APIContext } from 'astro';
import { news, profile, url } from '../lib/data';

// RSS feed of the news items.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*([^*]+)\*/g, '$1');

export function GET({ site }: APIContext) {
  const home = new URL(url(''), site).toString();
  const newsPage = new URL(url('news/'), site).toString();
  const items = news
    .map((n) => {
      const [y, m = '01', d = '01'] = n.date.split('-');
      const date = new Date(Date.UTC(+y, +m - 1, +d)).toUTCString();
      const text = plain(n.text);
      return `<item><title>${esc(text.length > 90 ? text.slice(0, 87) + '…' : text)}</title><link>${newsPage}</link><guid isPermaLink="false">${esc(n.date + ' ' + text.slice(0, 40))}</guid><pubDate>${date}</pubDate><description>${esc(text)}</description></item>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(profile.name)} · News</title><link>${home}</link><description>${esc(profile.seo_description)}</description><language>en</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}

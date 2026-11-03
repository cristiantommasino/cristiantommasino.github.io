import type { APIContext } from 'astro';
import { url } from '../lib/data';

export function GET({ site }: APIContext) {
  const sitemap = new URL(url('sitemap-index.xml'), site).toString();
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_URL / BASE_PATH are set by the GitHub Pages workflow.
// With a repository named "<username>.github.io" the base path is "/".
const site = process.env.SITE_URL || 'https://cristiantommasino.github.io';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  // The printable CV page is only the source of the PDF, so keep it out of the sitemap.
  integrations: [sitemap({ filter: (page) => !page.includes('/cv/') })],
});

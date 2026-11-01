// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// SITE is the public address once the GitHub Pages repository exists.
// Every page sits at the root (build.format 'file') and every link is relative,
// so the same build works on GitHub Pages and in a preview.
const SITE = process.env.SITE_URL || 'https://iamshu21.github.io/explorendmu/';

export default defineConfig({
  site: SITE,
  build: { format: 'file', assets: 'assets', inlineStylesheets: 'auto' },
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});

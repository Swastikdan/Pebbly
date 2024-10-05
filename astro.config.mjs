import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel/serverless';
import tailwind from '@astrojs/tailwind';

import sitemap from '@astrojs/sitemap';

// import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  site: 'https://film-fanatic.vercel.app',
  integrations: [react(), tailwind(), sitemap()],
  output: 'server',

  adapter: vercel(),
  // output: "server",
  // adapter: node({
  //   mode: "standalone"
  // })
});

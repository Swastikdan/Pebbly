import type { APIRoute } from 'astro';

const robotsTxt = `
User-agent: *
Disallow: /

User-agent: AdsBot-Google
Disallow: /

User-agent: AdsBot-Google-Mobile
Disallow: /

User-agent: Mediapartners-Google
Disallow: /

User-agent: Googlebot-Image
Disallow: /

User-agent: Googlebot-Video
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: facebookexternalhit
Disallow: /

Sitemap: ${new URL('sitemap-index.xml', import.meta.env.SITE).href}`.trim();

export const GET: APIRoute = () => {
  console.log(robotsTxt);
  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};

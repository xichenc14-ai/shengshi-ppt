import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/account'],
    },
    sitemap: 'https://shengxinppt.lol/sitemap.xml',
  };
}

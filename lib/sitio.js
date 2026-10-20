// Dirección pública de la app. No usa dominio propio: toma la dirección de Vercel automáticamente.
export function siteUrl(request) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(request.url).origin;
}

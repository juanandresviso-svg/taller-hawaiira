// Versión de la app: cambia con cada publicación en Vercel (commit) y sirve para avisar que hay una actualización.
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || String(Date.now());

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { APP_VERSION },
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
      { source: '/api/version', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};
export default nextConfig;

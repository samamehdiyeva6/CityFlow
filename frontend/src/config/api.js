const normalizeBaseUrl = (value = '') => String(value).trim().replace(/\/+$/, '');

const envBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL || '');

export const API_BASE_URL = envBaseUrl || (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000');

if (import.meta.env.PROD && !envBaseUrl) {
  console.error('VITE_API_URL is not set. Configure it in frontend Vercel Environment Variables.');
}

export const requireConfiguredApiBaseUrl = () => {
  if (import.meta.env.PROD && !envBaseUrl) {
    throw new Error('VITE_API_URL is required in production for separate frontend/backend deployments.');
  }
};

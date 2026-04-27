const normalizeBaseUrl = (value = '') => String(value).trim().replace(/\/+$/, '');

const envBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL || '');

export const API_BASE_URL = envBaseUrl || (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000');

if (import.meta.env.PROD && !envBaseUrl) {
  // In separate frontend/backend deployments, configure VITE_API_URL in Vercel.
  console.warn('VITE_API_URL is not set. API calls will target the frontend origin.');
}

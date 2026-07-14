export async function loadRuntimeConfig(): Promise<void> {
  // Minimal runtime config loader stub. Extend this to fetch runtime settings
  // from a JSON file or an API if needed.
  return Promise.resolve();
}

export function getAPIBaseURL(): string {
  // If VITE_API_BASE_URL is provided, use it. Otherwise default to the
  // frontend origin for production, and to the local backend during
  // development so API calls target the backend server.
  const envUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL)?.trim();
  if (envUrl) return envUrl;

  // During local development, prefer localhost:8000 as the backend API.
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalhost) return 'http://localhost:8000';

  return window.location.origin;
}


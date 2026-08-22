import { Capacitor } from '@capacitor/core';

/**
 * Returns the base URL for Express backend API calls.
 * 
 * In standard web browser deployments:
 * - If VITE_API_BASE_URL is not set (or empty), returns '' to preserve same-origin relative URLs (/api/...).
 * - If VITE_API_BASE_URL is explicitly configured, returns the sanitized base URL without trailing slashes.
 * 
 * In Capacitor Android / Native deployments:
 * - Returns VITE_API_BASE_URL (e.g. "https://ais-dev-qp2jvx7kxfynygoizqe7hn-200552382270.europe-west2.run.app")
 * - If VITE_API_BASE_URL is empty in native mode, logs a diagnostic warning and returns ''.
 */
export function getApiBaseUrl(): string {
  let envUrl = '';

  // Check Vite client-side environment
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
      envUrl = (import.meta as any).env.VITE_API_BASE_URL;
    }
  } catch {
    // Ignore error in environments without import.meta.env
  }

  // Check Node process.env (fallback for test/SSR environments)
  if (!envUrl && typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
    envUrl = process.env.VITE_API_BASE_URL;
  }

  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    let sanitized = envUrl.trim();
    // Strip accidental leading variable assignment prefixes if pasted into settings
    if (sanitized.startsWith('VITE_API_BASE_URL=')) {
      sanitized = sanitized.substring('VITE_API_BASE_URL='.length).trim();
    } else if (sanitized.startsWith('API_BASE_URL=')) {
      sanitized = sanitized.substring('API_BASE_URL='.length).trim();
    }
    return sanitized.replace(/\/+$/, '');
  }

  // If running in Capacitor native platform but no explicit base URL is set
  if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
    console.warn('[apiConfig] Running in Capacitor native mode without VITE_API_BASE_URL set. Administrative Express API calls may fail.');
  }

  return '';
}

/**
 * Builds a complete API URL from a relative API path.
 * Ensures correct slash formatting between base and path.
 * 
 * Examples:
 * Web (VITE_API_BASE_URL=""):
 *   buildApiUrl('/api/admin/create-teacher') -> '/api/admin/create-teacher'
 *   buildApiUrl('api/admin/create-teacher')  -> '/api/admin/create-teacher'
 * 
 * Android (VITE_API_BASE_URL="https://ais-dev-qp2jvx7kxfynygoizqe7hn-200552382270.europe-west2.run.app"):
 *   buildApiUrl('/api/admin/create-teacher') -> 'https://ais-dev-qp2jvx7kxfynygoizqe7hn-200552382270.europe-west2.run.app/api/admin/create-teacher'
 */
export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
}

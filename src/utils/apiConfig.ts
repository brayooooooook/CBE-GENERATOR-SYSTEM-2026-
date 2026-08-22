import { Capacitor } from '@capacitor/core';

export const DEFAULT_PRODUCTION_API_URL = 'https://ais-dev-vjz5hjkvehacv2o4u33hs2-1003257184143.europe-west2.run.app';

/**
 * Returns the base URL for Express backend API calls.
 * 
 * In standard web browser deployments:
 * - If VITE_API_BASE_URL is not set (or empty), returns '' to preserve same-origin relative URLs (/api/...).
 * - If VITE_API_BASE_URL is explicitly configured, returns the sanitized base URL without trailing slashes.
 * 
 * In Capacitor Android / Native deployments:
 * - Returns VITE_API_BASE_URL (e.g. "https://ais-dev-vjz5hjkvehacv2o4u33hs2-1003257184143.europe-west2.run.app")
 * - If VITE_API_BASE_URL is empty in native mode, defaults to the production Cloud API URL.
 */
export function getApiBaseUrl(): string {
  let envUrl = '';

  // 1. Check Vite client-side environment
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
      envUrl = (import.meta as any).env.VITE_API_BASE_URL;
    }
  } catch {
    // Ignore error in environments without import.meta.env
  }

  // 2. Check local storage if configured in settings
  try {
    if (!envUrl && typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('cbe_api_base_url');
      if (stored) envUrl = stored;
    }
  } catch {
    // Ignore localStorage access restrictions
  }

  // 3. Check Node process.env (fallback for test/SSR environments)
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

  // 4. In Capacitor Android / iOS Native context or file protocol:
  // If running in native platform or native app protocol, default to live cloud backend
  if (typeof window !== 'undefined') {
    const isCapacitorNative = typeof Capacitor !== 'undefined' && (
      (typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) ||
      (typeof Capacitor.getPlatform === 'function' && Capacitor.getPlatform() !== 'web')
    );
    const isNativeProtocol = window.location.protocol === 'capacitor:' || window.location.protocol === 'file:';

    if (isCapacitorNative || isNativeProtocol) {
      return DEFAULT_PRODUCTION_API_URL;
    }
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

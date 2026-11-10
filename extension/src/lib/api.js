// HTTP helpers for HoYoLAB / HoYoverse endpoints.
// Requests are sent from the extension with the browser's own cookies
// (credentials: 'include'); the extension never stores the cookie values.

import { md5 } from './md5.js';

// Public salt used by the HoYoLAB website to sign Battle Chronicle requests.
const DS_SALT = '6s25p5ox5y14umn1p61aqyyvbvvl3lrt';
const DS_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export class ApiError extends Error {
  constructor(message, { retcode = null, status = null, kind = 'error' } = {}) {
    super(message);
    this.retcode = retcode;
    this.status = status;
    this.kind = kind; // 'error' | 'auth' | 'network' | 'captcha' | 'disabled'
  }
}

export function generateDS() {
  const t = Math.floor(Date.now() / 1000);
  let r = '';
  for (let i = 0; i < 6; i++) r += DS_CHARS[Math.floor(Math.random() * DS_CHARS.length)];
  return `${t},${r},${md5(`salt=${DS_SALT}&t=${t}&r=${r}`)}`;
}

export function baseHeaders(lang = 'en-us') {
  return {
    'Accept': 'application/json, text/plain, */*',
    'x-rpc-app_version': '1.5.0',
    'x-rpc-client_type': '5',
    'x-rpc-language': lang,
  };
}

/**
 * Performs a request and returns the parsed HoYoLAB envelope ({ retcode, message, data }).
 * Throws ApiError on network/HTTP/JSON errors. Does NOT throw on non-zero retcode.
 */
export async function hoyoFetch(url, { method = 'GET', params = {}, body, headers = {}, timeoutMs = 15000 } = {}) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(u.toString(), {
      method,
      headers: body ? { 'Content-Type': 'application/json;charset=UTF-8', ...headers } : headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      cache: 'no-store',
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new ApiError(e.name === 'AbortError' ? 'Request timed out' : 'Network error', { kind: 'network' });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, { status: res.status, kind: 'network' });

  try {
    return await res.json();
  } catch {
    throw new ApiError('Invalid response from server', { status: res.status });
  }
}

// retcodes that mean "your HoYoLAB session is missing or expired"
export const AUTH_RETCODES = new Set([-100, 10001, -1071]);

export function isAuthError(json) {
  return AUTH_RETCODES.has(json?.retcode) || /log ?in|cookie/i.test(json?.message || '');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

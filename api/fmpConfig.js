// Configuración base para todas las APIs de FMP

const API_KEY = process.env.NEXT_PUBLIC_FMP_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_FMP_BASE_URL;

if (!API_KEY || !BASE_URL) {
  throw new Error('Las variables NEXT_PUBLIC_FMP_API_KEY y NEXT_PUBLIC_FMP_BASE_URL deben estar configuradas');
}

export function buildUrl(path, params = {}) {
  const base = (BASE_URL || "").replace(/\/+$/, "");
  const cleanPath = String(path).replace(/^\/+/, "");
  const u = new URL(`${base}/${cleanPath}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  });
  u.searchParams.set('apikey', API_KEY);
  return u.toString();
}

export function ensureArray(val) {
  return Array.isArray(val) ? val : [];
}

export function sortByDateDesc(arr) {
  return [...arr].sort((a, b) => {
    const da = a?.date ? new Date(a.date).getTime() : 0;
    const db = b?.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });
}

export { API_KEY, BASE_URL };
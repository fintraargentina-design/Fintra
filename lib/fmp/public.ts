// /lib/fmp/public.ts
// Cliente seguro para el navegador: SIEMPRE pega contra /api/fmp/* (server-side)

type Ratios = Array<any>;
type Growth = Array<any>;
type Profile = Array<any>;

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<T>;
}

export const fmp = {
  ratios(symbol: string) {
    return getJSON<Ratios>(`/api/fmp/ratios?symbol=${encodeURIComponent(symbol)}&limit=1`);
  },
  growth(symbol: string) {
    return getJSON<Growth>(`/api/fmp/growth?symbol=${encodeURIComponent(symbol)}&period=annual&limit=5`);
  },
  profile(symbol: string) {
    return getJSON<Profile>(`/api/fmp/profile?symbol=${encodeURIComponent(symbol)}`);
  },
};

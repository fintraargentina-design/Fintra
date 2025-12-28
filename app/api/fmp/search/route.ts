export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "";
  const limit = searchParams.get("limit") ?? "10";
  const exchange = searchParams.get("exchange");
  const apikey = process.env.FMP_API_KEY;

  const base = "https://financialmodelingprep.com/api/v3/search";
  const url = `${base}?query=${encodeURIComponent(query)}&limit=${limit}${exchange ? `&exchange=${exchange}` : ""}&apikey=${apikey}`;

  const r = await fetch(url);
  const data = await r.json();
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}
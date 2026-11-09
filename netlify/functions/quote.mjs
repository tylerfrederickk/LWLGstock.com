// GET /api/quote → last LWLG price for the portfolio tool (delayed; cached 1 min).
// Uses Yahoo Finance's public chart endpoint. If it ever changes, the portfolio tool falls back to manual entry.
export default async () => {
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/LWLG?interval=1d&range=5d', { headers: { 'User-Agent': 'Mozilla/5.0 (LWLG Investor Index)' } });
    if (!r.ok) throw new Error('quote ' + r.status);
    const d = await r.json();
    const m = d.chart.result[0].meta;
    return new Response(JSON.stringify({ symbol: m.symbol, price: m.regularMarketPrice, previousClose: m.chartPreviousClose, time: m.regularMarketTime, currency: m.currency }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30, s-maxage=60' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
};
export const config = { path: '/api/quote' };

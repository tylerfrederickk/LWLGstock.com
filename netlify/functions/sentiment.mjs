// /api/sentiment: the "sentiment weather" (#18). Reads the latest snapshot saved by sentiment-cron; if none yet, computes one live.
import { getStore } from '@netlify/blobs';
import { snapshot } from './_sentiment.mjs';
export default async () => {
  const store = getStore('sentiment');
  let s = await store.get('latest', { type: 'json' });
  if (!s || Date.now() - s.t > 3 * 3600e3) { try { s = await snapshot(); await store.setJSON('latest', s); } catch (e) { if (!s) return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 502 }); } }
  const hist = (await store.get('history', { type: 'json' })) || [];
  return new Response(JSON.stringify({ ...s, history: hist.slice(-7) }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } });
};
export const config = { path: '/api/sentiment' };

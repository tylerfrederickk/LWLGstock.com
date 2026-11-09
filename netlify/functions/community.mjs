// /api/community: shared state for the Bull vs Bear poll (#22), the "I was here" wall (#21) and the prediction board (#19).
// GET  → { poll, pins, predictions }
// POST → { action: 'vote', side: 'bull'|'bear' } | { action: 'pin', lat, lon, year } | { action: 'predict', q, name, guess }
// One action of each kind per visitor per day (visitor = salted hash of IP; the IP itself is never stored).
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const day = () => new Date().toISOString().slice(0, 10);
const QS = ['stage3_nov', 'cash_q3', 'stage4_date', 'price_dec31'];
const clean = s => String(s || '').replace(/[^\p{L}\p{N} ._'-]/gu, '').trim().slice(0, 20);
const BAD = /(fuck|shit|cunt|nigg|fag|bitch|whore|rape|nazi)/i;

export default async (req, ctx) => {
  const store = getStore({ name: 'community', consistency: 'strong' });
  const get = async (k, d) => (await store.get(k, { type: 'json' })) ?? d;
  if (req.method === 'GET') {
    const [poll, pins, preds] = await Promise.all([get('poll/' + day(), { bull: 0, bear: 0 }), get('pins', []), get('predictions', {})]);
    return J({ poll: { ...poll, date: day() }, pins, predictions: preds });
  }
  if (req.method !== 'POST') return J({ error: 'method' }, 405);
  let b; try { b = await req.json(); } catch { return J({ error: 'bad json' }, 400); }
  const ip = ctx.ip || req.headers.get('x-nf-client-connection-ip') || '0';
  const who = createHash('sha256').update(ip + (process.env.COMMUNITY_SALT || 'lwlg-index')).digest('hex').slice(0, 20);
  const rlKey = `rl/${b.action}/${b.action === 'predict' ? b.q : day()}/${who}`;
  if (await store.get(rlKey)) return J({ error: 'already', message: b.action === 'predict' ? 'You already made a prediction for this one.' : 'Already counted today. Come back tomorrow.' }, 429);

  if (b.action === 'vote') {
    if (!['bull', 'bear'].includes(b.side)) return J({ error: 'side' }, 400);
    const k = 'poll/' + day(), p = await get(k, { bull: 0, bear: 0 }); p[b.side]++; await store.setJSON(k, p);
    await store.set(rlKey, '1'); return J({ ok: true, poll: { ...p, date: day() } });
  }
  if (b.action === 'pin') {
    const lat = +b.lat, lon = +b.lon, year = +b.year;
    if (!(lat >= -60 && lat <= 85 && lon >= -180 && lon <= 180 && year >= 2000 && year <= new Date().getFullYear())) return J({ error: 'range' }, 400);
    const pins = await get('pins', []); pins.push([Math.round(lon * 2) / 2, Math.round(lat * 2) / 2, year]);   // coarse: 0.5° only
    await store.setJSON('pins', pins.slice(-5000)); await store.set(rlKey, '1'); return J({ ok: true, count: pins.length });
  }
  if (b.action === 'predict') {
    if (!QS.includes(b.q)) return J({ error: 'q' }, 400);
    const name = clean(b.name), guess = String(b.guess || '').slice(0, 24);
    if (!name || BAD.test(name)) return J({ error: 'name', message: 'Please choose a different name.' }, 400);
    if (!guess) return J({ error: 'guess' }, 400);
    const preds = await get('predictions', {}); (preds[b.q] = preds[b.q] || []).push({ name, guess, t: Date.now() });
    preds[b.q] = preds[b.q].slice(-2000); await store.setJSON('predictions', preds); await store.set(rlKey, '1');
    return J({ ok: true });
  }
  return J({ error: 'action' }, 400);
};
export const config = { path: '/api/community' };

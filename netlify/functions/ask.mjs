// /api/ask: "Ask LWLG" (#25). Answers ONLY from this site's own sourced data files, using Claude.
// Set ANTHROPIC_API_KEY in Netlify (Site settings → Environment variables). Optional: ANTHROPIC_MODEL.
// Without a key it returns 503 and the page falls back to on-device search.
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
let CACHE = null;
async function corpus(base) {
  if (CACHE && Date.now() - CACHE.t < 3600e3) return CACHE.docs;
  const get = async f => { try { return await (await fetch(new URL('/data/' + f, base))).json(); } catch { return null; } };
  const [facts, faq, hist, tl, pat, inv, ind, cx, gl] = await Promise.all(['facts.json', 'faq.json', 'history.json', 'timeline.json', 'patents.json', 'investor.json', 'industry.json', 'connections.json', 'glossary.json'].map(get));
  const D = [], add = (title, text, url, page) => D.push({ title, text: String(text).slice(0, 1200), url: url || '', page });
  facts?.facts?.forEach(f => add('Fact: ' + f.label, f.value + (f.as_of ? ' (as of ' + f.as_of + ')' : ''), f.source, 'index.html'));
  (Array.isArray(faq) ? faq : []).forEach(q => add('FAQ: ' + q.q, q.a, q.link, 'faq.html'));
  hist?.promises?.forEach(p => add('Promise (' + p.said_on + ', ' + p.who + ')', p.promise + ' Target: ' + p.target + '. Status: ' + p.status + '. ' + (p.outcome || ''), p.source_said, 'promises.html'));
  hist?.quarterly?.forEach(q => add('Quarter ' + q.period, `Cash+securities $${q.cash_and_securities_usd}; shares ${q.shares_outstanding}; operating cash used $${q.operating_cash_used_quarter_usd}; net loss $${q.net_loss_usd}; revenue $${q.revenue_usd}`, q.source, 'trends.html'));
  tl?.milestones?.forEach(m => add('Milestone ' + m.date + ': ' + (m.title || ''), m.detail || m.summary || '', m.source || m.url, 'timeline.html'));
  pat?.patents?.forEach(p => add('Patent ' + p.number + ': ' + p.title, p.plain_english + ' ' + (p.why_it_matters || ''), p.url, 'patents.html'));
  if (inv) { add('Financial snapshot', JSON.stringify(inv.financial_snapshot), '', 'filings.html'); add('Short interest', JSON.stringify({ ...inv.short_interest, history: undefined }), '', 'trends.html'); add('Insider trades note', inv.insider_trades_note, '', 'filings.html'); inv.upcoming_events?.forEach(e => add('Upcoming: ' + e.date, e.event, '', 'catalysts.html')); }
  ind?.why_now?.forEach(w => add('Why now: ' + w.stat, w.detail, w.source, 'market.html'));
  cx?.links?.forEach(l => add((l.kind === 'confirmed' ? 'Confirmed: ' : l.kind === 'whatif' ? 'What-if (hypothetical): ' : 'UNVERIFIED rumour: ') + l.title, l.claim + ' What is known: ' + l.reality, l.url, 'connections.html'));
  (Array.isArray(gl) ? gl : []).forEach(g => add('Glossary: ' + g.term, g.definition, '', 'glossary.html'));
  CACHE = { t: Date.now(), docs: D }; return D;
}
const tok = s => String(s).toLowerCase().match(/[a-z0-9.%$]+/g) || [];
function retrieve(docs, q, k = 24) {
  const qs = new Set(tok(q).filter(w => w.length > 2 && !['the', 'and', 'what', 'how', 'does', 'lwlg', 'lightwave', 'logic', 'is', 'are', 'about', 'with', 'for'].includes(w)));
  return docs.map(d => { const t = tok(d.title + ' ' + d.text); let s = 0; t.forEach(w => { if (qs.has(w)) s += 1; }); tok(d.title).forEach(w => { if (qs.has(w)) s += 2; }); return [s, d]; }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, k).map(x => x[1]);
}
export default async (req, ctx) => {
  if (req.method !== 'POST') return J({ error: 'method' }, 405);
  const key = process.env.ANTHROPIC_API_KEY; if (!key) return J({ error: 'not configured' }, 503);
  let b; try { b = await req.json(); } catch { return J({ error: 'bad json' }, 400); }
  const q = String(b.q || '').slice(0, 500).trim(); if (!q) return J({ error: 'empty' }, 400);
  // gentle rate limit: 40 questions per visitor per day
  try {
    const store = getStore('ask'), who = createHash('sha256').update((ctx.ip || '0') + 'ask').digest('hex').slice(0, 20), k = `rl/${new Date().toISOString().slice(0, 10)}/${who}`;
    const n = +(await store.get(k) || 0); if (n >= 40) return J({ error: 'limit', answer: "You've hit today's question limit. Try again tomorrow." }, 429); await store.set(k, String(n + 1));
  } catch { }
  const docs = await corpus(req.url), hits = retrieve(docs, q);
  const ctxText = hits.map((d, i) => `[${i + 1}] ${d.title}\n${d.text}\n(source: ${d.url || 'this site'}; page: ${d.page})`).join('\n\n');
  const hist = (Array.isArray(b.history) ? b.history : []).slice(-6).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 1500) }));
  const system = `You are "Ask LWLG", the assistant on an independent investor website about Lightwave Logic (NASDAQ: LWLG). The site is not affiliated with the company.
Answer ONLY from the numbered context excerpts provided. If the context does not contain the answer, say you don't have that on the site and suggest the most relevant page.
Rules: be concise and plain-English (2-6 sentences, or a short list). Cite excerpts inline like [2]. Always flag anything labelled UNVERIFIED rumour or What-if as unconfirmed. Never give buy/sell/hold advice or price predictions; if asked, say you can't give financial advice and point to the facts. Never invent numbers, names, dates or customers.`;
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 600, system, messages: [...hist, { role: 'user', content: `Context excerpts:\n\n${ctxText || '(none matched)'}\n\nQuestion: ${q}` }] }) });
  if (!r.ok) return J({ error: 'upstream', status: r.status }, 502);
  const out = await r.json(), answer = (out.content || []).map(c => c.text || '').join('').trim();
  return J({ answer, sources: hits.map((d, i) => ({ n: i + 1, title: d.title, url: d.url, page: d.page })) });
};
export const config = { path: '/api/ask' };

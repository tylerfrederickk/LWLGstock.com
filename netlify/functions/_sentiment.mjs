// Pulls the latest public $LWLG messages from Stocktwits and counts the ones their authors tagged Bullish or Bearish.
// (Stocktwits users tag their own posts; untagged posts are ignored.) Reddit can be added with API credentials.
export async function snapshot() {
  const r = await fetch('https://api.stocktwits.com/api/2/streams/symbol/LWLG.json', { headers: { 'User-Agent': 'Mozilla/5.0 (LWLG Investor Index)' } });
  if (!r.ok) throw new Error('stocktwits ' + r.status);
  const d = await r.json(), msgs = d.messages || [];
  let bull = 0, bear = 0;
  for (const m of msgs) { const s = m.entities && m.entities.sentiment && m.entities.sentiment.basic; if (s === 'Bullish') bull++; else if (s === 'Bearish') bear++; }
  const tagged = bull + bear, score = tagged ? bull / tagged : 0.5;
  return { t: Date.now(), source: 'Stocktwits', sampled: msgs.length, bull, bear, score: +score.toFixed(3) };
}

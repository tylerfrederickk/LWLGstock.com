// Scheduled hourly: saves a sentiment snapshot and keeps one entry per day for the 7-day strip.
import { getStore } from '@netlify/blobs';
import { snapshot } from './_sentiment.mjs';
export default async () => {
  const store = getStore('sentiment');
  const s = await snapshot(); await store.setJSON('latest', s);
  const hist = (await store.get('history', { type: 'json' })) || [], d = new Date(s.t).toISOString().slice(0, 10);
  const i = hist.findIndex(h => h.date === d); const row = { date: d, score: s.score, bull: s.bull, bear: s.bear };
  if (i >= 0) hist[i] = row; else hist.push(row);
  await store.setJSON('history', hist.slice(-30));
};
export const config = { schedule: '@hourly' };

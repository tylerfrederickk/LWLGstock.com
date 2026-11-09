// GET /api/filings → latest LWLG SEC filings, straight from EDGAR (cached at the edge ~15 min).
import { recentFilings, json, fail } from './_sec.mjs';

export default async () => {
  try {
    const d = await recentFilings(80);
    return json({ updated: new Date().toISOString(), source: 'SEC EDGAR', ...d });
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/filings' };

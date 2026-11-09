// Shared helpers for SEC EDGAR. EDGAR asks every automated client to identify itself with a contact
// in the User-Agent. Set SEC_CONTACT in Netlify (Site settings → Environment variables), e.g. "you@yourdomain.com".
export const CIK = '1325964';
export const CIK10 = CIK.padStart(10, '0');
export const UA = `LWLG Investor Index (LWLGstock.com) ${process.env.SEC_CONTACT || 'contact@lwlgstock.com'}`;

export async function sec(url, as = 'json') {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
  if (!r.ok) throw new Error(`SEC ${r.status} for ${url}`);
  return as === 'json' ? r.json() : r.text();
}

const FORM_NAMES = {
  '10-K': 'Annual report', '10-Q': 'Quarterly report', '8-K': 'Current report (material event)',
  '4': 'Insider transaction (Form 4)', '3': 'Initial insider ownership (Form 3)', '5': 'Annual insider statement (Form 5)',
  'DEF 14A': 'Proxy statement', 'S-3': 'Shelf registration', 'S-3ASR': 'Automatic shelf registration', '424B5': 'Prospectus supplement',
  'SC 13G': 'Large holder (>5%) report', 'SC 13G/A': 'Large holder report (amended)', 'S-8': 'Employee stock plan registration',
  '144': 'Notice of proposed insider sale (Form 144)', 'ARS': 'Annual report to shareholders'
};

export async function recentFilings(limit = 60) {
  const d = await sec(`https://data.sec.gov/submissions/CIK${CIK10}.json`);
  const r = d.filings.recent;
  const out = [];
  for (let i = 0; i < r.form.length && out.length < limit; i++) {
    const acc = r.accessionNumber[i], accNo = acc.replace(/-/g, '');
    out.push({
      form: r.form[i],
      name: FORM_NAMES[r.form[i]] || r.primaryDocDescription[i] || r.form[i],
      date: r.filingDate[i],
      reportDate: r.reportDate[i] || null,
      items: r.items[i] || '',
      accession: acc,
      primaryDocument: r.primaryDocument[i],
      url: `https://www.sec.gov/Archives/edgar/data/${CIK}/${accNo}/${r.primaryDocument[i]}`,
      index: `https://www.sec.gov/Archives/edgar/data/${CIK}/${accNo}/${acc}-index.htm`
    });
  }
  return { company: d.name, tickers: d.tickers, filings: out };
}

export const json = (body, maxAge = 900) => new Response(JSON.stringify(body), {
  headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=60, s-maxage=${maxAge}, stale-while-revalidate=3600` }
});
export const fail = (e) => new Response(JSON.stringify({ error: String(e && e.message || e) }), { status: 502, headers: { 'Content-Type': 'application/json' } });

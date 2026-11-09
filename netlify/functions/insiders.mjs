// GET /api/insiders → recent Form 4 insider transactions parsed from EDGAR XML (cached ~6 h).
import { recentFilings, sec, json, fail, CIK } from './_sec.mjs';

const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}>\\s*(?:<value>)?\\s*([^<]*)`, 'i')); return m ? m[1].trim() : ''; };
const CODES = { P: 'Buy (open market)', S: 'Sell (open market)', A: 'Grant / award', M: 'Option exercise', F: 'Tax withholding', G: 'Gift', C: 'Conversion', X: 'Option exercise' };

export default async () => {
  try {
    const { filings } = await recentFilings(400);
    const f4 = filings.filter(f => f.form === '4').slice(0, 30);
    const trades = [];
    for (const f of f4) {
      try {
        const accNo = f.accession.replace(/-/g, '');
        const raw = f.primaryDocument.replace(/^xslF345X\d+\//, '');
        const xml = await sec(`https://www.sec.gov/Archives/edgar/data/${CIK}/${accNo}/${raw}`, 'text');
        const owner = tag(xml, 'rptOwnerName');
        const rel = [];
        if (/<isDirector>\s*(1|true)/i.test(xml)) rel.push('Director');
        if (/<isOfficer>\s*(1|true)/i.test(xml)) rel.push(tag(xml, 'officerTitle') || 'Officer');
        if (/<isTenPercentOwner>\s*(1|true)/i.test(xml)) rel.push('10% owner');
        const blocks = xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/gi) || [];
        for (const b of blocks) {
          const code = tag(b, 'transactionCode');
          trades.push({
            date: tag(b, 'transactionDate') || f.date, filed: f.date, insider: owner, role: rel.join(', '),
            code, type: CODES[code] || code, shares: +tag(b, 'transactionShares') || 0,
            price: +tag(b, 'transactionPricePerShare') || null, direction: tag(b, 'transactionAcquiredDisposedCode'),
            owned_after: +tag(b, 'sharesOwnedFollowingTransaction') || null, url: f.url
          });
        }
        await new Promise(r => setTimeout(r, 120)); // stay well under EDGAR's 10 requests/second
      } catch (_) { /* skip a filing we can't parse */ }
    }
    return json({ updated: new Date().toISOString(), source: 'SEC EDGAR Form 4', trades }, 21600);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/insiders' };

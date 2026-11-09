// Scheduled every 30 minutes: looks for new LWLG SEC filings (and, optionally, new press releases from an RSS feed)
// and alerts subscribers who signed up through the "alerts" Netlify Form.
//
// Turn it on by setting these environment variables in Netlify (Site settings → Environment variables):
//   SEC_CONTACT        your email (EDGAR requires a contact in the User-Agent)
//   NETLIFY_API_TOKEN  personal access token, so the function can read the "alerts" form submissions
//   SITE_ID            this site's API ID (Site settings → General)
//   RESEND_API_KEY     (email) API key from resend.com; ALERT_FROM e.g. "LWLG Index <alerts@lwlgstock.com>"
//   TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM   (optional, text alerts)
//   PRESS_RSS_URL      (optional) an RSS feed of the company's press releases
// Until those are set it runs harmlessly and only records what it has seen.
import { getStore } from '@netlify/blobs';
import { recentFilings } from './_sec.mjs';

async function subscribers() {
  const { NETLIFY_API_TOKEN: tok, SITE_ID: site } = process.env;
  if (!tok || !site) return [];
  const h = { Authorization: `Bearer ${tok}` };
  const forms = await (await fetch(`https://api.netlify.com/api/v1/sites/${site}/forms`, { headers: h })).json();
  const form = forms.find(f => f.name === 'alerts');
  if (!form) return [];
  const subs = await (await fetch(`https://api.netlify.com/api/v1/forms/${form.id}/submissions?per_page=1000`, { headers: h })).json();
  const seen = new Map();
  for (const s of subs) { const d = s.data || {}; if (d.email && !seen.has(d.email)) seen.set(d.email, d); }
  return [...seen.values()];
}

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.ALERT_FROM || 'LWLG Investor Index <alerts@lwlgstock.com>', to, subject, html })
  });
}
async function sendSMS(to, body) {
  const { TWILIO_SID: sid, TWILIO_TOKEN: tok, TWILIO_FROM: from } = process.env;
  if (!sid || !tok || !from || !to) return;
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: body })
  });
}

async function pressItems() {
  if (!process.env.PRESS_RSS_URL) return [];
  const xml = await (await fetch(process.env.PRESS_RSS_URL)).text();
  return [...xml.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g)].map(m => ({ id: m[2].trim(), title: m[1].trim(), url: m[2].trim() }));
}

export default async () => {
  const store = getStore('alerts');
  const state = (await store.get('seen', { type: 'json' })) || { filings: [], press: [] };
  const first = !state.filings.length;
  const { filings } = await recentFilings(40);
  const newF = filings.filter(f => !state.filings.includes(f.accession));
  let press = [];
  try { press = await pressItems(); } catch (_) {}
  const newP = press.filter(p => !state.press.includes(p.id));

  if (!first && (newF.length || newP.length)) {
    const subs = await subscribers();
    for (const s of subs) {
      // unchecked boxes are simply absent from a form submission
      const items = [
        ...(s.filings ? newF.filter(f => f.form !== '4') : []),
        ...(s.insiders ? newF.filter(f => f.form === '4') : []),
      ];
      const pr = s.press ? newP : [];
      if (!items.length && !pr.length) continue;
      const lines = [...items.map(f => `New ${f.form} (${f.name}) filed ${f.date}: ${f.url}`), ...pr.map(p => `Press release: ${p.title} ${p.url}`)];
      await sendEmail(s.email, `LWLG alert: ${lines.length} new item${lines.length > 1 ? 's' : ''}`,
        `<p>${lines.map(l => l.replace(/(https?:\/\/\S+)/, '<a href="$1">$1</a>')).join('</p><p>')}</p><p style="color:#666;font-size:12px">LWLG Investor Index is independent and not affiliated with Lightwave Logic, Inc. Not financial advice.</p>`);
      if (s.phone) await sendSMS(s.phone, `LWLG: ${lines[0]}${lines.length > 1 ? ` (+${lines.length - 1} more)` : ''}`);
    }
  }
  await store.setJSON('seen', { filings: filings.map(f => f.accession), press: press.map(p => p.id).slice(0, 100), checked: new Date().toISOString() });
  return new Response('ok');
};

export const config = { schedule: '*/30 * * * *' };

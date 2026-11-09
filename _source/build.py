#!/usr/bin/env python3
"""Assemble the static site: wraps each page body in the shared header/footer.
Usage: python3 build.py  (reads site_src/pages/*.html, writes site/*.html)
Each page file starts with a JSON front-matter line:  <!--{"title": "...", "nav": "thesis", "desc": "..."}-->
"""
import json, pathlib, re, datetime

SRC = pathlib.Path(__file__).parent / 'pages'
OUT = pathlib.Path(__file__).parent.parent  # site root
DOMAIN = 'https://lwlgstock.com'

NAV = [
    ('start', 'start.html', 'Start here', None),
    ('perkinamine', 'index.html#perkinamine', 'Perkinamine', None),
    ('company', None, 'Company', [
        ('business', 'business.html', 'How LWLG makes money', 'Materials, licensing, royalties'),
        ('learn', 'learn.html', 'How a modulator works', '3-minute visual explainer'),
        ('timeline', 'timeline.html', 'Timeline', '39 milestones since 1991'),
        ('patents', 'patents.html', 'Patents', 'The IP portfolio, explained'),
        ('ecosystem', 'ecosystem.html', 'Partners & leadership', 'Foundries, customers, the team'),
    ]),
    ('stock', None, 'The stock', [
        ('earnings', 'earnings.html', 'Earnings hub', 'Q3 2026 results: Nov 10'),
        ('trends', 'trends.html', 'Key numbers over time', 'Cash, shares, burn, Stage 3'),
        ('catalysts', 'catalysts.html', 'Catalysts & stage tracker', 'Countdowns + customer stages'),
        ('filings', 'filings.html', 'Filings & ownership', 'SEC, insiders, 13F, shorts'),
        ('calls', 'calls.html', 'Earnings calls', 'Every call, summarized'),
    ]),
    ('research', None, 'Research', [
        ('thesis', 'thesis.html', 'Bull vs. bear', 'The case, stress-tested'),
        ('promises', 'promises.html', 'Promise tracker', 'What management said vs. did'),
        ('connections', 'connections.html', 'The unverified connections', 'Rumours, theories & what-ifs'),
        ('market', 'market.html', 'Market & competitors', 'TAM calculator, tech comparison'),
        ('faq', 'faq.html', 'FAQ', 'Plain answers to common questions'),
        ('glossary', 'glossary.html', 'Glossary', 'PAM4, PDK, chromophore…'),
    ]),
    ('tools', None, 'Tools', [
        ('news', 'news.html', "What's new", 'Every release, filing and call'),
        ('portfolio', 'portfolio.html', 'My position', 'Track your shares'),
        ('community', 'community.html', 'Community Q&A', 'Ask a question'),
        ('alerts', '#alerts', 'Get alerts', 'Email & text'),
    ]),
]

HEAD = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — LWLG Investor Index (independent)</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{domain}/{file}">
<meta property="og:title" content="{title} — LWLG Investor Index">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23111'/%3E%3Crect x='4' y='14' width='24' height='4' fill='%23E10600'/%3E%3C/svg%3E">
<link rel="stylesheet" href="assets/site.css">
{extra_head}
</head>
<body{body_attr}>
<a class="sr" href="#main">Skip to content</a>
<div class="indep">Independent investor site. Not affiliated with, endorsed by, or sponsored by Lightwave Logic, Inc. Not financial advice. <a href="about.html">About this site</a></div>
<header class="site-head">
  <div class="wrap">
    <a class="brand" href="index.html">LWLG<span>Investor Index</span></a>
    <button class="nav-toggle" aria-expanded="false" aria-controls="nav">Menu</button>
    <nav class="nav" id="nav" aria-label="Main">{nav}</nav>
    <a class="quote" href="filings.html#chart" title="Live chart">NASDAQ: LWLG <b>●</b></a>
  </div>
</header>
<div id="glance" class="glance" aria-label="LWLG at a glance"></div>
<main id="main">
'''

FOOT = '''</main>
<footer class="site-foot">
  <div class="wrap">
    <div class="cols">
      <div>
        <div class="brand" style="font-size:44px">LWLG<span>Investor Index</span></div>
        <p class="muted" style="max-width:420px">Everything about Lightwave Logic stock in one place: the thesis, the timeline, the patents, the filings and the catalysts. Built by an independent investor.</p>
      </div>
      <div>
        <div class="kicker">Research</div>
        <a href="start.html">Start here: LWLG in 5 minutes</a><a href="index.html#perkinamine">Perkinamine</a><a href="business.html">How LWLG makes money</a><a href="thesis.html">Bull vs. bear</a><a href="promises.html">Promise tracker</a><a href="faq.html">FAQ</a><a href="glossary.html">Glossary</a>
      </div>
      <div>
        <div class="kicker">Track</div>
        <a href="news.html">What's new</a><a href="earnings.html">Earnings hub</a><a href="trends.html">Key numbers over time</a><a href="catalysts.html">Catalyst calendar</a><a href="filings.html">SEC filings &amp; insiders</a><a href="portfolio.html">My position</a><a href="onepager.pdf">One-page summary (PDF)</a>
      </div>
      <div>
        <div class="kicker" id="alerts">Get alerts</div>
        <p class="note">New SEC filings and press releases, the day they drop.</p>
        <form name="alerts" method="POST" data-netlify="true" netlify-honeypot="company" data-alerts>
          <input type="hidden" name="form-name" value="alerts">
          <p class="sr"><label>Leave blank <input name="company"></label></p>
          <label class="field">Email<input type="email" name="email" required autocomplete="email"></label>
          <label class="field" style="margin-top:8px">Mobile for text alerts (optional)<input type="tel" name="phone" autocomplete="tel"></label>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin:10px 0;font-size:14px">
            <label style="display:flex;gap:6px;align-items:center;min-height:44px"><input type="checkbox" name="filings" checked style="width:auto;min-height:0"> SEC filings</label>
            <label style="display:flex;gap:6px;align-items:center;min-height:44px"><input type="checkbox" name="press" checked style="width:auto;min-height:0"> Press releases</label>
            <label style="display:flex;gap:6px;align-items:center;min-height:44px"><input type="checkbox" name="insiders" style="width:auto;min-height:0"> Insider trades</label>
          </div>
          <button class="btn red" type="submit">Get alerts</button>
          <p class="note" data-out aria-live="polite"></p>
        </form>
      </div>
    </div>
    <div class="disclaimer">
      <b>Independent and unofficial.</b> LWLGstock.com is an independent investor website. It is not affiliated with, endorsed by, sponsored by or connected to Lightwave Logic, Inc. "Lightwave Logic" and "Perkinamine" are trademarks of their owner and are used here only to identify the company being discussed.
      <b>Not financial advice.</b> Everything here is for information and education only. It reflects an openly bullish point of view, may contain errors and may be out of date. Do your own research, read the company's SEC filings, and talk to a licensed advisor before investing. Stock prices are provided by TradingView and may be delayed. Diagrams are illustrative and not to scale. Last built {built}.
    </div>
  </div>
</footer>
<script src="assets/site.js"></script>
<script src="assets/ask.js" defer></script>
<script src="assets/share.js" defer></script>
<script src="assets/earningsday.js" defer></script>
{scripts}
</body>
</html>
'''

def build():
    OUT.mkdir(exist_ok=True)
    built = datetime.date.today().isoformat()
    for f in sorted(SRC.glob('*.html')):
        raw = f.read_text()
        m = re.match(r'<!--(\{.*?\})-->\n', raw, re.S)
        meta = json.loads(m.group(1)) if m else {}
        body = raw[m.end():] if m else raw
        scripts = ''
        sm = re.search(r'<!--SCRIPTS-->(.*)$', body, re.S)
        if sm:
            scripts = sm.group(1).strip(); body = body[:sm.start()]
        cur = meta.get("nav")
        parts = []
        for key, href, label, items in NAV:
            if not items:
                parts.append(f'<a class="nav-top" href="{href}"{" aria-current=\"page\"" if cur == key else ""}>{label}</a>')
                continue
            active = any(cur == k for k, _, _, _ in items)
            links = ''.join(f'<a href="{h}"{" aria-current=\"page\"" if cur == k else ""}><b>{l}</b><span>{d}</span></a>' for k, h, l, d in items)
            parts.append(f'<div class="nav-group{" active" if active else ""}"><button type="button" class="nav-top" aria-expanded="false">{label}<i aria-hidden="true"></i></button><div class="nav-menu">{links}</div></div>')
        nav = ''.join(parts)
        html = HEAD.format(title=meta.get('title', 'LWLG'), desc=meta.get('desc', 'Independent investor site about Lightwave Logic (LWLG) stock.'),
                           domain=DOMAIN, file='' if f.name == 'index.html' else f.name, nav=nav,
                           extra_head=meta.get('head', ''), body_attr=meta.get('body', '')) + body + FOOT.format(built=built, scripts=scripts)
        (OUT / f.name).write_text(html)
        print('built', f.name)

if __name__ == '__main__':
    build()

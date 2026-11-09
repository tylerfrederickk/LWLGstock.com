"""Generate site/onepager.pdf — one-page LWLG thesis summary (Swiss style)."""
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.utils import simpleSplit

RED = HexColor('#E10600'); GREY = HexColor('#555555'); LINE = HexColor('#DDDDDD')
W, H = letter
M = 40
c = canvas.Canvas('/home/claude/site/onepager.pdf', pagesize=letter)
c.setTitle('LWLG — One-page bull thesis (independent)')
c.setAuthor('LWLG Investor Index — LWLGstock.com (independent, not affiliated with Lightwave Logic, Inc.)')

def text(x, y, s, font='Helvetica', size=9, color=black, width=None, leading=None):
    c.setFont(font, size); c.setFillColor(color)
    if width is None:
        c.drawString(x, y, s); return y - (leading or size * 1.25)
    for line in simpleSplit(s, font, size, width):
        c.drawString(x, y, line); y -= (leading or size * 1.3)
    return y

# top banner
c.setFillColor(black); c.rect(0, H - 20, W, 20, fill=1, stroke=0)
text(M, H - 13.5, 'INDEPENDENT INVESTOR SUMMARY · NOT AFFILIATED WITH LIGHTWAVE LOGIC, INC. · NOT FINANCIAL ADVICE · NOV 2026', 'Courier', 7.5, white)

y = H - 50
text(M, y, 'NASDAQ: LWLG — LIGHTWAVE LOGIC', 'Courier', 9, RED)
c.setFont('Helvetica-Bold', 58); c.setFillColor(black); c.drawString(M - 3, y - 54, 'LWLG')
c.setFillColor(RED); c.setFont('Helvetica-Bold', 22); c.drawString(M + 182, y - 30, 'The bull thesis,')
c.drawString(M + 182, y - 54, 'on one page.')
c.setFillColor(black); c.rect(M, y - 70, 300, 6, fill=1, stroke=0)
y -= 92
y = text(M, y, 'Lightwave Logic makes electro-optic (EO) polymers — engineered Perkinamine® materials that turn electrical signals into light inside optical transceivers, faster and at lower voltage than legacy modulator materials. The business model is material supply plus licensing to chip and transceiver makers serving AI data centers.', 'Helvetica', 9.5, black, W - 2 * M, 12.5)

# key numbers
y -= 10
stats = [('$95.9M', 'Cash + securities, 6/30/26'), ('5', 'Fortune Global 500 programs in Stage 3'), ('67 / 80+', 'Patents granted / pending'), ('2H 2027', 'Volume production target')]
cw = (W - 2 * M) / 4
c.setStrokeColor(black); c.setLineWidth(1.5); c.line(M, y, W - M, y)
for i, (n, l) in enumerate(stats):
    x = M + i * cw
    c.setFont('Helvetica-Bold', 22); c.setFillColor(RED if i == 3 else black); c.drawString(x, y - 26, n)
    text(x, y - 40, l, 'Helvetica', 7.5, GREY, cw - 10, 9)
y -= 62

# five pillars
text(M, y, 'FIVE PILLARS', 'Courier', 9, RED); y -= 16
pillars = [
    ('The AI bandwidth wall', 'Optical transceiver sales are booming as AI clusters scale and links move from 800G to 1.6T/3.2T. Networking is a meaningful share of AI system power, so watts per bit matter.'),
    ('Speed at very low voltage', '200 Gbps silicon-polymer modulators and 400 Gbps+ plasmonic links shown (2024); >110 GHz packaged bandwidth with Polariton; sub-0.5 V drive levels reported.'),
    ('Reliability answered', 'Latest Perkinamine® polymer passed the Telcordia GR-468 85/85 damp-heat test (Jul 2025), the classic objection to polymers.'),
    ('Built for foundries', '2026: reference designs into Tower (PH18), GlobalFoundries via GDSFactory, SilTerra via Luceda PDKs; PDK v1.1 (May); polymer in a Hon Hai (Foxconn) transceiver demo (Oct).'),
    ('Owns the chemistry', '67 granted patents and 80+ pending (Dec 2025). Management sizes the polymer modulator opportunity at ~$2–4B within a ~$47B 2028 AI transceiver market.'),
]
for i, (h, b) in enumerate(pillars):
    c.setFont('Helvetica-Bold', 16); c.setFillColor(RED); c.drawString(M, y - 12, f'0{i+1}')
    c.setFont('Helvetica-Bold', 10.5); c.setFillColor(black); c.drawString(M + 30, y - 2, h)
    yy = text(M + 30, y - 15, b, 'Helvetica', 8.6, GREY, W - 2 * M - 30, 11)
    y = min(yy, y - 28) - 6
    c.setStrokeColor(LINE); c.setLineWidth(.5); c.line(M, y + 2, W - M, y + 2); y -= 6

# two columns: catalysts / risks
y -= 4
colw = (W - 2 * M - 20) / 2
yl = text(M, y, 'CATALYSTS TO WATCH', 'Courier', 9, RED)
for s in ['Nov 10, 2026 — Q3 2026 results & business update call', 'A Stage 3 customer moving to Stage 4 (design win)', 'A signed supply / license agreement with the most advanced customer', 'Foundry PDK adoption and high-volume foundry transfer', 'Volume production start, targeted for 2H 2027']:
    yl = text(M, yl - 2, '— ' + s, 'Helvetica', 8.4, black, colw, 10.5)
yr = text(M + colw + 20, y, 'KEY RISKS (READ THE 10-K)', 'Courier', 9, RED)
for s in ['Minimal revenue so far (~$62K in 1H 2026)', 'Dilution: share count ~154M and rising; new shelf filed Jun 2026', 'Unnamed customers under NDA; timelines can slip', 'Competing materials (TFLN, BTO, InP) chasing the same sockets', 'Volatile, high-short-interest stock (~28M shares short, Oct 2026)']:
    yr = text(M + colw + 20, yr - 2, '— ' + s, 'Helvetica', 8.4, black, colw, 10.5)

# footer
fy = 70
c.setFillColor(black); c.rect(M, fy + 30, W - 2 * M, 4, fill=1, stroke=0)
text(M, fy + 18, 'Full thesis, bull vs. bear, timeline, patents, filings & live price: LWLGstock.com', 'Helvetica-Bold', 9, black)
text(M, fy + 4, 'Sources: company press releases, FY2025 10-K, Q2 2026 10-Q, Q1/Q2 2026 calls, Aug 2026 investor presentation, LightCounting, Cignal AI, TrendForce. Links on the site.', 'Helvetica', 7, GREY, W - 2 * M, 9)
text(M, fy - 16, 'Independent and unofficial; not affiliated with, endorsed or sponsored by Lightwave Logic, Inc. "Lightwave Logic" and "Perkinamine" are trademarks of their owner. This is an openly bullish opinion for information only, not financial advice, and may contain errors. Do your own research.', 'Helvetica', 6.8, GREY, W - 2 * M, 8.5)
c.showPage(); c.save()
print('ok')

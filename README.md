# LWLGstock.com — LWLG Investor Index

An independent investor site about Lightwave Logic (NASDAQ: LWLG). It is not affiliated with Lightwave Logic, Inc. and is not financial advice.

## Deploy to Netlify (about 10 minutes)

1. In Netlify, go to **Add new site → Deploy manually** and drag this whole folder in. For automatic redeploys, push the folder to a GitHub repo and import it instead.
2. Under **Domain management**, add `LWLGstock.com` and follow Netlify's DNS steps at your registrar. HTTPS is set up automatically.
3. Under **Site configuration → Environment variables**, add:
   - `SEC_CONTACT`: your email. The SEC requires it so it can identify automated readers. This switches on the live filings feed and insider tracker.
4. Under **Forms**, turn on form detection. The "alerts" sign-up form and the "questions" form then collect submissions automatically.

That's all the live site needs. The live price and chart (TradingView), SEC filings feed, insider tracker, alert sign-ups and question form all work from these steps.

## Turn on email and text alerts (optional)

A function checks for new filings every 30 minutes and alerts subscribers. Add these variables to switch it on:
- `NETLIFY_API_TOKEN` (User settings → Applications → Personal access token) and `SITE_ID` (Site configuration → General)
- `RESEND_API_KEY` from resend.com, plus `ALERT_FROM`, e.g. `LWLG Index <alerts@lwlgstock.com>`. You'll need to verify the domain in Resend.
- For texts: `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM`
- For press releases: `PRESS_RSS_URL`, if you have an RSS feed of the company's releases

Until those are set, sign-ups are still collected. You can see them under Forms.


## Interactive features: what runs where

Everything works as a static site. These features get their live, shared data from small Netlify Functions in `netlify/functions` (they deploy automatically, no setup):

| Feature | Function | Setup |
|---|---|---|
| Bull vs bear poll, "I was here" map, prediction board | `/api/community` (Netlify Blobs) | None. Optional: set `COMMUNITY_SALT` to any random text. |
| Sentiment weather | `/api/sentiment` + hourly `sentiment-cron` | None (uses public Stocktwits data). |
| Ask LWLG chatbot | `/api/ask` | Set `ANTHROPIC_API_KEY` (from console.anthropic.com). Optional `ANTHROPIC_MODEL`. Without a key it falls back to on-device search of the site's FAQ and data. |
| Live light pulses on the 3D chip | `/api/quote` | None. |

## Results day (earnings-day mode)

The red "EARNINGS DAY" bar and homepage takeover switch on automatically from `next_event` in `data/facts.json`.
- Countdown on the day, LIVE during the call (2 hours from the start time).
- After the release, edit `data/earnings_live.json`: set `"status": "out"`, fill in `results` and the `scorecard` answers, and optionally add `key_points` during the call.
- After the call, set the next date in `data/facts.json` and `"status": "auto"` again.
- Preview any state by adding `?earnings=pre`, `?earnings=live` or `?earnings=out` to a page address.

## Prediction board answers

When an answer becomes known, put it in `data/predictions.json` (`"answer": 6`, or a date like `"2027-03"`). The leaderboard ranks the closest guesses automatically.

## Rumour scoreboard

In `data/connections.json`, change a rumour's `"status"` from `"open"` to `"called"` (it came true) or `"debunked"`, and add `"resolved"` (date) and `"resolved_source"` (link). Its arc turns gold and the scoreboard updates.

## Updating content

Everything editable is in `data/`:

| File | What it holds | How often |
|---|---|---|
| `investor.json` | earnings calls, upcoming events, cash/shares, insider snapshot, 13F holders, short interest | after each quarter, and twice a month for short interest |
| `timeline.json` | milestones, press releases, partners, leadership, customer stages | when news drops |
| `patents.json` | patent portfolio | quarterly |
| `industry.json` | competitor tech, why-now stats, market sizing, bear case | occasionally |
| `qa.json` | answered community questions | as you answer them |
| `glossary.json` | hover definitions | rarely |

**Next update due:** Q3 2026 results on **Nov 10, 2026**. Update cash, share count, Stage 3/4 counts and add the call summary.

`onepager.pdf` is the downloadable thesis summary.

Pages are assembled from templates. If you edit the shared header or footer, rebuild with `python3 build.py`; the source folder is included in the zip as `_source/`.

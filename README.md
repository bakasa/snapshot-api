# SnapShot API

**Screenshot-as-a-Service.** One endpoint, any URL, instant result. No signup, no email, no credit card.

[![Deployed on Railway](https://img.shields.io/badge/Railway-LIVE-22c55e?style=flat-square&logo=railway)](https://snapshot-api-production-1374.up.railway.app)
[![GitHub License](https://img.shields.io/github/license/bakasa/snapshot-api?style=flat-square&color=blue)](LICENSE)
[![Stack: Hono + Puppeteer](https://img.shields.io/badge/Stack-Hono+Puppeteer-06b6d4?style=flat-square)](https://snapshot-api-production-1374.up.railway.app)

```
curl -H "Authorization: Bearer YOUR_KEY" \
  "https://snapshot-api-production-1374.up.railway.app/screenshot?url=https://example.com" \
  -o screenshot.png
```

## Quick Start

```bash
# Get a free API key (100 screenshots/month)
curl https://snapshot-api-production-1374.up.railway.app/key

# Take a screenshot
curl -H "Authorization: Bearer ss_xxx..." \
  "https://snapshot-api-production-1374.up.railway.app/screenshot?url=https://github.com" \
  -o github.png
```

From zero to screenshot in under 10 seconds. No account, no dashboard, no bullshit.

## Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `url` | required | Page to screenshot |
| `width` | `1280` | Viewport width |
| `height` | auto | Viewport height |
| `format` | `png` | `png` or `jpeg` |
| `fullPage` | `false` | Capture full scrollable page |
| `delay` | `0` | Wait ms before capture |

Auth via `Authorization: Bearer YOUR_KEY` header or `?api_key=YOUR_KEY` query param.

## Referral Program

Share your referral link and **both you and your friend get +50 free screenshots**.

```bash
# Get your referral link from /usage response
curl -H "Authorization: Bearer YOUR_KEY" \
  https://snapshot-api-production-1374.up.railway.app/usage

# Share it: https://snapshot-api-production-1374.up.railway.app/?ref=YOUR_CODE
# When someone signs up through it, you both get credited instantly
```

## Pricing

| Plan | Price | Screenshots | Features |
|------|-------|-------------|----------|
| Free | $0 | 100/mo (+50 per referral) | PNG, 1280x720 |
| Pro | $15/mo | 1,000/mo | PNG+JPEG, custom viewport, full page |
| Business | $49/mo | 10,000/mo | All formats, priority support, team keys |

> Billing coming soon — join the waitlist to get notified when Stripe goes live.

## Use Cases

- **Dashboards** — Live webpage previews embedded anywhere
- **Monitoring** — Visual checks for site changes
- **AI/LLM Tools** — Feed webpage screenshots to vision models
- **CI/CD** — Visual regression tests in your pipeline

## API

- `GET /key[?ref=CODE]` — get a free API key (optional referral)
- `GET /screenshot?url=...` — take a screenshot
- `GET /usage` — check your usage and get referral link
- `GET /health` — health check

## Tech

Node.js, TypeScript, Hono, Puppeteer, SQLite, Railway.

## License

MIT

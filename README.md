# SnapShot API

**Screenshot-as-a-Service.** One endpoint, any URL, instant result. No signup, no email, no credit card needed for the free tier.

[![Deployed on Railway](https://img.shields.io/badge/Railway-LIVE-22c55e?style=flat-square&logo=railway)](https://snapshot-api-production-1374.up.railway.app)
[![GitHub License](https://img.shields.io/github/license/bakasa/snapshot-api?style=flat-square&color=blue)](LICENSE)
[![Stack: Hono + Puppeteer](https://img.shields.io/badge/Stack-Hono+Puppeteer-06b6d4?style=flat-square)](https://snapshot-api-production-1374.up.railway.app)

```bash
# Get a free API key in one request
curl https://snapshot-api-production-1374.up.railway.app/key

# Take a screenshot — returns PNG in 2-5 seconds
curl -H "Authorization: Bearer ss_YOUR_KEY" \
  "https://snapshot-api-production-1374.up.railway.app/screenshot?url=https://example.com" \
  -o screenshot.png
```

**From zero to screenshot in under 10 seconds. No account, no dashboard, no bullshit.**

## Quick Start

```bash
# 1. Get your free API key (100 screenshots/month)
curl https://snapshot-api-production-1374.up.railway.app/key
# → {"api_key":"ss_xxx...","plan":"free","monthly_limit":100,...}

# 2. Take a screenshot
curl -H "Authorization: Bearer ss_xxx..." \
  "https://snapshot-api-production-1374.up.railway.app/screenshot?url=https://github.com" \
  -o github.png

# 3. Check your usage
curl -H "Authorization: Bearer ss_xxx..." \
  https://snapshot-api-production-1374.up.railway.app/usage
```

## Features

- **Zero signup** — get a key with a single curl, no email required
- **Fast renders** — 2-5 second response time with full JavaScript execution
- **PNG & JPEG** — choose your format with `?format=jpeg`
- **Custom viewport** — `?width=1920&height=1080` or `?width=1200` for OG images
- **Full page capture** — `?fullPage=true` for scrollable pages
- **Configurable delay** — `?delay=2000` to wait for JS-rendered content
- **GitHub Action** — [snapshot-action](https://github.com/bakasa/snapshot-action) for CI/CD pipelines
- **Open source** — MIT license, self-host friendly

## API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /key[?ref=CODE]` | Generate a free API key (optional referral code) |
| `GET /screenshot?url=...` | Capture a webpage screenshot |
| `GET /usage` | Check your current usage and remaining quota |
| `GET /health` | Health check |

### Screenshot Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `url` | required | Page to screenshot (must start with http(s)://) |
| `width` | `1280` | Viewport width in pixels |
| `height` | auto | Viewport height in pixels |
| `format` | `png` | `png` or `jpeg` |
| `fullPage` | `false` | Capture full scrollable page |
| `delay` | `0` | Milliseconds to wait before capture |

Auth via `Authorization: Bearer YOUR_KEY` header or `?api_key=YOUR_KEY` query param.

## Pricing

| Plan | Price | Screenshots | Features |
|------|-------|-------------|----------|
| Free | $0 | 100/mo (+50 per referral) | PNG, 1280x720 |
| Pro | $15/mo | 1,000/mo | PNG+JPEG, custom viewport, full page |
| Business | $49/mo | 10,000/mo | All formats, priority support, team keys |

> Pro & Business billing launching within 48 hours. [Join the waitlist](https://snapshot-api-production-1374.up.railway.app) to get notified.

## Referral Program

Share your referral link and **both you and your friend get +50 free screenshots**.

```bash
# Get your referral link
curl -H "Authorization: Bearer YOUR_KEY" \
  https://snapshot-api-production-1374.up.railway.app/usage

# Share: https://snapshot-api-production-1374.up.railway.app/?ref=YOUR_CODE
# When someone signs up through your link, you both get +50 screenshots free
```

## Use Cases

| Use Case | Description |
|----------|-------------|
| **Dashboards** | Embed live webpage previews anywhere |
| **Monitoring** | Visual checks for website changes |
| **AI/LLM Tools** | Feed webpage screenshots to vision models |
| **CI/CD** | Visual regression tests with [GitHub Action](https://github.com/bakasa/snapshot-action) |
| **OG Images** | Generate Open Graph preview images at `?width=1200` |
| **Documentation** | Auto-capture docs pages for manuals |

## Tech Stack

Node.js, TypeScript, [Hono](https://hono.dev), [Puppeteer](https://pptr.dev), SQLite, [Railway](https://railway.app).

## License

MIT — use it, fork it, self-host it.

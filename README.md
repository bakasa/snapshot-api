# SnapShot API

**Screenshot-as-a-Service.** One endpoint, any URL, instant result.

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

## Pricing

| Plan | Price | Screenshots | Features |
|------|-------|-------------|----------|
| Free | $0 | 100/mo | PNG, 1280×720 |
| Pro | $15/mo | 1,000/mo | PNG+JPEG, custom viewport, full page |
| Business | $49/mo | 10,000/mo | All formats, priority support, team keys |

> Billing coming soon — currently all keys are free with 100 screenshot limit.

## How It Works

1. Request a free API key
2. Call `GET /screenshot` with the URL
3. Get back a PNG (or JPEG) image

That's it. No queues. No webhooks. No setup.

## API

- `GET /key` — get a free API key
- `GET /screenshot?url=...` — take a screenshot
- `GET /usage` — check your usage
- `GET /health` — health check

## Tech

Node.js, TypeScript, Hono, Puppeteer, SQLite, Railway.

## License

MIT

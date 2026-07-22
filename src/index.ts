import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { db, getDb, migrate } from './db.js';
import { takeScreenshot } from './screenshot.js';

migrate(getDb());

const d = db();
d.getOrCreateDefaultKey();

const app = new Hono();
app.use('*', cors());

function getApiKeyFromRequest(c: any): string | null {
  const auth = c.req.header('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  const query = c.req.query('api_key');
  if (query) return query;
  return null;
}

function htmlPage(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — SnapShot API</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0b;color:#e4e4e7;line-height:1.6}
.container{max-width:800px;margin:0 auto;padding:2rem 1rem}
header{padding:2rem 0;border-bottom:1px solid #27272a;margin-bottom:2rem}
header h1{font-size:1.8rem;font-weight:700;color:#fff}
header h1 span{color:#22c55e}
header p{color:#a1a1aa;margin-top:.25rem}
.card{background:#18181b;border:1px solid #27272a;border-radius:8px;padding:1.5rem;margin-bottom:1rem}
.card h2{font-size:1.1rem;font-weight:600;margin-bottom:.75rem;color:#fff}
.card pre{background:#0a0a0b;padding:1rem;border-radius:6px;overflow-x:auto;font-size:.85rem;color:#a1f0a1;margin-top:.5rem}
code{font-family:'SF Mono',Monaco,monospace;font-size:.9em;background:#27272a;padding:.15em .4em;border-radius:3px}
pre code{background:none;padding:0}
.btn{display:inline-block;background:#22c55e;color:#000;font-weight:600;padding:.6rem 1.2rem;border-radius:6px;text-decoration:none;font-size:.9rem}
.btn:hover{background:#16a34a}
footer{border-top:1px solid #27272a;padding:2rem 0;margin-top:3rem;text-align:center;color:#71717a;font-size:.85rem}
.pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin:1.5rem 0}
.pricing-card{border:1px solid #27272a;border-radius:8px;padding:1.5rem;text-align:center}
.pricing-card.featured{border-color:#22c55e}
.pricing-card h3{font-weight:600;color:#fff}
.pricing-card .price{font-size:2rem;font-weight:700;color:#fff;margin:.5rem 0}
.pricing-card .price span{font-size:.9rem;color:#a1a1aa;font-weight:400}
.pricing-card ul{list-style:none;font-size:.9rem;color:#a1a1aa;margin:1rem 0}
.pricing-card ul li{padding:.25rem 0}
.label{display:inline-block;font-size:.7rem;background:#22c55e33;color:#22c55e;padding:.15rem .5rem;border-radius:4px;font-weight:600}
.endpoint{font-size:.85rem;font-family:'SF Mono',Monaco,monospace}
.endpoint .method{display:inline-block;font-weight:700;color:#22c55e;width:4rem}
.endpoint .path{color:#e4e4e7}
.endpoint .desc{color:#a1a1aa;margin-left:4rem;font-size:.8rem;margin-top:.15rem}
</style>
</head>
<body>
<div class="container">
<header>
<h1><span>SnapShot</span> API</h1>
<p>Screenshot-as-a-Service. One endpoint, instant API key, no setup.</p>
</header>
${content}
<footer>SnapShot API — Built by Auto Company</footer>
</div>
</body>
</html>`;
}

app.get('/', (c) => {
  const content = `
<div class="card">
<h2>One endpoint does it all</h2>
<pre><code>GET /screenshot?url=https://example.com&api_key=YOUR_KEY</code></pre>
<p style="margin-top:.75rem;color:#a1a1aa;font-size:.9rem">Returns a PNG screenshot of any web page. Works in browsers, curl, or any HTTP client.</p>
</div>

<div class="card">
<h2>Quick start</h2>
<pre><code># Get your free API key
curl https://snapshot-api.up.railway.app/key

# Take a screenshot
curl -H "Authorization: Bearer YOUR_KEY" \\
  "https://snapshot-api.up.railway.app/screenshot?url=https://example.com" \\
  -o screenshot.png</code></pre>
</div>

<div class="card">
<h2>Pricing</h2>
<div class="pricing-grid">
<div class="pricing-card">
<h3>Free</h3>
<div class="price">$0<span>/mo</span></div>
<ul><li>100 screenshots/mo</li><li>PNG format</li><li>1280×720</li></ul>
</div>
<div class="pricing-card featured">
<div class="label">POPULAR</div>
<h3>Pro</h3>
<div class="price">$15<span>/mo</span></div>
<ul><li>1,000 screenshots/mo</li><li>PNG + JPEG</li><li>Custom viewport</li><li>Full page capture</li></ul>
</div>
<div class="pricing-card">
<h3>Business</h3>
<div class="price">$49<span>/mo</span></div>
<ul><li>10,000 screenshots/mo</li><li>All formats</li><li>Priority support</li><li>Team keys</li></ul>
</div>
</div>
</div>

<div class="card">
<h2>API Reference</h2>
<div class="endpoint"><span class="method">GET</span><span class="path">/screenshot?url=...&width=...&format=...&fullPage=true</span></div>
<div class="endpoint desc">Takes a screenshot of the given URL.</div>
<div class="endpoint" style="margin-top:.75rem"><span class="method">GET</span><span class="path">/key</span></div>
<div class="endpoint desc">Generates a free API key (100 screenshots/mo).</div>
<div class="endpoint" style="margin-top:.75rem"><span class="method">GET</span><span class="path">/usage</span></div>
<div class="endpoint desc">Check your current usage and remaining quota.</div>
</div>`;
  return c.html(htmlPage('Home', content));
});

app.get('/key', async (c) => {
  const key = d.createApiKey();
  return c.json({ api_key: key.key, plan: key.plan, monthly_limit: key.monthly_limit });
});

app.get('/usage', async (c) => {
  const keyStr = getApiKeyFromRequest(c);
  if (!keyStr) return c.json({ error: 'API key required via Authorization header or ?api_key=' }, 401);
  const key = d.getApiKey(keyStr);
  if (!key) return c.json({ error: 'Invalid API key' }, 401);
  const used = d.getUsage(key.id);
  return c.json({
    key: key.key,
    plan: key.plan,
    monthly_limit: key.monthly_limit,
    used_this_month: used,
    remaining: key.monthly_limit - used,
  });
});

app.get('/screenshot', async (c) => {
  const keyStr = getApiKeyFromRequest(c);
  if (!keyStr) return c.json({ error: 'API key required via Authorization header or ?api_key=' }, 401);

  const apiKey = d.getApiKey(keyStr);
  if (!apiKey) return c.json({ error: 'Invalid API key' }, 401);

  const used = d.getUsage(apiKey.id);
  if (used >= apiKey.monthly_limit) {
    return c.json({ error: `Monthly limit (${apiKey.monthly_limit}) exceeded. Upgrade your plan.` }, 429);
  }

  const url = c.req.query('url');
  if (!url) return c.json({ error: '?url= parameter is required' }, 400);

  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    return c.json({ error: 'Invalid URL. Must start with http:// or https://' }, 400);
  }

  const width = parseInt(c.req.query('width') || '1280');
  const height = c.req.query('height') ? parseInt(c.req.query('height')!) : undefined;
  const format = (c.req.query('format') || 'png') as 'png' | 'jpeg';
  const fullPage = c.req.query('fullPage') === 'true';
  const delay = c.req.query('delay') ? parseInt(c.req.query('delay')!) : undefined;

  try {
    const start = Date.now();
    const result = await takeScreenshot(url, { width, height, format, fullPage, delay });
    const tookMs = Date.now() - start;

    d.recordScreenshot(apiKey.id, url, width, format, 200, result.sizeBytes, tookMs);

    return c.body(new Uint8Array(result.buffer), 200, {
      'Content-Type': result.contentType,
      'Content-Length': String(result.sizeBytes),
      'X-SnapShot-Took-Ms': String(tookMs),
      'X-SnapShot-Remaining': String(apiKey.monthly_limit - used - 1),
      'Cache-Control': 'public, max-age=3600',
    });
  } catch (err: any) {
    d.recordScreenshot(apiKey.id, url, width, format, 500, null, null);
    return c.json({ error: `Screenshot failed: ${err.message}` }, 502);
  }
});

app.get('/health', (c) => c.json({ ok: true }));

const port = parseInt(process.env.PORT || '3000');
serve({ fetch: app.fetch, port });
console.log(`SnapShot API running on port ${port}`);

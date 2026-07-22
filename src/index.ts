import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { db, getDb, migrate } from './db.js';
import { takeScreenshot } from './screenshot.js';
import { isBillingConfigured, createCheckoutSession, handleWebhook, PLANS } from './billing.js';

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

const APP_URL = process.env.APP_URL || 'https://snapshot-api-production-1374.up.railway.app';

const demoRateLimit = new Map<string, number>();
const DEMO_RATE_LIMIT = 10;
const DEMO_WINDOW_MS = 60000;

function checkDemoRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = demoRateLimit.get(ip);
  if (!entry || now - entry > DEMO_WINDOW_MS) {
    demoRateLimit.set(ip, now);
    return true;
  }
  const count = Math.floor((now - entry) / (DEMO_WINDOW_MS / DEMO_RATE_LIMIT));
  if (count >= DEMO_RATE_LIMIT) return false;
  return true;
}

function htmlPage(title: string, content: string, extraScript = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="SnapShot API — Screenshot-as-a-Service. One endpoint, instant API key, no setup. Capture any webpage as PNG or JPEG.">
<meta name="keywords" content="screenshot API, webpage screenshot, Puppeteer API, screenshot service, headless browser API">
<meta property="og:title" content="SnapShot API — Screenshot-as-a-Service">
<meta property="og:description" content="One endpoint, instant API key, no setup. Capture any webpage as a screenshot. From \$0/mo.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="SnapShot API — Screenshot-as-a-Service">
<meta name="twitter:description" content="One endpoint, instant key. Screenshot any webpage as PNG/JPEG. From \$0/mo.">
<title>${title} — SnapShot API</title>
<script type="application/ld+json">
{
"@context":"https://schema.org",
"@type":"SoftwareApplication",
"name":"SnapShot API",
"applicationCategory":"DeveloperApplication",
"operatingSystem":"All",
"description":"Screenshot-as-a-Service. One endpoint, instant API key, no setup. Capture any webpage as PNG or JPEG.",
"url":"${APP_URL}",
"offers":{"@type":"Offer","price":"0","priceCurrency":"USD","priceValidUntil":"2027-12-31"}
}
</script>
<script type="application/ld+json">
{
"@context":"https://schema.org",
"@type":"BreadcrumbList",
"itemListElement":[{"@type":"ListItem","position":1,"name":"SnapShot API","item":"${APP_URL}"}]
}
</script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;background:#09090b;color:#e4e4e7;line-height:1.6;-webkit-font-smoothing:antialiased}
.container{max-width:900px;margin:0 auto;padding:2rem 1.5rem}
.hero{padding:3rem 0 2rem;text-align:center}
.hero h1{font-size:2.8rem;font-weight:800;letter-spacing:-.02em;background:linear-gradient(135deg,#22c55e,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero p{font-size:1.2rem;color:#a1a1aa;margin-top:.75rem;max-width:600px;margin-left:auto;margin-right:auto}
.hero-sub{font-size:.95rem;color:#71717a;margin-top:.5rem}
.demo-box{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:1.75rem;margin-bottom:1.25rem;text-align:center}
.demo-box h2{font-size:1.15rem;font-weight:700;margin-bottom:.5rem;color:#fff;letter-spacing:-.01em}
.demo-input-row{display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap;justify-content:center}
.demo-input-row input[type=text]{flex:1;min-width:220px;max-width:420px;padding:.65rem .9rem;background:#09090b;border:1px solid #27272a;border-radius:8px;color:#e4e4e7;font-size:.9rem;font-family:'SF Mono','Fira Code',monospace;outline:none;transition:border-color .15s}
.demo-input-row input[type=text]:focus{border-color:#06b6d4}
.demo-input-row input[type=text]::placeholder{color:#52525b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.demo-select{padding:.65rem .9rem;background:#09090b;border:1px solid #27272a;border-radius:8px;color:#e4e4e7;font-size:.9rem;outline:none;cursor:pointer}
.demo-result{margin-top:1.25rem;display:none;border-radius:8px;overflow:hidden;border:1px solid #27272a;background:#09090b}
.demo-result img{width:100%;height:auto;display:block}
.demo-result .meta{display:flex;justify-content:space-between;align-items:center;padding:.6rem 1rem;border-top:1px solid #27272a;font-size:.8rem;color:#a1a1aa;flex-wrap:wrap;gap:.5rem}
.demo-result .meta .took{color:#22c55e;font-weight:600}
.demo-spinner{display:none;margin:2rem auto;width:2rem;height:2rem;border:2px solid #27272a;border-top-color:#06b6d4;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.demo-curl{background:#09090b;border:1px solid #27272a;border-radius:8px;padding:.75rem 1rem;font-size:.82rem;color:#86efac;font-family:'SF Mono','Fira Code',monospace;margin-top:.75rem;text-align:left;display:none;word-break:break-all;line-height:1.5}
.card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:1.75rem;margin-bottom:1.25rem}
.card h2{font-size:1.15rem;font-weight:700;margin-bottom:.75rem;color:#fff;letter-spacing:-.01em}
.card pre{background:#09090b;padding:1rem;border-radius:8px;overflow-x:auto;font-size:.82rem;color:#86efac;margin-top:.5rem;border:1px solid #27272a}
code{font-family:'SF Mono','Fira Code',monospace;font-size:.9em;background:#27272a;padding:.15em .4em;border-radius:4px}
pre code{background:none;padding:0}
.btn{display:inline-flex;align-items:center;gap:.4rem;background:#22c55e;color:#09090b;font-weight:700;padding:.65rem 1.4rem;border-radius:8px;text-decoration:none;font-size:.9rem;border:none;cursor:pointer;transition:all .15s}
.btn:hover{background:#16a34a;transform:translateY(-1px)}
.btn-outline{background:transparent;color:#e4e4e7;border:1px solid #27272a;font-weight:600}
.btn-outline:hover{background:#27272a;border-color:#3f3f46}
.btn-sm{padding:.4rem .9rem;font-size:.8rem}
.share-btn{display:inline-flex;align-items:center;gap:.4rem;background:#1d9bf0;color:#fff;font-weight:600;padding:.5rem 1.1rem;border-radius:8px;text-decoration:none;font-size:.85rem;border:none;cursor:pointer;transition:all .15s}
.share-btn:hover{background:#1a8cd8;transform:translateY(-1px)}
.share-btn.copy-link{background:#27272a;color:#e4e4e7;border:1px solid #3f3f46}
.share-btn.copy-link:hover{background:#3f3f46}
footer{border-top:1px solid #27272a;padding:2rem 0;margin-top:3rem;text-align:center;color:#71717a;font-size:.85rem}
footer a{color:#a1a1aa;text-decoration:none}
footer a:hover{color:#22c55e}
.pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin:1.5rem 0}
.pricing-card{border:1px solid #27272a;border-radius:12px;padding:1.75rem;text-align:center;background:#18181b;position:relative}
.pricing-card.featured{border-color:#22c55e;background:linear-gradient(180deg,#18181b,#1a2e1a)}
.pricing-card h3{font-weight:700;color:#fff;font-size:1rem}
.pricing-card .price{font-size:2.2rem;font-weight:800;color:#fff;margin:.6rem 0;letter-spacing:-.02em}
.pricing-card .price span{font-size:.9rem;color:#a1a1aa;font-weight:400}
.pricing-card ul{list-style:none;font-size:.85rem;color:#a1a1aa;margin:1rem 0;text-align:left;display:inline-block}
.pricing-card ul li{padding:.3rem 0}
.pricing-card ul li:before{content:"✓ ";color:#22c55e;font-weight:700}
.label{position:absolute;top:-.6rem;left:50%;transform:translateX(-50%);font-size:.7rem;background:#22c55e;color:#09090b;padding:.15rem .7rem;border-radius:4px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1.5rem;margin:1.5rem 0}
.step{text-align:center}
.step .num{width:2.5rem;height:2.5rem;background:#22c55e;color:#09090b;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;margin:0 auto .75rem}
.step h3{font-weight:600;color:#fff;font-size:.95rem}
.step p{color:#a1a1aa;font-size:.85rem;margin-top:.25rem}
.key-display{background:#09090b;border:1px solid #27272a;border-radius:8px;padding:.75rem 1rem;font-family:'SF Mono','Fira Code',monospace;font-size:.85rem;color:#86efac;display:flex;align-items:center;justify-content:space-between;gap:.5rem;word-break:break-all;margin-top:.75rem}
.key-display .copy-btn{background:transparent;border:1px solid #3f3f46;color:#a1a1aa;padding:.3rem .6rem;border-radius:4px;cursor:pointer;font-size:.75rem;white-space:nowrap;transition:all .15s}
.key-display .copy-btn:hover{background:#22c55e;color:#09090b;border-color:#22c55e}
.share-actions{display:flex;gap:.5rem;margin-top:.75rem;flex-wrap:wrap;justify-content:center}
.share-actions a,.share-actions button{text-decoration:none}
.waitlist-form{display:flex;gap:.5rem;margin-top:.75rem;flex-wrap:wrap}
.waitlist-form input{flex:1;min-width:200px;padding:.6rem .9rem;background:#09090b;border:1px solid #27272a;border-radius:8px;color:#e4e4e7;font-size:.9rem;outline:none;transition:border-color .15s}
.waitlist-form input:focus{border-color:#22c55e}
.waitlist-form input::placeholder{color:#52525b}
.msg{font-size:.85rem;margin-top:.5rem}
.msg.success{color:#22c55e}
.msg.error{color:#ef4444}
.gotokey{display:none;margin-top:.75rem}
.share-section{display:none;margin-top:1rem;padding-top:1rem;border-top:1px solid #27272a}
.share-section p{color:#a1a1aa;font-size:.85rem;margin-bottom:.6rem}
.endpoint{font-size:.85rem;font-family:'SF Mono','Fira Code',monospace;padding:.4rem 0}
.endpoint .method{display:inline-block;font-weight:700;color:#22c55e;width:4.5rem}
.endpoint .path{color:#e4e4e7}
.endpoint .desc{color:#a1a1aa;margin-left:4.5rem;font-size:.8rem}
.bonus-badge{display:inline-block;background:#22c55e;color:#09090b;font-size:.7rem;font-weight:700;padding:.15rem .5rem;border-radius:4px;text-transform:uppercase;letter-spacing:.03em}
@media(max-width:640px){.hero h1{font-size:2rem}.container{padding:1.5rem 1rem}}
</style>
</head>
<body>
<div class="container">
${content}
<footer>
<a href="https://github.com/bakasa/snapshot-api" target="_blank">GitHub</a>
&nbsp;·&nbsp; <a href="/docs">API Docs</a>
&nbsp;·&nbsp; SnapShot API — Built by <a href="https://auto.company" target="_blank">Auto Company</a>
&nbsp;·&nbsp; <a href="/health">Status</a>
</footer>
</div>
${extraScript}
</body>
</html>`;
}

app.get('/', (c) => {
  const content = `
<div class="hero">
<h1>SnapShot API</h1>
<p>Screenshot any webpage with one curl command. Key in 0 seconds, screenshot in 2-5.</p>
<p class="hero-sub">No signup · No OAuth · No Docker · No self-hosting · <a href="https://github.com/bakasa/snapshot-action" target="_blank" style="color:#22c55e;text-decoration:none;font-weight:600">GitHub Action ↗</a></p>
</div>

<div class="demo-box">
<h2>Try it now — screenshot any page live</h2>
<p style="color:#a1a1aa;font-size:.9rem">Enter a URL and see the result instantly. No key needed.</p>
<div class="demo-input-row">
<input type="text" id="demoUrl" value="https://github.com/trending" placeholder="https://example.com" spellcheck="false" />
<select class="demo-select" id="demoFormat"><option value="png">PNG</option><option value="jpeg">JPEG</option></select>
<button class="btn" id="demoBtn" onclick="runDemo()">Capture →</button>
</div>
<div class="demo-spinner" id="demoSpinner"></div>
<div class="demo-result" id="demoResult">
<img id="demoImg" alt="Screenshot preview" />
<div class="meta">
<span>Took: <span class="took" id="demoTookMs">—</span></span>
<a class="btn-outline btn-sm" style="text-decoration:none;display:inline-flex" id="demoDownload" download="screenshot.png">⬇ Download</a>
</div>
</div>
<div class="demo-curl" id="demoCurl"></div>
</div>

<div class="card" style="text-align:center">
<h2>Try it now — get a free API key instantly</h2>
<p style="color:#a1a1aa;font-size:.9rem;margin-bottom:1rem">100 screenshots/month free. No email, no credit card, no signup.</p>
<button class="btn" id="getKeyBtn" onclick="getKey()">Generate Free API Key →</button>
<div class="gotokey" id="keyResult">
<div class="key-display">
<span id="keyDisplay"></span>
<button class="copy-btn" id="copyBtn" onclick="copyKey()">Copy</button>
</div>
<p style="color:#a1a1aa;font-size:.8rem;margin-top:.5rem">Your free key — 100 screenshots/month. Keep this safe!</p>
</div>
<div class="share-section" id="shareSection">
<p>🚀 <strong>Share & get 50 more screenshots free</strong> — when someone signs up with your link, you both get +50!</p>
<div class="share-actions">
<a class="share-btn" id="shareXBtn" href="#" target="_blank">Post on X</a>
<button class="share-btn copy-link" id="copyRefBtn" onclick="copyReferralLink()">Copy Link</button>
</div>
</div>
</div>

<div class="card">
<h2>How it works</h2>
<div class="steps">
<div class="step"><div class="num">1</div><h3>Get a key</h3><p>Click "Generate" or curl /key — instant API key, zero friction, no account</p></div>
<div class="step"><div class="num">2</div><h3>Capture any page</h3><p>Pass your key and a URL to /screenshot — returns a PNG (or JPEG) in 2-5 seconds</p></div>
<div class="step"><div class="num">3</div><h3>Use it anywhere</h3><p>Embed in dashboards, CI/CD pipelines, LLM workflows, or monitoring — one endpoint does it all</p></div>
</div>
</div>

<div class="card">
<h2>Pricing</h2>
<div class="pricing-grid">
<div class="pricing-card">
<h3>Free</h3>
<div class="price">$0<span>/mo</span></div>
<ul><li>100 screenshots/mo</li><li>PNG format</li><li>1280×720</li><li>Referral bonuses <span class="bonus-badge">+50 each</span></li></ul>
<button class="btn btn-sm" onclick="getKey()">Get Free Key</button>
</div>
<div class="pricing-card featured">
<div class="label">POPULAR</div>
<h3>Pro</h3>
<div class="price">$15<span>/mo</span></div>
<ul><li>1,000 screenshots/mo</li><li>PNG + JPEG</li><li>Custom viewport</li><li>Full page capture</li></ul>
<button class="btn btn-sm btn-outline" onclick="document.getElementById('waitlist-email').focus()">Join Waitlist</button>
</div>
<div class="pricing-card">
<h3>Business</h3>
<div class="price">$49<span>/mo</span></div>
<ul><li>10,000 screenshots/mo</li><li>All formats</li><li>Priority support</li><li>Team keys</li></ul>
<button class="btn btn-sm btn-outline" onclick="document.getElementById('waitlist-email').focus()">Join Waitlist</button>
</div>
</div>
</div>

<div class="card">
<h2>Why SnapShot API?</h2>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.75rem;margin-top:.5rem">
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem">
<h3 style="font-size:.9rem;font-weight:600;color:#fff;margin-bottom:.25rem">Zero setup</h3>
<p style="font-size:.8rem;color:#a1a1aa">No account, no email, no credit card. Get a key in one click, take a screenshot in one curl.</p>
</div>
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem">
<h3 style="font-size:.9rem;font-weight:600;color:#fff;margin-bottom:.25rem">Simple pricing</h3>
<p style="font-size:.8rem;color:#a1a1aa">Free tier: 100 screenshots/mo. Pro at $15 vs Browserless at $30+ — same Puppeteer, half the price.</p>
</div>
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem">
<h3 style="font-size:.9rem;font-weight:600;color:#fff;margin-bottom:.25rem">Fast & reliable</h3>
<p style="font-size:.8rem;color:#a1a1aa">Built on Puppeteer with 30s timeout, network idle wait, and full JavaScript rendering. Returns in 2-5 seconds.</p>
</div>
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem">
<h3 style="font-size:.9rem;font-weight:600;color:#fff;margin-bottom:.25rem">Developer-first</h3>
<p style="font-size:.8rem;color:#a1a1aa">API key auth, query param fallback, curl-friendly. GitHub Action for CI/CD. Open source under MIT.</p>
</div>
</div>
</div>

<div class="card">
<h2>Use cases</h2>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-top:.5rem">
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem;text-align:center">
<div style="font-size:1.5rem;margin-bottom:.3rem">📊</div>
<h3 style="font-size:.9rem;font-weight:600;color:#fff">Dashboards</h3>
<p style="font-size:.8rem;color:#a1a1aa;margin-top:.25rem">Live webpage previews embedded anywhere</p>
</div>
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem;text-align:center">
<div style="font-size:1.5rem;margin-bottom:.3rem">🔍</div>
<h3 style="font-size:.9rem;font-weight:600;color:#fff">Monitoring</h3>
<p style="font-size:.8rem;color:#a1a1aa;margin-top:.25rem">Visual checks for site changes</p>
</div>
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem;text-align:center">
<div style="font-size:1.5rem;margin-bottom:.3rem">🤖</div>
<h3 style="font-size:.9rem;font-weight:600;color:#fff">AI/LLM Tools</h3>
<p style="font-size:.8rem;color:#a1a1aa;margin-top:.25rem">Feed webpage screenshots to vision models</p>
</div>
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem;text-align:center">
<div style="font-size:1.5rem;margin-bottom:.3rem">🐙</div>
<h3 style="font-size:.9rem;font-weight:600;color:#fff">CI/CD</h3>
<p style="font-size:.8rem;color:#a1a1aa;margin-top:.25rem">Visual regression tests in your pipeline</p>
<a href="https://github.com/bakasa/snapshot-action" target="_blank" style="display:inline-block;margin-top:.5rem;background:#27272a;color:#e4e4e7;font-size:.7rem;font-weight:600;padding:.2rem .6rem;border-radius:4px;text-decoration:none;letter-spacing:.02em">GitHub Action</a>
</div>
</div>
</div>

<div class="card">
<h2>Ready to upgrade?</h2>
<p style="color:#a1a1aa;font-size:.9rem;margin-bottom:.25rem">Want more screenshots, JPEG support, or custom viewports? Join the waitlist and we'll notify you the moment Stripe billing goes live. Expected within 48 hours.</p>
<div class="waitlist-form">
<input type="email" id="waitlist-email" placeholder="you@example.com" />
<button class="btn btn-sm" id="waitlistBtn" onclick="joinWaitlist()">Notify Me When Billing Launches</button>
</div>
<div id="waitlistMsg" class="msg"></div>
</div>

<div class="card">
<h2>Quick start</h2>
<pre><code># 1. Get your free API key
curl ${APP_URL}/key

# 2. Take a screenshot
curl -H "Authorization: Bearer YOUR_KEY" \\
  "${APP_URL}/screenshot?url=https://example.com" \\
  -o screenshot.png

# 3. Check usage
curl -H "Authorization: Bearer YOUR_KEY" \\
  ${APP_URL}/usage</code></pre>
</div>

<div class="card">
<h2>API Reference</h2>
<div class="endpoint"><span class="method">GET</span><span class="path">/screenshot?url=...&width=...&height=...&format=...&fullPage=true&delay=...</span></div>
<div class="endpoint desc">Capture a webpage screenshot. Returns PNG or JPEG based on format param.</div>
<div class="endpoint" style="margin-top:.6rem"><span class="method">GET</span><span class="path">/key[?ref=CODE]</span></div>
<div class="endpoint desc">Generate a free API key. Pass ?ref= to credit a referrer and earn bonuses.</div>
<div class="endpoint" style="margin-top:.6rem"><span class="method">GET</span><span class="path">/usage</span></div>
<div class="endpoint desc">Check your current usage and remaining quota for the month.</div>
</div>`;
  return c.html(htmlPage('Home', content, pageScript()));
});

app.get('/key', async (c) => {
  const refCode = c.req.query('ref');
  let referredBy: number | undefined;
  if (refCode) {
    const referrer = d.getApiKeyByReferralCode(refCode);
    if (referrer) referredBy = referrer.id;
  }
  const key = d.createApiKey(undefined, 'free', 100, referredBy);
  return c.json({
    api_key: key.key,
    plan: key.plan,
    monthly_limit: key.monthly_limit,
    referral_code: key.referral_code,
    referral_link: `${APP_URL}/?ref=${key.referral_code}`,
    referrer_bonus: referredBy ? 50 : 0,
  });
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
    referral_link: `${APP_URL}/?ref=${key.referral_code}`,
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

app.post('/api/checkout', async (c) => {
  if (!isBillingConfigured()) {
    return c.json({ error: 'Billing not configured. Contact hello@auto.company' }, 501);
  }
  const keyStr = getApiKeyFromRequest(c);
  if (!keyStr) return c.json({ error: 'API key required' }, 401);
  const apiKey = d.getApiKey(keyStr);
  if (!apiKey) return c.json({ error: 'Invalid API key' }, 401);

  const body = await c.req.json<{ plan: string; email?: string }>();
  const url = await createCheckoutSession(body.plan as any, apiKey.id, body.email);
  if (!url) return c.json({ error: 'Invalid plan or billing not configured' }, 400);
  return c.json({ url });
});

app.post('/api/stripe-webhook', async (c) => {
  const body = await c.req.text();
  const sig = c.req.header('stripe-signature') || '';
  const result = await handleWebhook(body, sig);
  return c.json(result);
});

app.post('/api/waitlist', async (c) => {
  const body = await c.req.json<{ email: string; plan?: string }>();
  if (!body.email || !body.email.includes('@')) {
    return c.json({ error: 'Valid email required' }, 400);
  }
  const result = d.addToWaitlist(body.email, body.plan || 'pro');
  if (!result.ok) {
    return c.json({ error: result.error || 'Failed to join waitlist' }, 409);
  }
  return c.json({ ok: true, total: d.getWaitlistCount() });
});

app.get('/api/demo', async (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  if (!checkDemoRateLimit(ip)) {
    return c.json({ error: 'Rate limited. Try again in a moment.' }, 429);
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

  const devKey = d.getApiKey('dev-key');
  if (!devKey) return c.json({ error: 'Demo unavailable' }, 500);

  try {
    const start = Date.now();
    const result = await takeScreenshot(url, { width, height, format, fullPage: false });
    const tookMs = Date.now() - start;
    d.recordScreenshot(devKey.id, url, width, format, 200, result.sizeBytes, tookMs);
    return c.body(new Uint8Array(result.buffer), 200, {
      'Content-Type': result.contentType,
      'X-Demo-Took-Ms': String(tookMs),
      'Cache-Control': 'public, max-age=300',
    });
  } catch (err: any) {
    return c.json({ error: `Demo failed: ${err.message}` }, 502);
  }
});

app.get('/success', async (c) => {
  const sid = c.req.query('session_id') || '';
  return c.html(htmlPage('Success', `
    <div class="card" style="text-align:center">
    <h2>Payment successful!</h2>
    <p style="margin-top:1rem;color:#a1a1aa">
      Your plan has been upgraded. Session: ${sid.slice(0, 8)}...
    </p>
    <a href="/" class="btn" style="margin-top:1rem">Back to home</a>
    </div>
  `));
});

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'SnapShot API',
    version: '1.0.0',
    description: 'Screenshot-as-a-Service. Capture any webpage as PNG or JPEG with a single HTTP request. [Try the live demo](/).',
    contact: { url: 'https://github.com/bakasa/snapshot-api' },
  },
  servers: [{ url: APP_URL, description: 'Production' }],
  paths: {
    '/key': {
      get: {
        summary: 'Generate a free API key',
        description: 'Returns an instant API key with 100 screenshots/month. No signup, no email, no credit card.',
        parameters: [
          { name: 'ref', in: 'query', required: false, schema: { type: 'string' }, description: 'Referral code to credit the referrer and earn +50 bonus' }
        ],
        responses: {
          '200': {
            description: 'API key generated',
            content: { 'application/json': { schema: { type: 'object', properties: {
              api_key: { type: 'string' },
              plan: { type: 'string' },
              monthly_limit: { type: 'integer' },
              referral_code: { type: 'string' },
              referral_link: { type: 'string', format: 'uri' },
              referrer_bonus: { type: 'integer' }
            }}}}
          }
        }
      }
    },
    '/screenshot': {
      get: {
        summary: 'Capture a webpage screenshot',
        description: 'Returns a screenshot image of the specified URL. Requires API key via Authorization header or ?api_key= query parameter.',
        parameters: [
          { name: 'url', in: 'query', required: true, schema: { type: 'string', format: 'uri' }, description: 'The URL to capture' },
          { name: 'width', in: 'query', required: false, schema: { type: 'integer', default: 1280 }, description: 'Viewport width in pixels' },
          { name: 'height', in: 'query', required: false, schema: { type: 'integer' }, description: 'Viewport height in pixels (defaults to full content height)' },
          { name: 'format', in: 'query', required: false, schema: { type: 'string', enum: ['png', 'jpeg'], default: 'png' }, description: 'Output image format' },
          { name: 'fullPage', in: 'query', required: false, schema: { type: 'string', enum: ['true', 'false'], default: 'false' }, description: 'Capture full page height' },
          { name: 'delay', in: 'query', required: false, schema: { type: 'integer' }, description: 'Delay in milliseconds before capture' },
          { name: 'api_key', in: 'query', required: false, schema: { type: 'string' }, description: 'API key (alternative to Authorization header)' }
        ],
        responses: {
          '200': { description: 'Screenshot image (PNG or JPEG)' },
          '400': { description: 'Missing or invalid URL' },
          '401': { description: 'Missing or invalid API key' },
          '429': { description: 'Monthly limit exceeded' },
          '502': { description: 'Screenshot capture failed' }
        },
        security: [{ apiKey: [] }]
      }
    },
    '/usage': {
      get: {
        summary: 'Check API key usage',
        description: 'Returns current usage and remaining quota for the API key.',
        parameters: [
          { name: 'api_key', in: 'query', required: false, schema: { type: 'string' }, description: 'API key (alternative to Authorization header)' }
        ],
        responses: {
          '200': { description: 'Usage info', content: { 'application/json': { schema: { type: 'object', properties: {
            key: { type: 'string' },
            plan: { type: 'string' },
            monthly_limit: { type: 'integer' },
            used_this_month: { type: 'integer' },
            remaining: { type: 'integer' },
            referral_link: { type: 'string', format: 'uri' }
          }}}} },
          '401': { description: 'Missing or invalid API key' }
        },
        security: [{ apiKey: [] }]
      }
    },
    '/api/demo': {
      get: {
        summary: 'Demo screenshot (rate-limited)',
        description: 'Try the API without an API key. Rate-limited to 10 requests/minute per IP. Returns screenshot image with X-Demo-Took-Ms header.',
        parameters: [
          { name: 'url', in: 'query', required: true, schema: { type: 'string', format: 'uri' }, description: 'The URL to capture' },
          { name: 'format', in: 'query', required: false, schema: { type: 'string', enum: ['png', 'jpeg'], default: 'png' }, description: 'Output image format' },
          { name: 'width', in: 'query', required: false, schema: { type: 'integer', default: 1280 }, description: 'Viewport width in pixels' }
        ],
        responses: {
          '200': { description: 'Screenshot image' },
          '400': { description: 'Missing or invalid URL' },
          '429': { description: 'Rate limited' },
          '502': { description: 'Capture failed' }
        }
      }
    },
    '/api/waitlist': {
      post: {
        summary: 'Join the Pro/Business waitlist',
        description: 'Get notified when Stripe billing launches. Expected within 48 hours.',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          email: { type: 'string', format: 'email' },
          plan: { type: 'string', enum: ['pro', 'business'], default: 'pro' }
        }, required: ['email'] }}} },
        responses: {
          '200': { description: 'Joined waitlist', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, total: { type: 'integer' } } } } } },
          '400': { description: 'Invalid email' },
          '409': { description: 'Email already on waitlist' }
        }
      }
    }
  },
  components: { securitySchemes: { apiKey: { type: 'apiKey', in: 'header', name: 'Authorization', description: 'Bearer YOUR_API_KEY' } } }
};

app.get('/sitemap.xml', (c) => c.body(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${APP_URL}/</loc><priority>1.0</priority></url>
<url><loc>${APP_URL}/docs</loc><priority>0.9</priority></url>
<url><loc>${APP_URL}/health</loc><priority>0.1</priority></url>
</urlset>`, 200, { 'Content-Type': 'application/xml' }));

app.get('/openapi.json', (c) => c.json(OPENAPI_SPEC));

app.get('/docs', (c) => c.html(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SnapShot API — Docs</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
<style>html{background:#09090b}body{margin:0}.swagger-ui{color:#e4e4e7}.swagger-ui .topbar{display:none}.swagger-ui .info .title{color:#fff!important}.swagger-ui .info{color:#a1a1aa!important}.swagger-ui .info a{color:#22c55e!important}.swagger-ui .opblock-tag{color:#e4e4e7!important}.swagger-ui .opblock-tag small{color:#a1a1aa!important}.swagger-ui .opblock-summary-method{font-weight:700!important}.swagger-ui table thead tr td,.swagger-ui table thead tr th{color:#e4e4e7!important}.swagger-ui .response-col_status,.swagger-ui .response-col_links,.swagger-ui .parameter__name,.swagger-ui .parameter__in,.swagger-ui .parameters-col_name{color:#e4e4e7!important}.swagger-ui .parameter__type,.swagger-ui .responses-inner h4,.swagger-ui .response-col_description{color:#a1a1aa!important}.swagger-ui .model-box,.swagger-ui .model{color:#e4e4e7!important}.swagger-ui .btn{background:#27272a!important;color:#e4e4e7!important;border-color:#3f3f46!important}.swagger-ui .btn.authorize{background:#22c55e!important;color:#09090b!important;border-color:#22c55e!important}.swagger-ui section.models{background:#18181b!important;border-color:#27272a!important}.swagger-ui .model-container{background:#09090b!important;border-color:#27272a!important}.swagger-ui .opblock{background:#18181b!important;border-color:#27272a!important}.swagger-ui .opblock .opblock-summary{background:#18181b!important;border-color:#27272a!important}.swagger-ui .opblock .opblock-section-header{background:#09090b!important;border-color:#27272a!important}.swagger-ui .opblock .opblock-section-header h4{color:#e4e4e7!important}.swagger-ui .opblock-body{background:#18181b!important}.swagger-ui .opblock-body pre{background:#09090b!important;color:#86efac!important;border-color:#27272a!important}.swagger-ui .scheme-container{background:#18181b!important;border-color:#27272a!important;box-shadow:none!important}.swagger-ui select{background:#09090b!important;color:#e4e4e7!important;border-color:#27272a!important}.swagger-ui .loading-container{background:transparent!important}.swagger-ui .dialog-ux .modal-ux{background:#18181b!important;border-color:#27272a!important}.swagger-ui .dialog-ux .modal-ux-content h4{color:#fff!important}.swagger-ui .dialog-ux .modal-ux-content p{color:#a1a1aa!important}.swagger-ui .auth-wrapper .auth-btn-wrapper .btn{background:#27272a!important;border-color:#3f3f46!important}.swagger-ui .auth-container{border-color:#27272a!important;background:#09090b!important}.swagger-ui .auth-container input[type=text]{background:#09090b!important;color:#e4e4e7!important;border-color:#27272a!important}.swagger-ui .auth-container .auth-btn-wrapper .btn.modal-btn.auth{background:#22c55e!important;border-color:#22c55e!important;color:#09090b!important}.swagger-ui .opblock .opblock-summary-description{color:#a1a1aa!important}.swagger-ui .opblock-body .opblock-description-wrapper p{color:#a1a1aa!important}.swagger-ui .markdown p,.swagger-ui .markdown li,.swagger-ui .renderedMarkdown p,.swagger-ui .renderedMarkdown li{color:#a1a1aa!important}.swagger-ui .markdown code,.swagger-ui .renderedMarkdown code{background:#27272a!important;color:#86efac!important;border:none!important}.swagger-ui .expand-operation,.swagger-ui .model-toggle{filter:invert(.8)!important}.swagger-ui .parameter__name.required:after{color:#ef4444!important}.swagger-ui .response-col_description .response-col_links .response-undocumented{color:#a1a1aa!important}.swagger-ui .opblock-summary-control{outline:none!important}.swagger-ui .responses-inner h4,.swagger-ui .responses-inner div,.swagger-ui .responses-inner td{color:#e4e4e7!important}.swagger-ui .responses-inner .response-col_description .response-col_links{color:#a1a1aa!important}body{background:#09090b;display:flex;flex-direction:column}</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({ url: '${APP_URL}/openapi.json', dom_id: '#swagger-ui', deepLinking: true, presets: [SwaggerUIBundle.presets.apis], layout: 'BaseLayout' });
</script>
</body>
</html>`));

app.get('/health', (c) => c.json({ ok: true }));

function pageScript(): string {
  return `<script>
const urlParams = new URLSearchParams(window.location.search);
const refParam = urlParams.get('ref');
let lastKeyData = null;

async function getKey() {
  const btn = document.getElementById('getKeyBtn');
  btn.disabled = true; btn.textContent = 'Generating...';
  try {
    const url = refParam ? '/key?ref=' + encodeURIComponent(refParam) : '/key';
    const r = await fetch(url);
    const d = await r.json();
    lastKeyData = d;
    document.getElementById('keyDisplay').textContent = d.api_key;
    document.getElementById('keyResult').style.display = 'block';
    document.getElementById('shareSection').style.display = 'block';
    document.getElementById('referralLink').textContent = d.referral_link;
    const shareText = encodeURIComponent('Just got a free SnapShot API key in one click! Screenshot any webpage with a single curl. No signup, no email. Get yours: ' + d.referral_link);
    document.getElementById('shareXBtn').href = 'https://twitter.com/intent/tweet?text=' + shareText;
    document.getElementById('shareLinkInput').value = d.referral_link;
    btn.textContent = 'Generate Another Key';
  } catch(e) {
    btn.textContent = 'Error - try again';
  }
  btn.disabled = false;
}
async function copyKey() {
  const key = document.getElementById('keyDisplay').textContent;
  try {
    await navigator.clipboard.writeText(key);
    document.getElementById('copyBtn').textContent = 'Copied!';
    setTimeout(() => document.getElementById('copyBtn').textContent = 'Copy', 2000);
  } catch { }
}
async function copyReferralLink() {
  const link = document.getElementById('referralLink').textContent;
  try {
    await navigator.clipboard.writeText(link);
    document.getElementById('copyRefBtn').textContent = 'Copied!';
    setTimeout(() => document.getElementById('copyRefBtn').textContent = 'Copy Link', 2000);
  } catch { }
}
async function runDemo() {
  const btn = document.getElementById('demoBtn');
  const spinner = document.getElementById('demoSpinner');
  const result = document.getElementById('demoResult');
  const curl = document.getElementById('demoCurl');
  const img = document.getElementById('demoImg');
  const took = document.getElementById('demoTookMs');
  const download = document.getElementById('demoDownload');
  const url = document.getElementById('demoUrl').value.trim();
  const fmt = document.getElementById('demoFormat').value;
  if (!url) return;
  btn.disabled = true; btn.textContent = 'Capturing...';
  spinner.style.display = 'block';
  result.style.display = 'none';
  curl.style.display = 'none';
  const params = new URLSearchParams({ url, format: fmt, width: '1280' });
  try {
    const r = await fetch('/api/demo?' + params.toString());
    if (!r.ok) { const e = await r.json(); alert(e.error || 'Demo failed'); btn.disabled = false; btn.textContent = 'Capture →'; spinner.style.display = 'none'; return; }
    const blob = await r.blob();
    const urlObj = URL.createObjectURL(blob);
    img.src = urlObj;
    download.href = urlObj;
    download.download = 'screenshot.' + fmt;
    const tookMs = r.headers.get('X-Demo-Took-Ms') || '?';
    took.textContent = tookMs + 'ms';
    result.style.display = 'block';
    curl.textContent = '# Equivalent curl:\ncurl -H "Authorization: Bearer YOUR_KEY" \\\n  "' + window.location.origin + '/screenshot?url=' + encodeURIComponent(url) + '&format=' + fmt + '&width=1280" \\\n  -o screenshot.' + fmt;
    curl.style.display = 'block';
  } catch(e) { alert('Network error'); }
  btn.disabled = false; btn.textContent = 'Capture →';
  spinner.style.display = 'none';
}
async function joinWaitlist() {
  const email = document.getElementById('waitlist-email').value.trim();
  const msg = document.getElementById('waitlistMsg');
  const btn = document.getElementById('waitlistBtn');
  if (!email || !email.includes('@')) { msg.className = 'msg error'; msg.textContent = 'Please enter a valid email'; return; }
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    const r = await fetch('/api/waitlist', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email}) });
    const d = await r.json();
    if (d.ok) { msg.className = 'msg success'; msg.textContent = 'You\\'re on the list! We\\'ll let you know when Pro launches.'; document.getElementById('waitlist-email').value = ''; }
    else { msg.className = 'msg error'; msg.textContent = d.error || 'Something went wrong'; }
  } catch(e) { msg.className = 'msg error'; msg.textContent = 'Network error - try again'; }
  btn.disabled = false; btn.textContent = 'Notify Me';
}
</script>`;
}

const port = parseInt(process.env.PORT || '3000');
serve({ fetch: app.fetch, port });
console.log(`SnapShot API running on port ${port}`);

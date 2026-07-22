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

function htmlPage(title: string, content: string, extraScript = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="SnapShot API — Screenshot-as-a-Service. One endpoint, instant API key, no setup. Capture any webpage as PNG or JPEG.">
<meta name="keywords" content="screenshot API, webpage screenshot, Puppeteer API, screenshot service">
<meta property="og:title" content="SnapShot API — Screenshot-as-a-Service">
<meta property="og:description" content="One endpoint, instant API key, no setup. Capture any webpage as a screenshot.">
<title>${title} — SnapShot API</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;background:#09090b;color:#e4e4e7;line-height:1.6;-webkit-font-smoothing:antialiased}
.container{max-width:900px;margin:0 auto;padding:2rem 1.5rem}
.hero{padding:3rem 0 2rem;text-align:center}
.hero h1{font-size:2.8rem;font-weight:800;letter-spacing:-.02em;background:linear-gradient(135deg,#22c55e,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero p{font-size:1.2rem;color:#a1a1aa;margin-top:.75rem;max-width:600px;margin-left:auto;margin-right:auto}
.hero-sub{font-size:.95rem;color:#71717a;margin-top:.5rem}
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
<p>Screenshot-as-a-Service. One endpoint, instant key, no setup.</p>
<p class="hero-sub">Built with Puppeteer · PNG & JPEG · 100/mo free · <a href="https://github.com/bakasa/snapshot-action" target="_blank" style="color:#22c55e;text-decoration:none;font-weight:600">GitHub Action ↗</a></p>
</div>

<div class="card" style="text-align:center">
<h2>Get your free API key in one click</h2>
<button class="btn" id="getKeyBtn" onclick="getKey()">Generate Free API Key</button>
<div class="gotokey" id="keyResult">
<div class="key-display">
<span id="keyDisplay"></span>
<button class="copy-btn" id="copyBtn" onclick="copyKey()">Copy</button>
</div>
<p style="color:#a1a1aa;font-size:.8rem;margin-top:.5rem">This key gives you 100 screenshots/month. No signup, no email.</p>
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
<div class="step"><div class="num">1</div><h3>Get a key</h3><p>Click the button above or curl /key — instant API key, zero friction</p></div>
<div class="step"><div class="num">2</div><h3>Capture any page</h3><p>Pass your key and a URL to /screenshot — returns a PNG in 2-5 seconds</p></div>
<div class="step"><div class="num">3</div><h3>Share & earn</h3><p>Share your referral link — each signup gives you and your friend +50 free screenshots</p></div>
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
<h2>Built for</h2>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-top:.5rem">
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem;text-align:center">
<div style="font-size:1.5rem;margin-bottom:.3rem">📊</div>
<h3 style="font-size:.9rem;font-weight:600;color:#fff">Dashboards</h3>
<p style="font-size:.8rem;color:#a1a1aa;margin-top:.25rem">Live previews of any URL</p>
</div>
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem;text-align:center">
<div style="font-size:1.5rem;margin-bottom:.3rem">🔍</div>
<h3 style="font-size:.9rem;font-weight:600;color:#fff">Monitoring</h3>
<p style="font-size:.8rem;color:#a1a1aa;margin-top:.25rem">Visual site checks</p>
</div>
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem;text-align:center">
<div style="font-size:1.5rem;margin-bottom:.3rem">🤖</div>
<h3 style="font-size:.9rem;font-weight:600;color:#fff">AI/LLM Tools</h3>
<p style="font-size:.8rem;color:#a1a1aa;margin-top:.25rem">Feed screenshots to models</p>
</div>
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem;text-align:center">
<div style="font-size:1.5rem;margin-bottom:.3rem">🐙</div>
<h3 style="font-size:.9rem;font-weight:600;color:#fff">CI/CD</h3>
<p style="font-size:.8rem;color:#a1a1aa;margin-top:.25rem">Visual regression tests</p>
<a href="https://github.com/bakasa/snapshot-action" target="_blank" style="display:inline-block;margin-top:.5rem;background:#27272a;color:#e4e4e7;font-size:.7rem;font-weight:600;padding:.2rem .6rem;border-radius:4px;text-decoration:none;letter-spacing:.02em">GitHub Action</a>
</div>
</div>
</div>

<div class="card">
<h2>Join the waitlist</h2>
<p style="color:#a1a1aa;font-size:.9rem;margin-bottom:.25rem">Pro and Business billing are coming soon. Leave your email and we'll let you know.</p>
<div class="waitlist-form">
<input type="email" id="waitlist-email" placeholder="you@example.com" />
<button class="btn btn-sm" id="waitlistBtn" onclick="joinWaitlist()">Notify Me</button>
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

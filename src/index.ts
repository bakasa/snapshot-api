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
.tool-hero{padding:1.5rem 0 1rem;text-align:center}
.tool-hero h1{font-size:2rem;font-weight:800;letter-spacing:-.02em;background:linear-gradient(135deg,#22c55e,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.tool-hero p{color:#a1a1aa;font-size:.95rem;margin-top:.4rem}
.tool-input-row{display:flex;gap:.5rem;margin:1.25rem auto;max-width:640px;flex-wrap:wrap;justify-content:center}
.tool-input-row input[type=text]{flex:1;min-width:240px;padding:.8rem 1rem;background:#09090b;border:1px solid #3f3f46;border-radius:10px;color:#e4e4e7;font-size:1rem;font-family:'SF Mono','Fira Code',monospace;outline:none;transition:all .2s}
.tool-input-row input[type=text]:focus{border-color:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.15)}
.tool-input-row input[type=text]::placeholder{color:#52525b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.preview-card{display:none;margin:1.25rem auto;max-width:720px;background:#18181b;border:1px solid #27272a;border-radius:14px;overflow:hidden}
.preview-card.show{display:block}
.preview-screenshot{width:100%;height:auto;display:block;border-bottom:1px solid #27272a;background:#09090b;min-height:120px}
.preview-meta{padding:1rem 1.25rem}
.preview-meta .site-row{display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem}
.preview-meta .favicon{width:18px;height:18px;border-radius:3px;flex-shrink:0}
.preview-meta .site-name{font-size:.8rem;color:#22c55e;font-weight:600}
.preview-meta h3{font-size:1.1rem;font-weight:700;color:#fff;margin:.3rem 0;line-height:1.3}
.preview-meta .desc{font-size:.85rem;color:#a1a1aa;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.preview-actions{display:flex;gap:.5rem;margin-top:.85rem;flex-wrap:wrap;align-items:center}
.preview-actions .btn-download{background:#22c55e;color:#09090b;font-weight:700;padding:.5rem 1.1rem;border-radius:8px;text-decoration:none;font-size:.85rem;border:none;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:.35rem}
.preview-actions .btn-download:hover{background:#16a34a}
.preview-actions .btn-secondary{background:transparent;color:#e4e4e7;border:1px solid #3f3f46;padding:.5rem 1rem;border-radius:8px;text-decoration:none;font-size:.85rem;border:1px solid #3f3f46;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:.35rem}
.preview-actions .btn-secondary:hover{background:#27272a;border-color:#52525b}
.preview-embed{display:none;margin-top:.75rem;padding-top:.75rem;border-top:1px solid #27272a}
.preview-embed textarea{width:100%;background:#09090b;border:1px solid #3f3f46;border-radius:8px;color:#86efac;font-family:'SF Mono','Fira Code',monospace;font-size:.8rem;padding:.6rem .8rem;resize:vertical;min-height:60px;outline:none}
.preview-embed textarea:focus{border-color:#22c55e}
.preview-error{display:none;margin:1rem auto;max-width:480px;background:#451a1a;border:1px solid #7f1d1d;border-radius:10px;padding:.75rem 1rem;color:#fca5a5;font-size:.85rem;text-align:center}
.preview-spinner{display:none;margin:2rem auto;width:2rem;height:2rem;border:2px solid #27272a;border-top-color:#06b6d4;border-radius:50%;animation:spin .8s linear infinite}
.enter-hint{color:#52525b;font-size:.8rem;margin-top:.3rem}
.tool-to-api{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:1.5rem;margin:1.5rem 0;text-align:center}
.tool-to-api p{color:#a1a1aa;font-size:.9rem;margin-bottom:.75rem}
.recent-previews{display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;margin-top:.5rem}
.recent-previews .recent-item{background:#09090b;border:1px solid #27272a;border-radius:8px;padding:.35rem .65rem;font-size:.75rem;color:#71717a;cursor:pointer;transition:all .15s;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.recent-previews .recent-item:hover{border-color:#52525b;color:#e4e4e7}
@media(max-width:640px){.hero h1{font-size:2rem}.tool-hero h1{font-size:1.5rem}.container{padding:1.5rem 1rem}}
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
<div class="tool-hero">
<h1>Website Preview Tool</h1>
<p>Enter any URL to see a live preview — screenshot, title, description &amp; Open Graph data. Free, no signup.</p>
</div>

<div class="tool-input-row">
<input type="text" id="toolUrl" value="https://news.ycombinator.com" placeholder="https://example.com" spellcheck="false" autofocus />
<button class="btn" id="toolBtn">Preview →</button>
</div>
<p class="enter-hint" style="text-align:center;margin-top:-.75rem">Press Enter or click Preview. <span id="recentHint" style="display:none">or click a recent URL below.</span></p>

<div class="preview-spinner" id="previewSpinner"></div>
<div class="preview-error" id="previewError"></div>

<div class="preview-card" id="previewCard">
<img class="preview-screenshot" id="previewImg" alt="Website screenshot" />
<div class="preview-meta">
<div class="site-row">
<img class="favicon" id="previewFavicon" src="" alt="" />
<span class="site-name" id="previewSiteName">example.com</span>
</div>
<h3 id="previewTitle">Page Title</h3>
<p class="desc" id="previewDesc">Page description appears here...</p>
<div class="preview-actions">
<a class="btn-download" id="previewDownload" download="screenshot.png">⬇ Download Screenshot</a>
<button class="btn-secondary" id="shareBtn">🔗 Share</button>
<button class="btn-secondary" id="embedBtn">&lt;/&gt; Embed</button>
</div>
<div class="preview-embed" id="previewEmbed">
<textarea id="embedCode" readonly rows="2"></textarea>
</div>
<div class="share-actions" id="shareActions" style="display:none;margin-top:.5rem">
<a class="share-btn" id="shareXBtn" href="#" target="_blank" style="font-size:.8rem;padding:.35rem .8rem">Post on X</a>
<button class="share-btn copy-link" id="copyLinkBtn" onclick="copyPageLink()" style="font-size:.8rem;padding:.35rem .8rem">Copy Link</button>
</div>
</div>
</div>

<div id="recentUrls" class="recent-previews"></div>

<div class="tool-to-api" id="apiSection">
<p><strong style="color:#e4e4e7">Need automation?</strong> SnapShot API lets you capture screenshots programmatically — curl, CI/CD, or any HTTP client.</p>
<button class="btn btn-sm" onclick="document.getElementById('apiSection').scrollIntoView({behavior:'smooth'});getKey()">Get Free API Key →</button>
<a href="/docs" class="btn-outline btn-sm" style="display:inline-flex;text-decoration:none;margin-left:.4rem">API Docs</a>
</div>

<div class="card" style="text-align:center">
<h2>Generate API Key</h2>
<p style="color:#a1a1aa;font-size:.9rem;margin-bottom:1rem">100 screenshots/month free. No email, no credit card, no signup.</p>
<button class="btn" id="getKeyBtn" onclick="getKey()">Generate Free API Key →</button>
<div class="gotokey" id="keyResult">
<div class="key-display">
<span id="keyDisplay"></span>
<button class="copy-btn" id="copyBtn" onclick="copyKey()">Copy</button>
</div>
<p style="color:#a1a1aa;font-size:.8rem;margin-top:.5rem">Your free key — 100 screenshots/month. Use it with curl, your app, or CI/CD.</p>
</div>
<div class="share-section" id="shareSection">
<p style="color:#22c55e;font-size:.85rem"><strong>Referral bonus:</strong> share your key link &amp; get +50 screenshots when someone signs up!</p>
<div class="share-actions">
<a class="share-btn" id="shareXBtn2" href="#" target="_blank" style="font-size:.8rem;padding:.35rem .8rem">Post on X</a>
<button class="share-btn copy-link" id="copyRefBtn" onclick="copyReferralLink()" style="font-size:.8rem;padding:.35rem .8rem">Copy Referral Link</button>
</div>
</div>
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
<h2>Use cases</h2>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem">
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem;text-align:center">
<h3 style="font-size:.9rem;font-weight:600;color:#fff">Blog posts</h3>
<p style="font-size:.8rem;color:#a1a1aa;margin-top:.25rem">Add website preview images to your articles</p>
</div>
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem;text-align:center">
<h3 style="font-size:.9rem;font-weight:600;color:#fff">Dashboards</h3>
<p style="font-size:.8rem;color:#a1a1aa;margin-top:.25rem">Live webpage previews embedded anywhere</p>
</div>
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem;text-align:center">
<h3 style="font-size:.9rem;font-weight:600;color:#fff">CI/CD</h3>
<p style="font-size:.8rem;color:#a1a1aa;margin-top:.25rem">Visual regression tests in your pipeline</p>
</div>
<div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:1rem;text-align:center">
<h3 style="font-size:.9rem;font-weight:600;color:#fff">AI/LLM</h3>
<p style="font-size:.8rem;color:#a1a1aa;margin-top:.25rem">Feed webpage screenshots to vision models</p>
</div>
</div>
</div>

<div class="card">
<h2>Ready to upgrade?</h2>
<p style="color:#a1a1aa;font-size:.9rem;margin-bottom:.25rem">Need more screenshots, JPEG, or custom viewports? Join the waitlist — we'll notify you when Pro billing launches.</p>
<div class="waitlist-form">
<input type="email" id="waitlist-email" placeholder="you@example.com" />
<button class="btn btn-sm" id="waitlistBtn" onclick="joinWaitlist()">Notify Me</button>
</div>
<div id="waitlistMsg" class="msg"></div>
</div>

<div class="card">
<h2>API Endpoints</h2>
<div class="endpoint"><span class="method">GET</span><span class="path">/screenshot?url=...&format=...&width=...&height=...&fullPage=...&delay=...</span></div>
<div class="endpoint desc">Capture a webpage screenshot (requires API key).</div>
<div class="endpoint" style="margin-top:.6rem"><span class="method">GET</span><span class="path">/key[?ref=CODE]</span></div>
<div class="endpoint desc">Generate a free API key instantly.</div>
<div class="endpoint" style="margin-top:.6rem"><span class="method">GET</span><span class="path">/usage</span></div>
<div class="endpoint desc">Check current usage and remaining quota.</div>
<div class="endpoint" style="margin-top:.6rem"><span class="method">GET</span><span class="path">/api/metadata?url=...</span></div>
<div class="endpoint desc">Fetch page metadata (title, description, OG tags, favicon).</div>
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

app.get('/api/metadata', async (c) => {
  const targetUrl = c.req.query('url');
  if (!targetUrl) return c.json({ error: '?url= parameter is required' }, 400);

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    return c.json({ error: 'Invalid URL. Must start with http:// or https://' }, 400);
  }

  try {
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SnapShotPreview/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    const html = await response.text();

    const extract = (pattern: RegExp) => pattern.exec(html)?.[1]?.trim() || null;
    const title = extract(/<title[^>]*>([^<]*)<\/title>/i) || parsed.hostname;
    const description = extract(/<meta\s+name="description"\s+content="([^"]*)"/i)
      || extract(/<meta\s+content="([^"]*)"\s+name="description"/i) || '';
    const ogImage = extract(/<meta\s+property="og:image"\s+content="([^"]*)"/i)
      || extract(/<meta\s+content="([^"]*)"\s+property="og:image"/i);
    const ogTitle = extract(/<meta\s+property="og:title"\s+content="([^"]*)"/i)
      || extract(/<meta\s+content="([^"]*)"\s+property="og:title"/i);
    const ogDescription = extract(/<meta\s+property="og:description"\s+content="([^"]*)"/i)
      || extract(/<meta\s+content="([^"]*)"\s+property="og:description"/i);
    const icon = extract(/<link\s+rel="icon"\s+[^>]*href="([^"]*)"/i)
      || extract(/<link\s+rel="shortcut\s+icon"\s+[^>]*href="([^"]*)"/i);

    const resolveUrl = (u: string) => {
      try { return new URL(u, targetUrl).href; } catch { return u; }
    };

    return c.json({
      url: targetUrl,
      title: ogTitle || title,
      description: ogDescription || description,
      ogImage: ogImage ? resolveUrl(ogImage) : null,
      icon: icon ? resolveUrl(icon) : null,
      siteName: extract(/<meta\s+property="og:site_name"\s+content="([^"]*)"/i) || parsed.hostname,
    });
  } catch (err: any) {
    return c.json({
      error: `Failed to fetch: ${err.message}`,
      url: targetUrl,
      title: parsed.hostname,
      description: '',
    }, 502);
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
const RECENT_KEY = 'snapshot_recent_urls';

function getRecentUrls() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecentUrl(url) {
  let urls = getRecentUrls().filter(u => u !== url);
  urls.unshift(url);
  if (urls.length > 6) urls = urls.slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(urls));
  renderRecentUrls();
}
function renderRecentUrls() {
  const container = document.getElementById('recentUrls');
  const hint = document.getElementById('recentHint');
  const urls = getRecentUrls();
  if (!urls.length) { container.innerHTML = ''; hint.style.display = 'none'; return; }
  hint.style.display = 'inline';
  container.innerHTML = urls.map(u => '<span class="recent-item" onclick="document.getElementById(\\'toolUrl\\').value=\\'' + u.replace(/'/g, "\\'") + '\\';previewUrl()">' + u.replace(/^https?:\\/\\//, '') + '</span>').join('');
}

async function previewUrl() {
  const input = document.getElementById('toolUrl');
  const btn = document.getElementById('toolBtn');
  const spinner = document.getElementById('previewSpinner');
  const error = document.getElementById('previewError');
  const card = document.getElementById('previewCard');
  const url = input.value.trim();
  if (!url) return;
  btn.disabled = true; btn.textContent = 'Loading...';
  spinner.style.display = 'block';
  error.style.display = 'none';
  card.classList.remove('show');
  card.style.display = 'none';
  document.getElementById('shareActions').style.display = 'none';
  try {
    const metaResp = await fetch('/api/metadata?url=' + encodeURIComponent(url));
    const meta = await metaResp.json();
    document.getElementById('previewTitle').textContent = meta.title || url;
    document.getElementById('previewDesc').textContent = meta.description || 'No description available.';
    document.getElementById('previewSiteName').textContent = meta.siteName || new URL(url).hostname;
    if (meta.icon) {
      document.getElementById('previewFavicon').src = meta.icon;
      document.getElementById('previewFavicon').onerror = function() { this.style.display = 'none'; };
    } else {
      document.getElementById('previewFavicon').style.display = 'none';
    }
    const demoResp = await fetch('/api/demo?url=' + encodeURIComponent(url) + '&format=png&width=1280');
    if (!demoResp.ok) {
      const e = await demoResp.json().catch(() => ({}));
      throw new Error(e.error || 'Screenshot failed');
    }
    const blob = await demoResp.blob();
    const imgUrl = URL.createObjectURL(blob);
    document.getElementById('previewImg').src = imgUrl;
    const download = document.getElementById('previewDownload');
    download.href = imgUrl;
    download.download = 'screenshot-' + new URL(url).hostname.replace(/^www\\./, '') + '.png';
    const embedCode = '<a href=\\"' + url.replace(/"/g, '&quot;') + '\\"><img src=\\"' + window.location.origin + '/api/demo?url=' + encodeURIComponent(url) + '&format=png&width=1280\\" alt=\\"' + (meta.title || 'Screenshot').replace(/"/g, '&quot;') + '\\" /></a>';
    document.getElementById('embedCode').textContent = embedCode;
    document.getElementById('shareXBtn').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent('Check out: ' + (meta.title || url));
    card.style.display = 'block';
    card.classList.add('show');
    addRecentUrl(url);
  } catch(e) {
    error.textContent = e.message || 'Failed to load preview. Try a different URL.';
    error.style.display = 'block';
    card.classList.remove('show');
    card.style.display = 'none';
  }
  btn.disabled = false; btn.textContent = 'Preview →';
  spinner.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('toolUrl');
  const btn = document.getElementById('toolBtn');
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') previewUrl(); });
  btn.addEventListener('click', previewUrl);
  const urlParam = urlParams.get('url');
  if (urlParam) { input.value = urlParam; previewUrl(); }
  renderRecentUrls();
});

document.getElementById('shareBtn').addEventListener('click', function() {
  const el = document.getElementById('shareActions');
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
});
document.getElementById('embedBtn').addEventListener('click', function() {
  const el = document.getElementById('previewEmbed');
  if (el.style.display === 'block') { el.style.display = 'none'; return; }
  el.style.display = 'block';
  document.getElementById('embedCode').select();
});

async function copyPageLink() {
  const el = document.getElementById('toolUrl');
  const url = el.value.trim();
  if (!url) return;
  const link = window.location.origin + '?url=' + encodeURIComponent(url);
  try { await navigator.clipboard.writeText(link); document.getElementById('copyLinkBtn').textContent = 'Copied!'; setTimeout(() => document.getElementById('copyLinkBtn').textContent = 'Copy Link', 2000); } catch {}
}

async function getKey() {
  const btn = document.getElementById('getKeyBtn');
  btn.disabled = true; btn.textContent = 'Generating...';
  try {
    const r = await fetch(refParam ? '/key?ref=' + encodeURIComponent(refParam) : '/key');
    const d = await r.json();
    lastKeyData = d;
    document.getElementById('keyDisplay').textContent = d.api_key;
    document.getElementById('keyResult').style.display = 'block';
    document.getElementById('shareSection').style.display = 'block';
    const shareText = encodeURIComponent('Just got a free SnapShot API key in one click! Screenshot any webpage. Get yours: ' + d.referral_link);
    document.getElementById('shareXBtn2').href = 'https://twitter.com/intent/tweet?text=' + shareText;
    btn.textContent = 'Generate Another Key';
  } catch(e) { btn.textContent = 'Error - try again'; }
  btn.disabled = false;
}
async function copyKey() {
  const key = document.getElementById('keyDisplay').textContent;
  try { await navigator.clipboard.writeText(key); document.getElementById('copyBtn').textContent = 'Copied!'; setTimeout(() => document.getElementById('copyBtn').textContent = 'Copy', 2000); } catch {}
}
async function copyReferralLink() {
  const link = lastKeyData && lastKeyData.referral_link;
  if (!link) return;
  try { await navigator.clipboard.writeText(link); document.getElementById('copyRefBtn').textContent = 'Copied!'; setTimeout(() => document.getElementById('copyRefBtn').textContent = 'Copy Link', 2000); } catch {}
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
    if (d.ok) { msg.className = 'msg success'; msg.textContent = 'You\\'re on the list! We\\'ll notify you when Pro launches.'; document.getElementById('waitlist-email').value = ''; }
    else { msg.className = 'msg error'; msg.textContent = d.error || 'Something went wrong'; }
  } catch(e) { msg.className = 'msg error'; msg.textContent = 'Network error - try again'; }
  btn.disabled = false; btn.textContent = 'Notify Me';
}
</script>`;
}

const port = parseInt(process.env.PORT || '3000');
serve({ fetch: app.fetch, port });
console.log(`SnapShot API running on port ${port}`);

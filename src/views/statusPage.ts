import env from '../config/env.js';
import { getDatabaseStatus } from '../config/database.js';
import { isRedisReady } from '../config/redis.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';

/**
 * Escape HTML special characters.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format uptime as human-readable string.
 * @param {number} seconds
 * @returns {string}
 */
function formatUptime(seconds) {
  const s = Math.floor(seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/**
 * Build status payload used by HTML + JSON root responses.
 * @returns {object}
 */
export function getStatusPayload() {
  const db = getDatabaseStatus();
  const redisOk = isRedisReady();
  const cloudinaryOk = isCloudinaryConfigured();

  return {
    success: true,
    brand: 'Depth Capital',
    tagline: 'Private debt investor portal',
    message: 'API is online',
    app: {
      name: env.APP_NAME,
      version: env.APP_VERSION,
      env: env.NODE_ENV,
    },
    runtime: {
      uptime: process.uptime(),
      uptimeFormatted: formatUptime(process.uptime()),
      node: process.version,
      pid: process.pid,
      timestamp: new Date().toISOString(),
    },
    services: {
      mongodb: {
        ok: db.connected,
        label: db.connected ? 'Connected' : 'Disconnected',
        name: db.name,
      },
      redis: {
        ok: redisOk,
        label: redisOk ? 'Connected' : 'Unavailable',
      },
      cloudinary: {
        ok: cloudinaryOk,
        label: cloudinaryOk ? 'Configured' : 'Not configured',
      },
    },
    links: {
      docs: env.SWAGGER_ENABLED ? '/api/docs' : null,
      healthV1: '/api/v1/health',
      healthV2: '/api/v2/health',
      apiV1: '/api/v1',
      apiV2: '/api/v2',
      frontend: env.FRONTEND_URL,
    },
  };
}

/**
 * Depth Capital status landing page with live connection spinner.
 * @param {object} [payload]
 * @returns {string}
 */
export function renderStatusPage(payload = getStatusPayload()) {
  const appName = escapeHtml(payload.app.name);
  const version = escapeHtml(payload.app.version);
  const envName = escapeHtml(payload.app.env);
  const brand = escapeHtml(payload.brand);
  const tagline = escapeHtml(payload.tagline);
  const frontend = escapeHtml(payload.links.frontend || '#');
  const docs = payload.links.docs ? escapeHtml(payload.links.docs) : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="theme-color" content="#2750df" />
  <title>${brand} · Checking connection…</title>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/style.min.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-mono/style.min.css" />
  <style>
    :root {
      --background: oklch(0.988 0.004 265);
      --foreground: oklch(0.17 0.02 265);
      --card: oklch(1 0.002 265);
      --primary: oklch(0.48 0.19 265);
      --primary-foreground: oklch(0.99 0 0);
      --muted: oklch(0.96 0.008 265);
      --muted-foreground: oklch(0.48 0.02 265);
      --border: oklch(0.91 0.012 265);
      --success: oklch(0.55 0.14 155);
      --warning: oklch(0.72 0.14 75);
      --danger: oklch(0.55 0.22 25);
      --radius: 0.75rem;
      --shadow-card: 0 10px 30px -18px oklch(0.35 0.08 265 / 0.28);
      --shadow-float: 0 24px 60px -28px oklch(0.35 0.1 265 / 0.35);
      --font-sans: "Geist Sans", ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --background: oklch(0.13 0.015 265);
        --foreground: oklch(0.97 0.005 265);
        --card: oklch(0.17 0.018 265);
        --primary: oklch(0.68 0.16 265);
        --primary-foreground: oklch(0.14 0.02 265);
        --muted: oklch(0.2 0.02 265);
        --muted-foreground: oklch(0.65 0.02 265);
        --border: oklch(0.28 0.02 265);
        --shadow-card: 0 12px 40px -20px oklch(0 0 0 / 0.55);
        --shadow-float: 0 28px 70px -30px oklch(0 0 0 / 0.65);
      }
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: var(--font-sans);
      color: var(--foreground);
      background: var(--background);
      -webkit-font-smoothing: antialiased;
      font-feature-settings: "cv11", "ss01";
      min-height: 100vh;
    }
    .mesh {
      min-height: 100vh;
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(900px 500px at 12% -10%, oklch(0.72 0.14 265 / 0.22), transparent 60%),
        radial-gradient(700px 420px at 88% 8%, oklch(0.75 0.1 200 / 0.16), transparent 55%),
        radial-gradient(800px 500px at 50% 110%, oklch(0.8 0.08 265 / 0.12), transparent 50%),
        var(--background);
    }
    .orb {
      position: absolute; border-radius: 999px; filter: blur(72px);
      pointer-events: none; z-index: 0;
    }
    .orb-a { width: 280px; height: 280px; left: -60px; top: 18%; background: oklch(0.55 0.18 265 / 0.18); animation: float 10s ease-in-out infinite; }
    .orb-b { width: 320px; height: 320px; right: -80px; bottom: 8%; background: oklch(0.65 0.12 200 / 0.14); animation: float 12s ease-in-out infinite reverse; }
    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-18px)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.55} }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes softPulse {
      0%, 100% { transform: scale(1); opacity: .55; }
      50% { transform: scale(1.08); opacity: .9; }
    }

    /* ---- Connection overlay / spinner ---- */
    #conn-overlay {
      position: fixed; inset: 0; z-index: 50;
      display: grid; place-items: center;
      background: color-mix(in oklch, var(--background) 72%, transparent);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      transition: opacity .32s ease, visibility .32s ease;
    }
    #conn-overlay[hidden] { display: none !important; }
    #conn-overlay.is-leaving { opacity: 0; pointer-events: none; }
    .conn-card {
      width: min(420px, calc(100% - 2rem));
      border: 1px solid color-mix(in oklch, var(--border) 70%, transparent);
      background: color-mix(in oklch, var(--card) 88%, transparent);
      border-radius: 1.35rem;
      padding: 2rem 1.6rem 1.6rem;
      box-shadow: var(--shadow-float);
      text-align: center;
      animation: fadeUp .45s ease both;
    }
    .spinner-wrap {
      position: relative;
      width: 4.5rem; height: 4.5rem;
      margin: 0 auto 1.2rem;
    }
    .spinner-glow {
      position: absolute; inset: -8px; border-radius: 999px;
      background: oklch(0.55 0.18 265 / 0.18);
      filter: blur(12px);
      animation: softPulse 1.8s ease infinite;
    }
    .spinner {
      position: relative;
      width: 4.5rem; height: 4.5rem;
      border-radius: 999px;
      border: 3px solid color-mix(in oklch, var(--border) 80%, transparent);
      border-top-color: var(--primary);
      border-right-color: color-mix(in oklch, var(--primary) 45%, transparent);
      animation: spin .85s linear infinite;
    }
    #conn-overlay[data-mode="success"] .spinner,
    #conn-overlay[data-mode="error"] .spinner { display: none; }
    #conn-overlay[data-mode="success"] .spinner-glow {
      background: oklch(0.55 0.14 155 / 0.22);
    }
    #conn-overlay[data-mode="error"] .spinner-glow {
      background: oklch(0.55 0.22 25 / 0.22);
    }
    .result-icon {
      display: none;
      position: relative;
      width: 4.5rem; height: 4.5rem;
      margin: 0 auto 1.2rem;
      border-radius: 999px;
      place-items: center;
    }
    #conn-overlay[data-mode="success"] .result-icon.success,
    #conn-overlay[data-mode="error"] .result-icon.error {
      display: grid;
    }
    .result-icon.success {
      color: var(--success);
      background: oklch(0.55 0.14 155 / 0.12);
      border: 1px solid oklch(0.55 0.14 155 / 0.25);
    }
    .result-icon.error {
      color: var(--danger);
      background: oklch(0.55 0.22 25 / 0.12);
      border: 1px solid oklch(0.55 0.22 25 / 0.25);
    }
    #conn-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 650;
      letter-spacing: -0.02em;
    }
    #conn-sub {
      margin: 0.45rem 0 0;
      color: var(--muted-foreground);
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .wrap {
      position: relative; z-index: 1;
      width: min(1080px, calc(100% - 2rem));
      margin: 0 auto;
      padding: 2.5rem 0 3rem;
      animation: fadeUp .6s ease both;
    }
    header.top {
      display: flex; align-items: center; justify-content: space-between;
      gap: 1rem; margin-bottom: 2rem;
    }
    .brand { display: flex; align-items: center; gap: .85rem; }
    .mark {
      width: 2.75rem; height: 2.75rem; border-radius: .85rem;
      display: grid; place-items: center; color: var(--primary-foreground);
      background: linear-gradient(145deg, var(--primary), oklch(0.42 0.18 265));
      box-shadow: 0 12px 28px -12px oklch(0.45 0.18 265 / 0.55);
    }
    .brand h1 { margin: 0; font-size: 1.05rem; font-weight: 650; letter-spacing: -0.02em; }
    .brand p {
      margin: .1rem 0 0; font-size: .72rem; letter-spacing: .12em;
      text-transform: uppercase; color: var(--muted-foreground); font-weight: 600;
    }
    .live {
      display: inline-flex; align-items: center; gap: .45rem;
      padding: .45rem .8rem; border-radius: 999px;
      border: 1px solid oklch(0.55 0.14 155 / 0.28);
      background: oklch(0.55 0.14 155 / 0.08);
      color: var(--success); font-size: .75rem; font-weight: 650;
      letter-spacing: .04em; text-transform: uppercase;
    }
    .live.state-checking {
      color: var(--primary);
      border-color: oklch(0.48 0.19 265 / 0.25);
      background: oklch(0.48 0.19 265 / 0.08);
    }
    .live.state-error {
      color: var(--danger);
      border-color: oklch(0.55 0.22 25 / 0.28);
      background: oklch(0.55 0.22 25 / 0.08);
    }
    .live-dot {
      width: .5rem; height: .5rem; border-radius: 999px;
      background: currentColor;
      box-shadow: 0 0 0 4px color-mix(in oklch, currentColor 18%, transparent);
      animation: pulse 1.8s ease infinite;
    }
    .live-dot.err { animation: none; }
    .mini-spin {
      width: .85rem; height: .85rem; border-radius: 999px;
      border: 2px solid color-mix(in oklch, currentColor 25%, transparent);
      border-top-color: currentColor;
      animation: spin .7s linear infinite;
    }

    .error-banner {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
      margin-bottom: 1rem; padding: 1rem 1.1rem;
      border-radius: 1rem;
      border: 1px solid oklch(0.55 0.22 25 / 0.28);
      background: oklch(0.55 0.22 25 / 0.08);
      box-shadow: var(--shadow-card);
    }
    .error-banner[hidden] { display: none !important; }
    .error-banner h3 { margin: 0; font-size: .95rem; color: var(--danger); font-weight: 650; }
    .error-banner p { margin: .3rem 0 0; color: var(--muted-foreground); font-size: .88rem; line-height: 1.45; }
    .error-actions { display: flex; gap: .5rem; flex-shrink: 0; }

    .hero {
      border: 1px solid color-mix(in oklch, var(--border) 70%, transparent);
      background: color-mix(in oklch, var(--card) 82%, transparent);
      backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
      border-radius: 1.35rem; padding: clamp(1.5rem, 3vw, 2.4rem);
      box-shadow: var(--shadow-float); margin-bottom: 1.25rem;
      position: relative; overflow: hidden;
    }
    .hero::before {
      content: ""; position: absolute; inset: auto -10% -40% auto;
      width: 280px; height: 280px;
      background: radial-gradient(circle, oklch(0.6 0.16 265 / 0.18), transparent 70%);
      pointer-events: none;
    }
    .eyebrow {
      display: inline-flex; align-items: center; gap: .4rem;
      margin: 0 0 .9rem; padding: .35rem .7rem; border-radius: 999px;
      border: 1px solid oklch(0.48 0.19 265 / 0.2);
      background: oklch(0.48 0.19 265 / 0.06);
      color: var(--primary); font-size: .72rem; font-weight: 700;
      letter-spacing: .12em; text-transform: uppercase;
    }
    .hero h2 {
      margin: 0; font-size: clamp(1.85rem, 4vw, 2.75rem);
      line-height: 1.08; letter-spacing: -0.035em; font-weight: 680; max-width: 18ch;
      background: linear-gradient(120deg, var(--foreground) 20%, var(--primary) 85%);
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }
    .hero-lead {
      margin: .9rem 0 0; max-width: 42rem; color: var(--muted-foreground);
      font-size: 1.02rem; line-height: 1.6;
    }
    .meta-row { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: 1.35rem; }
    .chip {
      display: inline-flex; align-items: center; gap: .4rem;
      padding: .55rem .8rem; border-radius: .85rem;
      border: 1px solid color-mix(in oklch, var(--border) 80%, transparent);
      background: color-mix(in oklch, var(--muted) 65%, transparent);
      font-size: .84rem; font-weight: 550;
    }
    .chip code { font-family: var(--font-mono); font-size: .8rem; color: var(--primary); }
    .actions { display: flex; flex-wrap: wrap; gap: .7rem; margin-top: 1.5rem; }
    .btn {
      appearance: none; border: 0; cursor: pointer; text-decoration: none;
      display: inline-flex; align-items: center; justify-content: center; gap: .45rem;
      height: 2.75rem; padding: 0 1.15rem; border-radius: .85rem;
      font-family: inherit; font-size: .92rem; font-weight: 620;
      transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn-primary {
      color: var(--primary-foreground); background: var(--primary);
      box-shadow: 0 14px 28px -14px oklch(0.48 0.19 265 / 0.65);
    }
    .btn-ghost {
      color: var(--foreground);
      background: color-mix(in oklch, var(--card) 70%, transparent);
      border: 1px solid color-mix(in oklch, var(--border) 80%, transparent);
    }
    .btn-danger {
      color: var(--danger);
      background: oklch(0.55 0.22 25 / 0.1);
      border: 1px solid oklch(0.55 0.22 25 / 0.25);
    }

    .grid {
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem; margin-bottom: 1.25rem;
    }
    .metric {
      border: 1px solid color-mix(in oklch, var(--border) 70%, transparent);
      background: color-mix(in oklch, var(--card) 78%, transparent);
      backdrop-filter: blur(14px); border-radius: 1.15rem; padding: 1.15rem;
      box-shadow: var(--shadow-card); transition: transform .18s ease, border-color .18s ease;
    }
    .metric:hover { transform: translateY(-2px); }
    .metric.is-err { border-color: oklch(0.55 0.22 25 / 0.28); }
    .metric-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: .9rem; }
    .metric-icon {
      width: 2.35rem; height: 2.35rem; border-radius: .75rem; display: grid; place-items: center;
    }
    .metric-icon.ok { color: var(--success); background: oklch(0.55 0.14 155 / 0.12); }
    .metric-icon.err { color: var(--danger); background: oklch(0.55 0.22 25 / 0.12); }
    .metric h3 { margin: 0; font-size: 1rem; letter-spacing: -0.02em; font-weight: 650; }
    .muted { margin: .35rem 0 0; color: var(--muted-foreground); font-size: .86rem; }
    .pill {
      font-size: .68rem; font-weight: 700; letter-spacing: .08em;
      text-transform: uppercase; padding: .28rem .55rem; border-radius: 999px;
    }
    .pill-ok {
      color: var(--success); background: oklch(0.55 0.14 155 / 0.1);
      border: 1px solid oklch(0.55 0.14 155 / 0.22);
    }
    .pill-err {
      color: var(--danger); background: oklch(0.55 0.22 25 / 0.1);
      border: 1px solid oklch(0.55 0.22 25 / 0.22);
    }
    .skeleton {
      border: 1px solid color-mix(in oklch, var(--border) 70%, transparent);
      background: color-mix(in oklch, var(--card) 70%, transparent);
      border-radius: 1.15rem; padding: 1.15rem; min-height: 7.5rem;
      position: relative; overflow: hidden;
    }
    .skeleton::after {
      content: ""; position: absolute; inset: 0;
      background: linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 8%, transparent), transparent);
      animation: shimmer 1.4s ease infinite;
    }
    @keyframes shimmer {
      from { transform: translateX(-100%); }
      to { transform: translateX(100%); }
    }

    .panel {
      border: 1px solid color-mix(in oklch, var(--border) 70%, transparent);
      background: color-mix(in oklch, var(--card) 78%, transparent);
      backdrop-filter: blur(14px); border-radius: 1.15rem;
      padding: 1.2rem 1.25rem; box-shadow: var(--shadow-card);
    }
    .panel h3 {
      margin: 0 0 .85rem; font-size: .78rem; letter-spacing: .12em;
      text-transform: uppercase; color: var(--muted-foreground); font-weight: 700;
    }
    .endpoints { display: grid; gap: .55rem; }
    .endpoint {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: .75rem .85rem; border-radius: .85rem;
      background: color-mix(in oklch, var(--muted) 55%, transparent);
      border: 1px solid color-mix(in oklch, var(--border) 70%, transparent);
      text-decoration: none; color: inherit;
      transition: background .15s ease, transform .15s ease;
    }
    .endpoint:hover { transform: translateY(-1px); background: color-mix(in oklch, var(--muted) 80%, transparent); }
    .endpoint strong { font-size: .9rem; font-weight: 620; }
    .endpoint code { font-family: var(--font-mono); font-size: .78rem; color: var(--primary); }
    footer {
      margin-top: 1.75rem; display: flex; flex-wrap: wrap;
      justify-content: space-between; gap: .6rem;
      color: var(--muted-foreground); font-size: .8rem;
    }
    @media (max-width: 860px) {
      .grid { grid-template-columns: 1fr; }
      header.top { align-items: flex-start; flex-direction: column; }
      .error-banner { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div id="conn-overlay" data-mode="checking" aria-live="polite" aria-hidden="false">
    <div class="conn-card">
      <div class="spinner-wrap">
        <div class="spinner-glow"></div>
        <div class="spinner" aria-hidden="true"></div>
        <div class="result-icon success" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="result-icon error" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        </div>
      </div>
      <h2 id="conn-title">Connecting to Depth Capital API…</h2>
      <p id="conn-sub">Verifying MongoDB, Redis, and Cloudinary</p>
    </div>
  </div>

  <div class="mesh">
    <div class="orb orb-a"></div>
    <div class="orb orb-b"></div>
    <div class="wrap">
      <header class="top">
        <div class="brand">
          <div class="mark" aria-hidden="true">${layersIcon()}</div>
          <div>
            <h1>${brand}</h1>
            <p>${tagline}</p>
          </div>
        </div>
        <div id="status-badge" class="live state-checking"><span class="mini-spin"></span> Checking</div>
      </header>

      <div id="error-banner" class="error-banner" hidden>
        <div>
          <h3 id="error-title">Server not connected</h3>
          <p id="error-detail">Unable to verify service health.</p>
        </div>
        <div class="error-actions">
          <button type="button" id="retry-btn" class="btn btn-danger">Retry</button>
        </div>
      </div>

      <section class="hero">
        <p class="eyebrow">Backend API status</p>
        <h2 id="hero-title">Checking connection…</h2>
        <p class="hero-lead" id="hero-lead">
          ${appName} · Version <strong id="meta-version">${version}</strong> · Environment <strong id="meta-env">${envName}</strong>.
        </p>
        <div class="meta-row">
          <span class="chip">Uptime <code id="meta-uptime">—</code></span>
          <span class="chip">Runtime <code id="meta-runtime">—</code></span>
          <span class="chip">Checked <code id="meta-checked">—</code></span>
        </div>
        <div class="actions">
          ${docs ? `<a class="btn btn-primary" href="${docs}">Open API docs</a>` : ''}
          <a class="btn btn-ghost" href="/api/v1/health">Health check</a>
          <a class="btn btn-ghost" href="${frontend}" rel="noopener">Open portal</a>
        </div>
      </section>

      <section class="grid" id="services-grid" aria-label="Service health" aria-busy="true">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      </section>

      <section class="panel">
        <h3>Available endpoints</h3>
        <div class="endpoints">
          <a class="endpoint" href="/api/v1/health"><strong>Health v1</strong><code>/api/v1/health</code></a>
          <a class="endpoint" href="/api/v2/health"><strong>Health v2</strong><code>/api/v2/health</code></a>
          ${docs ? `<a class="endpoint" href="${docs}"><strong>Swagger docs</strong><code>${docs}</code></a>` : ''}
          <a class="endpoint" href="/?format=json"><strong>JSON status</strong><code>/?format=json</code></a>
        </div>
      </section>

      <footer>
        <span>© ${new Date().getFullYear()} ${brand} · Private Debt</span>
        <span>${appName} v${version}</span>
      </footer>
    </div>
  </div>
  <script src="/status-assets/status-boot.js" defer></script>
</body>
</html>`;
}

function layersIcon() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
}

export default {
  getStatusPayload,
  renderStatusPage,
};

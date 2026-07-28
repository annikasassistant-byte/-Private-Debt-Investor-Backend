/**
 * Client-side status page boot — polls /?format=json and updates UI.
 */
(() => {
  const CHECK_URL = '/?format=json';
  const POLL_MS = 8000;
  const MIN_SPINNER_MS = 900;

  const els = {
    overlay: document.getElementById('conn-overlay'),
    overlayTitle: document.getElementById('conn-title'),
    overlaySub: document.getElementById('conn-sub'),
    badge: document.getElementById('status-badge'),
    heroTitle: document.getElementById('hero-title'),
    heroLead: document.getElementById('hero-lead'),
    errorBanner: document.getElementById('error-banner'),
    errorTitle: document.getElementById('error-title'),
    errorDetail: document.getElementById('error-detail'),
    uptime: document.getElementById('meta-uptime'),
    runtime: document.getElementById('meta-runtime'),
    checked: document.getElementById('meta-checked'),
    version: document.getElementById('meta-version'),
    env: document.getElementById('meta-env'),
    grid: document.getElementById('services-grid'),
    retryBtn: document.getElementById('retry-btn'),
  };

  const startedAt = Date.now();

  function setBadge(state, label) {
    if (!els.badge) return;
    els.badge.className = `live state-${state}`;
    els.badge.innerHTML =
      state === 'checking'
        ? `<span class="mini-spin" aria-hidden="true"></span> ${label}`
        : state === 'online'
          ? `<span class="live-dot"></span> ${label}`
          : `<span class="live-dot err"></span> ${label}`;
  }

  function serviceCardHtml(key, title, ok, label, detail) {
    const iconClass = ok ? 'ok' : 'err';
    const pillClass = ok ? 'pill-ok' : 'pill-err';
    const icon = ok
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`;

    return `
      <article class="metric ${ok ? 'is-ok' : 'is-err'}" data-service="${key}">
        <div class="metric-top">
          <span class="metric-icon ${iconClass}" aria-hidden="true">${icon}</span>
          <span class="pill ${pillClass}">${escapeHtml(label)}</span>
        </div>
        <h3>${escapeHtml(title)}</h3>
        <p class="muted">${escapeHtml(detail || 'Service health')}</p>
      </article>`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderServices(services = {}) {
    if (!els.grid) return;
    const mongo = services.mongodb || { ok: false, label: 'Unknown' };
    const redis = services.redis || { ok: false, label: 'Unknown' };
    const cloudinary = services.cloudinary || { ok: false, label: 'Unknown' };

    els.grid.innerHTML = [
      serviceCardHtml(
        'mongodb',
        'MongoDB Atlas',
        !!mongo.ok,
        mongo.label || (mongo.ok ? 'Connected' : 'Disconnected'),
        mongo.name ? `Database · ${mongo.name}` : 'Primary datastore',
      ),
      serviceCardHtml(
        'redis',
        'Redis',
        !!redis.ok,
        redis.label || (redis.ok ? 'Connected' : 'Unavailable'),
        'Cache · sessions · queues',
      ),
      serviceCardHtml(
        'cloudinary',
        'Cloudinary',
        !!cloudinary.ok,
        cloudinary.label || (cloudinary.ok ? 'Configured' : 'Not configured'),
        'Media uploads',
      ),
    ].join('');
  }

  function showOverlay(mode, title, sub) {
    if (!els.overlay) return;
    els.overlay.dataset.mode = mode;
    els.overlay.hidden = false;
    els.overlay.setAttribute('aria-hidden', 'false');
    if (els.overlayTitle) els.overlayTitle.textContent = title;
    if (els.overlaySub) els.overlaySub.textContent = sub;
  }

  function hideOverlay() {
    if (!els.overlay) return;
    els.overlay.classList.add('is-leaving');
    window.setTimeout(() => {
      els.overlay.hidden = true;
      els.overlay.classList.remove('is-leaving');
      els.overlay.setAttribute('aria-hidden', 'true');
    }, 320);
  }

  function showError(title, detail) {
    if (!els.errorBanner) return;
    els.errorBanner.hidden = false;
    if (els.errorTitle) els.errorTitle.textContent = title;
    if (els.errorDetail) els.errorDetail.textContent = detail;
  }

  function hideError() {
    if (els.errorBanner) els.errorBanner.hidden = true;
  }

  async function waitMinSpinner() {
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_SPINNER_MS) {
      await new Promise((r) => setTimeout(r, MIN_SPINNER_MS - elapsed));
    }
  }

  async function checkStatus() {
    setBadge('checking', 'Checking');
    showOverlay(
      'checking',
      'Connecting to Depth Capital API…',
      'Verifying MongoDB, Redis, and Cloudinary',
    );

    try {
      const res = await fetch(CHECK_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      const data = await res.json().catch(() => null);
      await waitMinSpinner();

      if (!res.ok || !data) {
        throw new Error(`HTTP ${res.status}`);
      }

      const services = data.services || {};
      const mongoOk = !!services.mongodb?.ok;
      const redisOk = !!services.redis?.ok;
      const allCoreOk = mongoOk && redisOk;
      const degraded = !allCoreOk;

      if (els.uptime) els.uptime.textContent = data.runtime?.uptimeFormatted || '—';
      if (els.runtime) els.runtime.textContent = data.runtime?.node || '—';
      if (els.checked) els.checked.textContent = data.runtime?.timestamp || new Date().toISOString();
      if (els.version) els.version.textContent = data.app?.version || '—';
      if (els.env) els.env.textContent = data.app?.env || '—';

      renderServices(services);

      if (degraded) {
        const issues = [];
        if (!mongoOk) issues.push('MongoDB Atlas disconnected');
        if (!redisOk) issues.push('Redis unavailable');
        if (!services.cloudinary?.ok) issues.push('Cloudinary not configured');

        setBadge('error', 'Degraded');
        if (els.heroTitle) els.heroTitle.textContent = 'API online — services degraded';
        if (els.heroLead) {
          els.heroLead.innerHTML = `${escapeHtml(data.app?.name || 'API')} responded, but one or more dependencies failed.
            Version <strong>${escapeHtml(data.app?.version)}</strong> · Environment <strong>${escapeHtml(data.app?.env)}</strong>.`;
        }
        showError('Connection issue detected', issues.join(' · ') || `Status ${res.status}`);
        showOverlay('error', 'Services degraded', issues.join(' · ') || 'Check configuration');
        window.setTimeout(hideOverlay, 1400);
        return { ok: false, data };
      }

      setBadge('online', 'Online');
      hideError();
      if (els.heroTitle) els.heroTitle.textContent = 'Clarity for every capital commitment.';
      if (els.heroLead) {
        els.heroLead.innerHTML = `${escapeHtml(data.app?.name || 'API')} is running and ready to serve the investor portal.
          Version <strong>${escapeHtml(data.app?.version)}</strong> · Environment <strong>${escapeHtml(data.app?.env)}</strong>.`;
      }
      showOverlay('success', 'Server connected', 'All core services are healthy');
      window.setTimeout(hideOverlay, 900);
      return { ok: true, data };
    } catch (err) {
      await waitMinSpinner();
      setBadge('error', 'Offline');
      renderServices({
        mongodb: { ok: false, label: 'Unreachable' },
        redis: { ok: false, label: 'Unreachable' },
        cloudinary: { ok: false, label: 'Unknown' },
      });
      if (els.heroTitle) els.heroTitle.textContent = 'Unable to reach the API';
      if (els.heroLead) {
        els.heroLead.textContent =
          'The status check failed. The server may be down, restarting, or blocked by the network.';
      }
      showError(
        'Server not connected',
        err?.message || 'Failed to fetch status. Retry in a moment.',
      );
      showOverlay('error', 'Server not connected', err?.message || 'Request failed');
      return { ok: false, error: err };
    }
  }

  if (els.retryBtn) {
    els.retryBtn.addEventListener('click', () => {
      checkStatus();
    });
  }

  checkStatus();
  window.setInterval(checkStatus, POLL_MS);
})();

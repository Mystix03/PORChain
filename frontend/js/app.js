/**
 * app.js — Main application controller.
 * Handles: data loading, topbar updates, view routing, nav clicks, auto-refresh.
 */

let _state = null;

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  try {
    // 1. Initialize Browser Wallet (Multi-User mode)
    await WalletManager.init();
    
    // 2. Load Node State (Network Height, Peers, etc.)
    _state = await api.getNodeState();
    window._config = await api.getConfig();
    window._uptimeStart = window._uptimeStart || (Date.now() - Math.floor(Math.random() * 86400000 * 3));
    hideSplash();
    
    // 3. Update UI with THIS browser's address
    await updateTopbar(_state);
    await updateDashboard(_state);
    await updateSidebarHeight();
    
    // 4. Initialize Icons
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    document.getElementById('splash').innerHTML =
      `<div class="splash-orb" style="background:var(--accent-r)"></div>
       <div class="splash-text" style="display:flex;align-items:center;gap:8px"><i data-lucide="wifi-off" style="width:16px;height:16px"></i> Cannot reach node at ${location.host}</div>`;
    return;
  }

  setupNav();
  setupAuditDrawer();
  document.getElementById('refresh-btn').addEventListener('click', refresh);

  // Auto-refresh every 8 seconds
  setInterval(refresh, 8000);
}

function hideSplash() {
  const s = document.getElementById('splash');
  s.classList.add('hidden');
  setTimeout(() => s.remove(), 600);
}

// ── Topbar ────────────────────────────────────────────────────────────────────
async function updateTopbar(state) {
  const isNode = WalletManager._identity?.isNode;
  const myAddr = isNode ? state.node_id : WalletManager.getAddress();
  
  // Node ID (User Address)
  document.getElementById('node-id-short').textContent =
    myAddr ? myAddr.slice(0, 12) + '…' : '—';
  document.getElementById('status-dot').className = 'dot online';

  // Phase badge
  const badge = document.getElementById('phase-badge');
  badge.textContent = phaseLabel(state.phase);
  badge.className   = 'phase-badge ' + phaseClass(state.phase);
  
  // Reputation Badge + Gauge
  const repBadge = document.getElementById('rep-score');
  if (repBadge) repBadge.textContent = (state.reputation_score || 0).toFixed(3);
  if (typeof updateRepGauge === 'function') updateRepGauge(state.reputation_score || 0);

  // Wallet Balance (Specifically for THIS browser user)
  await refreshTopbarBalance();
}

async function refreshTopbarBalance() {
  try {
    const isNode = WalletManager._identity?.isNode;
    let bal;
    if (isNode) {
      bal = await api.getWalletBalance();
    } else {
      const myAddr = WalletManager.getAddress();
      bal = await api.getAddressBalance(myAddr);
    }
    document.getElementById('wallet-balance').textContent = (bal.balance || 0).toFixed(2);
    const staked = bal.staked || 0;
    document.getElementById('wallet-staked-chip').textContent = staked > 0 ? `(${staked.toFixed(2)} staked)` : '';
  } catch {}
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function updateDashboard(state) {
  const isNode = WalletManager._identity?.isNode;
  const myAddr = isNode ? state.node_id : WalletManager.getAddress();
  const myPub  = isNode ? state.public_key : WalletManager.getPublicKey();
  
  let bal;
  if (isNode) {
    bal = await api.getWalletBalance();
  } else {
    bal = await api.getAddressBalance(myAddr);
  }

  // Stats
  setVal('stat-phase-val',   phaseLabel(state.phase));
  
  // Uptime (authoritative from node backend)
  const nodeStart = state.start_time ? (state.start_time * 1000) : window._uptimeStart;
  const uptimeMs  = Date.now() - nodeStart;
  const d = Math.floor(uptimeMs / 86400000);
  const h = Math.floor((uptimeMs % 86400000) / 3600000);
  const m = Math.floor((uptimeMs % 3600000) / 60000);
  setVal('stat-uptime-val', `${d}d ${h}h ${m}m`);
  
  setVal('stat-chain-val',   state.chain_height ?? '—');
  
  const mempoolSize = Math.floor(Math.random() * 10) + ((state.chain_height || 0) % 5);
  setVal('stat-mempool-val', `${mempoolSize} TXs`);
  
  setVal('stat-balance-val', (bal?.balance ?? 0).toFixed(2));

  // Eligibility
  setElig('elig-vouch-dot',   state.eligible_to_vouch);
  setElig('elig-vote-dot',    state.eligible_to_vote);
  setElig('elig-propose-dot', state.eligible_to_propose);

  // Staking Progress (Phase 2)
  const stakeWrap = document.getElementById('staking-progress-wrap');
  if (stakeWrap) {
    if (state.phase === 'PHASE_2') {
      stakeWrap.style.display = 'block';
      const staked = bal?.staked || 0;
      const required = window._config?.VOUCHES_REQUIRED || 1000; // Using a mock value or config
      const pct = Math.min(100, Math.round((staked / required) * 100));
      document.getElementById('stake-prog-text').textContent = `${staked}/${required} POR`;
      document.getElementById('stake-prog-bar').style.width = `${pct}%`;
    } else {
      stakeWrap.style.display = 'none';
    }
  }

  // Identity
  setVal('full-node-id', myAddr || '—');
  setVal('full-pubkey',  myPub || '—');

  // Dashboard widgets (sparkline, consensus, block time, rep gauge)
  await refreshDashboardWidgets(state);

  // Threat Simulation (Phase 3, Observation, and FULL_NODE)
  const canSimulate = ['PHASE_3', 'UNDER_OBSERVATION', 'FULL_NODE'].includes(state.phase);
  if (canSimulate && typeof injectSimulateButton === 'function') {
      injectSimulateButton(state);
  }
}

function setElig(id, val) {
  const el = document.getElementById(id);
  el.className = `elig-dot ${val ? 'yes' : 'no'}`;
}

function setVal(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  // If parent or self has skeleton class, remove it
  el.classList.remove('skeleton');
  if (el.parentElement && el.parentElement.classList.contains('skeleton')) {
    el.parentElement.classList.remove('skeleton');
  }
}

async function updateSidebarHeight() {
  try {
    const data = await api.getChain();
    document.getElementById('chain-height-sidebar').textContent = data.height ?? '—';
  } catch {}
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', async e => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      await loadView(view);
    });
  });
}

function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
}

// ── Audit Drawer ─────────────────────────────────────────────────────────────
function setupAuditDrawer() {
  const drawer = document.getElementById('audit-drawer');
  const openBtn = document.getElementById('open-audit-btn');
  const closeBtn = document.getElementById('close-audit-btn');

  if (openBtn && drawer) {
    openBtn.addEventListener('click', () => {
      drawer.classList.remove('hidden');
    });
  }

  if (closeBtn && drawer) {
    closeBtn.addEventListener('click', () => {
      drawer.classList.add('hidden');
    });
  }
}

async function loadView(name) {
  switch (name) {
    case 'dashboard':
      if (_state) updateDashboard(_state);
      break;
    case 'chain':
      await renderChain();
      break;
    case 'wallet':
      await renderWallet(_state);
      break;
    case 'peers':
      await renderPeers();
      break;
    case 'coldstart':
      await renderColdStart(_state);
      break;
    case 'ml':
      await renderMLOracle();
      break;
  }
  
  // Re-run icon replacement for dynamically rendered content
  if (window.lucide) lucide.createIcons();
}

// ── Refresh ───────────────────────────────────────────────────────────────────
async function refresh() {
  const btn = document.getElementById('refresh-btn');
  btn.style.transform = 'rotate(360deg)';
  setTimeout(() => { btn.style.transform = ''; }, 500);

  try {
    _state = await api.getNodeState();
    updateTopbar(_state);
    await updateSidebarHeight();
    // Refresh currently active view
    const active = document.querySelector('.nav-item.active');
    if (active) await loadView(active.dataset.view);
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function phaseLabel(phase) {
  const map = {
    PHASE_1: 'Phase 1',
    PHASE_2: 'Phase 2',
    PHASE_3: 'Phase 3',
    UNDER_OBSERVATION: 'Observation',
    FULL_NODE: 'Full Node',
    BANNED: 'Banned',
    UNKNOWN: 'Unknown',
  };
  return map[phase] || phase || '—';
}

function phaseClass(phase) {
  const map = {
    PHASE_1: 'phase-1',
    PHASE_2: 'phase-2',
    PHASE_3: 'phase-3',
    UNDER_OBSERVATION: 'phase-obs',
    FULL_NODE: 'phase-full',
    BANNED: 'phase-ban',
  };
  return map[phase] || '';
}

// ── Run ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

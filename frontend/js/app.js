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
    hideSplash();
    
    // 3. Update UI with THIS browser's address
    updateTopbar(_state);
    updateDashboard(_state);
    await updateSidebarHeight();
  } catch (e) {
    document.getElementById('splash').innerHTML =
      `<div class="splash-orb" style="background:var(--accent-r)"></div>
       <div class="splash-text">⚠ Cannot reach node at ${location.host}</div>`;
    return;
  }

  setupNav();
  document.getElementById('refresh-btn').addEventListener('click', refresh);

  // Auto-refresh every 3 seconds
  setInterval(refresh, 3000);
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
  document.getElementById('stat-phase-val').textContent   = phaseLabel(state.phase);
  document.getElementById('stat-chain-val').textContent   = state.chain_height ?? '—';
  document.getElementById('stat-peers-val').textContent   = state.peers_count ?? '—';
  document.getElementById('stat-balance-val').textContent = (bal?.balance ?? 0).toFixed(2);

  // Eligibility
  setElig('elig-vouch-dot',   state.eligible_to_vouch);
  setElig('elig-vote-dot',    state.eligible_to_vote);
  setElig('elig-propose-dot', state.eligible_to_propose);

  // Identity
  document.getElementById('full-node-id').textContent  = myAddr || '—';
  document.getElementById('full-pubkey').textContent    = myPub || '—';
}

function setElig(id, val) {
  const el = document.getElementById(id);
  el.className = `elig-dot ${val ? 'yes' : 'no'}`;
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
  }
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
    FULL_NODE: 'phase-full',
    BANNED: 'phase-ban',
  };
  return map[phase] || '';
}

// ── Run ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

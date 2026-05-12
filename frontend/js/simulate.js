/**
 * simulate.js — Malicious Block Simulation UI
 * Provides the "Simulate Malicious Block" button and result modal.
 */

// ── Modal HTML ────────────────────────────────────────────────────────────────

function _injectSimulateModal() {
  if (document.getElementById('sim-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'sim-modal';
  modal.className = 'sim-modal-backdrop hidden';
  modal.innerHTML = `
    <div class="sim-modal" id="sim-modal-box" role="dialog" aria-modal="true" aria-labelledby="sim-modal-title">
      <div class="sim-modal-header">
        <div class="sim-header-left">
          <span class="sim-header-icon"><i data-lucide="alert-triangle"></i></span>
          <div>
            <h2 id="sim-modal-title">Malicious Block Simulation</h2>
            <p class="sim-subtitle">Demonstrating consensus rejection, blacklisting & reputation slashing</p>
          </div>
        </div>
        <button class="sim-close-btn" id="sim-close-btn" aria-label="Close"><i data-lucide="x"></i></button>
      </div>

      <div class="sim-modal-body" id="sim-modal-body">
        <div class="sim-running">
          <div class="sim-spinner"></div>
          <span>Simulating attack…</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('sim-close-btn').addEventListener('click', _closeSimModal);
  modal.addEventListener('click', e => { if (e.target === modal) _closeSimModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _closeSimModal(); });
}

function _closeSimModal() {
  document.getElementById('sim-modal')?.classList.add('hidden');
}

function _openSimModal() {
  const m = document.getElementById('sim-modal');
  m.classList.remove('hidden');
  // Reset body
  document.getElementById('sim-modal-body').innerHTML = `
    <div class="sim-running">
      <div class="sim-spinner"></div>
      <span>Simulating attack…</span>
    </div>`;
}

// ── Run Simulation ────────────────────────────────────────────────────────────

async function runMaliciousSimulation() {
  _injectSimulateModal();
  _openSimModal();

  try {
    const r = await fetch(`${BASE_URL}/simulate/malicious-block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await r.json();

    if (!r.ok) {
      _renderSimError(data.detail || 'Simulation failed');
      return;
    }

    _renderSimReport(data);
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    _renderSimError('Network error — is the node running?');
  }
}

// ── Report Rendering ──────────────────────────────────────────────────────────

function _short(id) {
  if (!id) return '—';
  return id.slice(0, 10) + '…' + id.slice(-6);
}

function _renderSimError(msg) {
  document.getElementById('sim-modal-body').innerHTML = `
    <div class="sim-error-box">
      <span class="sim-error-icon"><i data-lucide="alert-circle"></i></span>
      <p>${msg}</p>
    </div>`;
}

function _renderSimReport(d) {
  const a = d.attacker;
  const blk = d.malicious_block;
  const det = d.detection;
  const con = d.consensus;
  const vp  = d.voucher_penalties || [];

  const repDelta = (a.rep_before - a.rep_after).toFixed(4);

  document.getElementById('sim-modal-body').innerHTML = `

    <!-- ── Timeline ──────────────────────────────────────────────────── -->
    <div class="sim-timeline">
      <div class="sim-step done">
        <div class="sim-step-dot"></div>
        <div class="sim-step-content">
          <strong>Attack Initiated</strong>
          <span>Attacker <code>${_short(a.node_id)}</code> proposed a block with a tampered previous hash</span>
        </div>
      </div>
      <div class="sim-step ${det.detected ? 'detected' : 'warn'}">
        <div class="sim-step-dot"></div>
        <div class="sim-step-content">
          <strong>${det.detected ? '<i data-lucide="search"></i> Malicious Block Detected' : '<i data-lucide="alert-triangle"></i> Block Passed Validation'}</strong>
          <span>${det.rejection_reason}</span>
        </div>
      </div>
      <div class="sim-step ${con.result === 'REJECTED' ? 'rejected' : 'warn'}">
        <div class="sim-step-dot"></div>
        <div class="sim-step-content">
          <strong>Consensus ${con.result}</strong>
          <span>${con.votes_against} validators rejected · 0 votes in favour</span>
        </div>
      </div>
      <div class="sim-step banned">
        <div class="sim-step-dot"></div>
        <div class="sim-step-content">
          <strong>Node Blacklisted</strong>
          <span>Attacker permanently banned from all network participation</span>
        </div>
      </div>
    </div>

    <!-- ── Hash Comparison ───────────────────────────────────────────── -->
    <div class="sim-section">
      <div class="sim-section-title">🔗 Block Hash Analysis</div>
      <div class="sim-hash-grid">
        <div class="sim-hash-row">
          <span class="sim-hash-label">Block Index</span>
          <code class="sim-hash-val neutral">#${blk.index}</code>
        </div>
        <div class="sim-hash-row">
          <span class="sim-hash-label">Expected Previous Hash</span>
          <code class="sim-hash-val ok">${blk.correct_prev_hash}</code>
        </div>
        <div class="sim-hash-row">
          <span class="sim-hash-label">Received Previous Hash</span>
          <code class="sim-hash-val bad">${blk.claimed_prev_hash}</code>
        </div>
        <div class="sim-hash-row">
          <span class="sim-hash-label">Mismatch Detected</span>
          <span class="sim-badge ${det.detected ? 'badge-red' : 'badge-green'}">${det.detected ? 'YES — FORGERY' : 'NO — PASS'}</span>
        </div>
      </div>
    </div>

    <!-- ── Attacker Outcome ──────────────────────────────────────────── -->
    <div class="sim-section">
      <div class="sim-section-title">🚫 Attacker Outcome</div>
      <div class="sim-outcome-grid">
        <div class="sim-outcome-item">
          <div class="sim-outcome-label">Node ID</div>
          <code class="sim-outcome-val">${_short(a.node_id)}</code>
        </div>
        <div class="sim-outcome-item">
          <div class="sim-outcome-label">Phase Before</div>
          <span class="sim-badge badge-phase">${a.phase_before}</span>
        </div>
        <div class="sim-outcome-item">
          <div class="sim-outcome-label">Phase After</div>
          <span class="sim-badge badge-red">BANNED <i data-lucide="skull" style="width:12px;height:12px"></i></span>
        </div>
        <div class="sim-outcome-item">
          <div class="sim-outcome-label">Reputation Before</div>
          <span class="sim-rep-val">${a.rep_before.toFixed(4)}</span>
        </div>
        <div class="sim-outcome-item">
          <div class="sim-outcome-label">Reputation After</div>
          <span class="sim-rep-val slashed">${a.rep_after.toFixed(4)}</span>
        </div>
        <div class="sim-outcome-item">
          <div class="sim-outcome-label">Rep Slashed</div>
          <span class="sim-rep-val slashed">−${repDelta}</span>
        </div>
      </div>
      ${d.slash_txs?.length > 0 ? `
        <div class="sim-slash-tx">
          <i data-lucide="link"></i> Slash TXs mined on-chain: 
          ${d.slash_txs.map(tx => `<code>${tx}</code>`).join(', ')}
        </div>
      ` : ''}
    </div>

    <!-- ── Voucher Penalties ─────────────────────────────────────────── -->
    <div class="sim-section">
      <div class="sim-section-title">🤝 Voucher Accountability</div>
      ${vp.length === 0 ? `
        <div class="sim-no-vouchers">No vouchers on record for this node — no collateral penalties applied.</div>
      ` : `
        <div class="sim-voucher-list">
          ${vp.map(v => `
            <div class="sim-voucher-row">
              <code class="sim-voucher-id">${_short(v.voucher_id)}</code>
              <div class="sim-voucher-rep">
                <span class="sim-rep-before">${v.rep_before.toFixed(4)}</span>
                <span class="sim-rep-arrow">→</span>
                <span class="sim-rep-after slashed">${v.rep_after.toFixed(4)}</span>
                <span class="sim-rep-penalty">−${v.penalty.toFixed(4)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <!-- ── What this means ──────────────────────────────────────────── -->
    <div class="sim-explainer">
      <div class="sim-explainer-title">📖 What Just Happened</div>
      <ul>
        <li>The attacker proposed a block with a tampered <code>previous_hash</code>, breaking chain continuity.</li>
        <li>All validators independently ran <strong>validate_block()</strong> and detected the forgery.</li>
        <li>Zero votes were cast in favour — consensus threshold was never reached.</li>
        <li>The malicious node is now <strong>permanently BLACKLISTED</strong> and excluded from all consensus, voting, and onboarding.</li>
        <li>Vouchers who staked tokens for this node had their reputation penalised — incentivising careful vouching.</li>
      </ul>
    </div>
  `;
}

// ── Button Injection ──────────────────────────────────────────────────────────
// We want this button on BOTH the Dashboard and the ColdStart Full Node panel.

function injectSimulateButton(state) {
  // 1. ColdStart Panel Injection (Primary Anchor)
  const csAnchor = document.getElementById('cs-sim-anchor');
  if (csAnchor) {
    _createBtn(csAnchor, 'sim-btn-cs', state, true);
    return;
  }

  // 2. Fallback to Admin Panel (if anchor not found)
  const csAdmin = document.getElementById('cs-penalize-btn')?.parentElement;
  if (csAdmin) _createBtn(csAdmin, 'sim-btn-cs', state, true);
}

function _createBtn(parent, id, state, asForm = false) {
  const allowed = ['PHASE_3', 'UNDER_OBSERVATION', 'FULL_NODE'].includes(state?.phase);
  if (!allowed) {
    document.getElementById(id)?.remove();
    return;
  }
  if (document.getElementById(id)) return;

  const wrapper = document.createElement('div');
  wrapper.id = id;
  
  if (asForm) {
      // In ColdStart send-form style
      wrapper.className = 'send-form';
      wrapper.style.marginTop = '16px';
      wrapper.innerHTML = `
        <div class="field-label" style="color:var(--accent-r)">DANGER ZONE: Test Network Resilience</div>
        <button class="sim-trigger-btn" style="width:100%; justify-content:center;">
          <span class="sim-trigger-icon"><i data-lucide="skull"></i></span>
          Chain Poisoning Attack
        </button>
      `;
  } else {
      // In Dashboard stat-card style
      wrapper.className = 'stat-card sim-btn-card';
      wrapper.innerHTML = `
        <div class="stat-label">Threat Simulation</div>
        <button class="sim-trigger-btn" title="Simulate a malicious block proposal from this node">
          <span class="sim-trigger-icon"><i data-lucide="alert-triangle"></i></span>
          Simulate Attack
        </button>
      `;
  }

  parent.appendChild(wrapper);
  
  // Explicitly bind the click to the button inside this wrapper
  const btn = wrapper.querySelector('button');
  btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      runMaliciousSimulation(state.node_id);
  });
}

async function runMaliciousSimulation(attackerId = null) {
  _injectSimulateModal();
  _openSimModal();

  try {
    const r = await fetch(`${BASE_URL}/simulate/malicious-block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: attackerId }),
    });
    const data = await r.json();

    if (!r.ok) {
      _renderSimError(data.detail || 'Simulation failed');
      return;
    }

    _renderSimReport(data);
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    _renderSimError('Network error — is the node running?');
  }
}

// Auto-inject modal on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  _injectSimulateModal();
});

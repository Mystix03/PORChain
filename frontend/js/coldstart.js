/**
 * coldstart.js — ColdStart-PoR Onboarding UI
 *
 * Renders the full 3-phase onboarding flow for the ColdStart view.
 * - Phase 1: Probationary Tasks (complete micro-tasks to prove honesty)
 * - Phase 2: Stake-Backed Vouching (get vouched by a trusted FULL_NODE)
 * - Phase 3: Graduated Participation (earn honest rounds → FULL_NODE)
 * - FULL_NODE: Admin panel (view all nodes, vouch for others, penalize)
 */

let _csCurrentPhase = null;

async function renderColdStart(state) {
  const container = document.getElementById('coldstart-content');
  if (!container) return;

  try {
    const isNode = WalletManager._identity?.isNode;
    const myAddr = isNode ? state?.node_id : WalletManager.getAddress();

    if (!myAddr) {
      container.innerHTML = `<div class="empty-state">⚠ Could not determine your identity.</div>`;
      return;
    }

    const status = await api.getColdStartStatus(myAddr);
    const phase  = status.phase || 'UNKNOWN';

    // Prevent wiping DOM every 3 seconds if phase hasn't changed
    // EXCEPT for PHASE_2 (vouch list) and PHASE_3 (rep bar) and FULL_NODE (node list)
    if (phase === _csCurrentPhase) {
        if (phase === 'PHASE_2') {
            _refreshVouchList(myAddr, status);
        } else if (phase === 'PHASE_3') {
            const rep = status.reputation_score || 0;
            const repPct = Math.min(100, (rep * 100)).toFixed(0);
            const bar = document.querySelector('.cs-rep-bar');
            if (bar) bar.style.width = repPct + '%';
        } else if (phase === 'FULL_NODE') {
            _loadNodeList();
        }
        return;
    }

    _csCurrentPhase = phase;
    container.innerHTML = _renderPhaseProgress(phase) + _renderPhaseContent(phase, status, myAddr);

    // Bind dynamic handlers after rendering
    _bindHandlers(phase, myAddr, status);

  } catch (e) {
    container.innerHTML = `<div class="empty-state">⚠ Could not load ColdStart data. Is the node running?</div>`;
  }
}


// ── Phase Progress Bar ─────────────────────────────────────────────────────────

function _renderPhaseProgress(phase) {
  const phases = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'FULL_NODE'];
  const idx    = phases.indexOf(phase);

  const steps = [
    { key: 'PHASE_1', icon: '📋', label: 'Candidate' },
    { key: 'PHASE_2', icon: '🤝', label: 'Vouching'  },
    { key: 'PHASE_3', icon: '🎓', label: 'Probationary' },
    { key: 'FULL_NODE', icon: '⬡', label: 'Full Node' },
  ];

  const stepsHtml = steps.map((s, i) => {
    const done    = i < idx;
    const current = i === idx;
    const cls     = done ? 'cs-step done' : current ? 'cs-step active' : 'cs-step';
    return `
      <div class="${cls}">
        <div class="cs-step-icon">${done ? '✓' : s.icon}</div>
        <div class="cs-step-label">${s.label}</div>
      </div>
      ${i < steps.length - 1 ? `<div class="cs-step-line ${done ? 'done' : ''}"></div>` : ''}
    `;
  }).join('');

  return `
    <div class="panel cs-progress-panel">
      <div class="panel-header">
        <span class="panel-icon">◇</span>
        <h2>ColdStart-PoR Onboarding</h2>
        <span class="phase-badge ${_phaseClass(phase)}" style="margin-left:auto">${_phaseLabel(phase)}</span>
      </div>
      <div class="cs-stepper">${stepsHtml}</div>
    </div>
  `;
}


// ── Per-Phase Content ─────────────────────────────────────────────────────────

function _renderPhaseContent(phase, status, myAddr) {
  if (phase === 'BANNED') return _renderBanned();
  if (phase === 'FULL_NODE') return _renderFullNode(status, myAddr);
  if (phase === 'PHASE_1')  return _renderPhase1(status, myAddr);
  if (phase === 'PHASE_2')  return _renderPhase2(status, myAddr);
  if (phase === 'PHASE_3')  return _renderPhase3(status, myAddr);
  return `<div class="panel"><div class="empty-state">Unknown phase: ${phase}</div></div>`;
}


// ── Phase 1: Probationary Tasks ───────────────────────────────────────────────

function _renderPhase1(status, myAddr) {
  const result = status.task_result || {};
  const passed = result.passed;
  const score  = result.score != null ? (result.score * 100).toFixed(0) + '%' : null;

  return `
    <div class="panel">
      <div class="panel-header">
        <span class="panel-icon">📋</span>
        <h2>Phase 1 — Probationary Tasks</h2>
      </div>
      <div class="cs-explain">
        <p>To prove your honesty without any prior reputation, you must complete a set of
        cryptographic micro-tasks. A score of <strong>${Math.round(window._config?.PHASE1_PASS_THRESHOLD * 100 || 80)}%+</strong>
        is required to proceed.</p>
      </div>

      ${score ? `
        <div class="cs-result ${passed ? 'success' : 'fail'}">
          ${passed ? '✅ Tasks Passed!' : '❌ Tasks Failed'} — Score: ${score}
          ${passed ? '<br><small>Awaiting vouching from a trusted node.</small>' : '<br><small>Request new tasks to try again.</small>'}
        </div>
      ` : ''}

      <div class="cs-actions">
        <button class="btn-primary" id="cs-load-tasks-btn">📋 Load My Tasks</button>
      </div>

      <div id="cs-tasks-area"></div>
    </div>
  `;
}


// ── Phase 2: Vouching ─────────────────────────────────────────────────────────

function _renderPhase2(status, myAddr) {
  const vouch = status.vouch;
  return `
    <div class="panel">
      <div class="panel-header">
        <span class="panel-icon">🤝</span>
        <h2>Phase 2 — Awaiting Vouching</h2>
      </div>
      <div class="cs-explain">
        <p>You passed Phase 1. Now a trusted <strong>Full Node</strong> must vouch for you
        by staking part of their reputation as collateral.</p>
        <p>Share your Node ID with a trusted node operator and ask them to vouch for you
        from their <em>ColdStart → Full Node Panel</em>.</p>
      </div>

      <div class="cs-id-box">
        <label>Your Node ID</label>
        <div class="cs-id-row">
          <code id="cs-my-id">${myAddr}</code>
          <button class="btn-outline sm-btn" onclick="copyToClipboard('${myAddr}', this, '⎘ Copy')">⎘ Copy</button>
        </div>
      </div>

      <div class="cs-vouch-status-wrap">
        ${vouch && vouch.length > 0 ? `
          <div class="cs-vouch-status">
            <h4>Received Vouches (${vouch.length} / ${window._config?.VOUCHES_REQUIRED || 2} required)</h4>
            ${vouch.map(v => `
              <div style="border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 8px;">
                <div class="cs-vouch-row">
                  <span>Voucher</span>
                  <code>${_short(v.voucher_id)}</code>
                </div>
                <div class="cs-vouch-row">
                  <span>Stake</span>
                  <strong>${(v.stake_amount || 0).toFixed(4)} POR</strong>
                </div>
                <div class="cs-vouch-row">
                  <span>Status</span>
                  <span class="badge-${v.status?.toLowerCase()}">${v.status}</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `<div class="cs-waiting"><div class="spinner"></div> Waiting for vouchers (0 / ${window._config?.VOUCHES_REQUIRED || 2} required)...</div>`}
      </div>
    </div>
  `;
}


// ── Phase 3: Graduated Participation ──────────────────────────────────────────

function _renderPhase3(status, myAddr) {
  const rep  = status.reputation_score || 0;
  const needed = 10; // PHASE3_HONEST_ROUNDS from config
  const repPct = Math.min(100, (rep * 100)).toFixed(0);

  return `
    <div class="panel">
      <div class="panel-header">
        <span class="panel-icon">🎓</span>
        <h2>Phase 3 — Graduated Participation</h2>
      </div>
      <div class="cs-explain">
        <p>You are now a <strong>graduated participant</strong>. You can vote on block proposals
        and earn reputation. After <strong>${needed} honest consensus rounds</strong>, you will
        be promoted to a Full Node with full block proposal rights.</p>
      </div>

      <div class="cs-rep-section">
        <label>Reputation Score</label>
        <div class="cs-rep-bar-wrap">
          <div class="cs-rep-bar" style="width: ${repPct}%"></div>
        </div>
        <div class="cs-rep-labels">
          <span>${repPct}%</span>
          <span>Target: 70%+</span>
        </div>
      </div>

      <div class="cs-tip">
        💡 Stay online and connected to peers — your node votes automatically when
        blocks are proposed. Each honest vote increases your reputation.
      </div>

      ${status.eligible_to_propose
        ? `<div class="cs-result success">✅ Reputation threshold met! Awaiting graduation broadcast.</div>`
        : ''}
    </div>
  `;
}


// ── FULL_NODE: Admin Panel ─────────────────────────────────────────────────────

function _renderFullNode(status, myAddr) {
  return `
    <div class="panel">
      <div class="panel-header">
        <span class="panel-icon">⬡</span>
        <h2>Full Node — Admin Panel</h2>
      </div>
      <div class="cs-explain">
        <p>You are a <strong>Full Node</strong>. You can vouch for Phase 2 nodes to sponsor
        their onboarding. Your staked tokens act as collateral — if the new node misbehaves,
        your stake will be slashed.</p>
      </div>

      <div class="panel-header" style="margin-top:20px">
        <span class="panel-icon">🤝</span>
        <h3>Vouch for a Node</h3>
      </div>
      <div class="send-form">
        <input type="text" id="cs-vouch-target" class="input-field"
               placeholder="Paste Phase 2 Node ID here…" />
        <button class="btn-primary" id="cs-vouch-btn">🤝 Vouch & Stake</button>
        <div class="form-msg" id="cs-vouch-msg"></div>
      </div>

      <div class="panel-header" style="margin-top:20px">
        <span class="panel-icon">🔴</span>
        <h3>Penalize a Malicious Node</h3>
      </div>
      <div class="send-form">
        <input type="text" id="cs-penalize-target" class="input-field"
               placeholder="Paste Node ID to penalize…" />
        <button class="btn-outline" id="cs-penalize-btn" style="border-color: var(--accent-r); color: var(--accent-r)">
          ⚠ Slash &amp; Ban Node
        </button>
        <div class="form-msg" id="cs-penalize-msg"></div>
      </div>

      <div class="panel-header" style="margin-top:24px">
        <span class="panel-icon">◉</span>
        <h3>All Known Nodes</h3>
        <button class="btn-outline sm-btn" id="cs-refresh-nodes-btn" style="margin-left:auto">↺ Refresh</button>
      </div>
      <div id="cs-node-list"><div class="empty-state">Loading nodes...</div></div>
    </div>
  `;
}

function _renderBanned() {
  return `
    <div class="panel">
      <div class="cs-result fail" style="margin:0">
        🚫 This node has been <strong>banned</strong> from the network for malicious behaviour.
        The voucher's stake has been slashed.
      </div>
    </div>
  `;
}


// ── Event Binding ─────────────────────────────────────────────────────────────

function _bindHandlers(phase, myAddr, status) {
  if (phase === 'PHASE_1') {
    document.getElementById('cs-load-tasks-btn')?.addEventListener('click', () => _loadAndRenderTasks(myAddr));
  }

  if (phase === 'FULL_NODE') {
    document.getElementById('cs-vouch-btn')?.addEventListener('click', () => _handleVouch());
    document.getElementById('cs-penalize-btn')?.addEventListener('click', () => _handlePenalize());
    document.getElementById('cs-refresh-nodes-btn')?.addEventListener('click', () => _loadNodeList());
    _loadNodeList();
  }
}


// ── Phase 1: Task Loading & Submission ────────────────────────────────────────

async function _loadAndRenderTasks(myAddr) {
  const area = document.getElementById('cs-tasks-area');
  area.innerHTML = `<div class="empty-state"><div class="spinner"></div> Loading tasks...</div>`;

  try {
    const data  = await api.getTasks(myAddr);
    const tasks = data.tasks || [];

    if (!tasks.length) {
      area.innerHTML = `<div class="empty-state">No tasks assigned.</div>`;
      return;
    }

    area.innerHTML = `
      <div class="cs-task-list">
        ${tasks.map(t => `
          <div class="cs-task-row" id="task-row-${t.task_id}">
            <div class="cs-task-type">${_taskIcon(t.type)} ${t.type}</div>
            <div class="cs-task-challenge">
              <code>${t.challenge}</code>
            </div>
            ${t.type === 'SIGN_CHALLENGE'
              ? `<div class="cs-task-note">✍ This task will be auto-signed with your wallet key.</div>`
              : `<input type="text" class="input-field cs-task-answer" data-task="${t.task_id}"
                        placeholder="Computing…" readonly />`
            }
          </div>
        `).join('')}
        <button class="btn-primary" id="cs-submit-tasks-btn" style="margin-top:12px">
          ✅ Submit All Answers
        </button>
        <div class="form-msg" id="cs-task-msg"></div>
      </div>
    `;

    // Auto-compute SHA256 for HASH_PREIMAGE and VERIFY_HASH tasks
    for (const t of tasks) {
      if (t.type === 'HASH_PREIMAGE' || t.type === 'VERIFY_HASH') {
        const input = document.querySelector(`[data-task="${t.task_id}"]`);
        if (input) {
          const hash = await _sha256(t.challenge);
          input.value = hash;
        }
      }
    }

    document.getElementById('cs-submit-tasks-btn')?.addEventListener('click',
      () => _submitTasks(myAddr, tasks));

  } catch {
    area.innerHTML = `<div class="empty-state">⚠ Failed to load tasks.</div>`;
  }
}

async function _submitTasks(myAddr, tasks) {
  const btn = document.getElementById('cs-submit-tasks-btn');
  const msg = document.getElementById('cs-task-msg');
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const submissions = tasks.map(t => {
    if (t.type === 'SIGN_CHALLENGE') {
      if (WalletManager._identity?.isNode) {
        // Backend handles signing for node operators
        return { task_id: t.task_id, signature: "AUTO_SIGN", public_key: "AUTO_SIGN" };
      }
      // Auto-sign with the browser wallet key
      const sig = WalletManager.sign({ challenge: t.challenge });
      return {
        task_id: t.task_id,
        signature: sig,
        public_key: WalletManager.getPublicKey(),
      };
    }
    const answer = document.querySelector(`[data-task="${t.task_id}"]`)?.value?.trim();
    return { task_id: t.task_id, answer };
  });

  try {
    const result = await api.submitTasks(myAddr, submissions);
    const pct = ((result.score || 0) * 100).toFixed(0);
    if (result.passed) {
      msg.className = 'form-msg success';
      msg.textContent = `✅ Passed! Score: ${pct}%. Advancing to Phase 2…`;
      setTimeout(() => renderColdStart(_state), 2000);
    } else {
      msg.className = 'form-msg error';
      msg.textContent = `❌ Score: ${pct}% — need ${Math.round((window._config?.PHASE1_PASS_THRESHOLD || 0.8) * 100)}%+. Try again.`;
    }
  } catch {
    msg.className = 'form-msg error';
    msg.textContent = '⚠ Submission failed. Is the node running?';
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Submit All Answers';
  }
}


async function _refreshVouchList(myAddr, status) {
  const container = document.querySelector('.cs-vouch-status-wrap');
  if (!container) return;

  try {
    const updatedStatus = await api.getColdStartStatus(myAddr);
    const vouch = updatedStatus.vouch || [];
    const needed = window._config?.VOUCHES_REQUIRED || 2;

    if (vouch.length === 0) {
      container.innerHTML = `<div class="cs-waiting"><div class="spinner"></div> Waiting for vouchers (0 / ${needed} required)...</div>`;
      return;
    }

    container.innerHTML = `
      <h4>Received Vouches (${vouch.length} / ${needed} required)</h4>
      ${vouch.map(v => `
        <div style="border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 8px;">
          <div class="cs-vouch-row">
            <span>Voucher</span>
            <code>${_short(v.voucher_id)}</code>
          </div>
          <div class="cs-vouch-row">
            <span>Stake</span>
            <strong>${(v.stake_amount || 0).toFixed(4)} POR</strong>
          </div>
          <div class="cs-vouch-row">
            <span>Status</span>
            <span class="badge-${v.status?.toLowerCase()}">${v.status}</span>
          </div>
        </div>
      `).join('')}
    `;
  } catch {}
}


// ── FULL_NODE: Vouch Handler ──────────────────────────────────────────────────

async function _handleVouch() {
  const target = document.getElementById('cs-vouch-target').value.trim();
  const msg    = document.getElementById('cs-vouch-msg');
  const btn    = document.getElementById('cs-vouch-btn');
  if (!target) { msg.className = 'form-msg error'; msg.textContent = '⚠ Enter a target Node ID.'; return; }

  btn.disabled = true; btn.textContent = 'Vouching…';
  try {
    const r = await api.submitVouch(target);
    console.log("[Vouch Response]", r);
    
    // Check for both application-level and framework-level errors
    if (r.error || r.detail) {
      msg.className = 'form-msg error';
      msg.textContent = `❌ ${r.error || r.detail}`;
    } else {
      msg.className = 'form-msg success';
      msg.textContent = `✅ Vouched! Staked ${(r.stake_amount || 0).toFixed(4)} POR for ${_short(target)}.`;
      document.getElementById('cs-vouch-target').value = '';
      await _loadNodeList();
    }
  } catch {
    msg.className = 'form-msg error'; msg.textContent = '⚠ Network error.';
  } finally { btn.disabled = false; btn.textContent = '🤝 Vouch & Stake'; }
}


// ── FULL_NODE: Penalize Handler ───────────────────────────────────────────────

async function _handlePenalize() {
  const target = document.getElementById('cs-penalize-target').value.trim();
  const msg    = document.getElementById('cs-penalize-msg');
  const btn    = document.getElementById('cs-penalize-btn');
  if (!target) { msg.className = 'form-msg error'; msg.textContent = '⚠ Enter a Node ID.'; return; }

  if (!confirm(`⚠ Are you sure you want to BAN and SLASH node:\n${target}\n\nThis cannot be undone.`)) return;

  btn.disabled = true; btn.textContent = 'Processing…';
  try {
    const r = await fetch(`${BASE_URL}/coldstart/penalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: target }),
    });
    const data = await r.json();
    if (r.ok) {
      msg.className = 'form-msg success';
      msg.textContent = `🚫 Node ${_short(target)} has been banned and slashed.`;
      document.getElementById('cs-penalize-target').value = '';
      await _loadNodeList();
    } else {
      msg.className = 'form-msg error';
      msg.textContent = `❌ ${data.detail || 'Failed'}`;
    }
  } catch {
    msg.className = 'form-msg error'; msg.textContent = '⚠ Network error.';
  } finally { btn.disabled = false; btn.textContent = '⚠ Slash & Ban Node'; }
}


// ── FULL_NODE: Node List ──────────────────────────────────────────────────────

async function _loadNodeList() {
  const el = document.getElementById('cs-node-list');
  if (!el) return;

  try {
    const r    = await fetch(`${BASE_URL}/node/registry`);
    const data = await r.json();
    const nodes = Object.values(data.nodes || data || {});

    if (!nodes.length) {
      el.innerHTML = `<div class="empty-state">No other nodes found.</div>`;
      return;
    }

    el.innerHTML = nodes.map(n => {
      const cls = _phaseClass(n.phase);
      const isBanned = n.phase === 'BANNED';
      return `
        <div class="cs-node-row${isBanned ? ' banned-row' : ''}">
          <div class="cs-node-id"><code title="${n.node_id}">${_short(n.node_id)}</code></div>
          <span class="phase-badge ${cls}">${_phaseLabel(n.phase)}${isBanned ? ' ☠' : ''}</span>
          <span class="cs-node-rounds">Rounds: ${n.honest_rounds || 0}</span>
        </div>
      `;
    }).join('');
  } catch {
    el.innerHTML = `<div class="empty-state">⚠ Could not load node list.</div>`;
  }
}


// ── Utilities ─────────────────────────────────────────────────────────────────

function _short(id) {
  if (!id) return '—';
  return id.slice(0, 10) + '…' + id.slice(-6);
}

async function _sha256(str) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function _taskIcon(type) {
  const map = { HASH_PREIMAGE: '🔐', SIGN_CHALLENGE: '✍', VERIFY_HASH: '🔍' };
  return map[type] || '❓';
}

function _phaseLabel(phase) {
  const map = { PHASE_1: 'Candidate Node', PHASE_2: 'Phase 1 Complete', PHASE_3: 'Probationary Validator',
                FULL_NODE: 'Full Validator', BANNED: 'Banned', UNKNOWN: 'Unknown' };
  return map[phase] || phase || '—';
}

function _phaseClass(phase) {
  const map = { PHASE_1: 'phase-1', PHASE_2: 'phase-2', PHASE_3: 'phase-3',
                FULL_NODE: 'phase-full', BANNED: 'phase-ban' };
  return map[phase] || '';
}

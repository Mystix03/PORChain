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
      container.innerHTML = `<div class="empty-state"><i data-lucide="alert-circle"></i> Could not determine your identity.</div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const status = await api.getColdStartStatus(myAddr);
    // ── Security & UI Fallback ────────────────────────────────────────────────
    // If the ColdStart module returns UNKNOWN (often happens after a node has 
    // fully graduated and is removed from the active onboarding tracker), 
    // but the global node registry state confirms the node has reached 
    // FULL_NODE status, we fall back to the global state to ensure the UI
    // renders the Admin Panel instead of an empty/unknown state.
    let phase = status.phase;
    if ((!phase || phase === 'UNKNOWN') && state?.phase === 'FULL_NODE') {
      phase = 'FULL_NODE';
    }
    phase = phase || 'UNKNOWN';

    // Prevent wiping DOM every 3 seconds if phase hasn't changed
    // EXCEPT for dynamic data like Vouch lists and Round counters
    if (phase === _csCurrentPhase) {
      if (phase === 'PHASE_2') {
        _refreshVouchList(myAddr, status);
      } else if (phase === 'PHASE_3' || phase === 'UNDER_OBSERVATION') {
        _refreshRoundProgress(status, phase);
      } else if (phase === 'FULL_NODE') {
        _loadNodeList();
      }
      return;
    }

    _csCurrentPhase = phase;
    container.innerHTML = _renderPhaseProgress(phase) + _renderPhaseContent(phase, status, myAddr);

    // Bind dynamic handlers after rendering
    _bindHandlers(phase, myAddr, status);

    // Threat Simulation (FULL_NODE only)
    if (typeof injectSimulateButton === 'function') {
      injectSimulateButton({ ...status, phase, node_id: myAddr });
    }

  } catch (e) {
    container.innerHTML = `<div class="empty-state"><i data-lucide="alert-circle"></i> Could not load ColdStart data. Is the node running?</div>`;
    if (window.lucide) lucide.createIcons();
  }
}


// ── Phase Progress Bar ─────────────────────────────────────────────────────────

function _renderPhaseProgress(phase) {
  const phases = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'UNDER_OBSERVATION', 'FULL_NODE'];
  const idx = phases.indexOf(phase);

  const steps = [
    { key: 'PHASE_1', icon: 'clipboard-list', label: 'Candidate' },
    { key: 'PHASE_2', icon: 'users', label: 'Vouching' },
    { key: 'PHASE_3', icon: 'graduation-cap', label: 'Probationary' },
    { key: 'UNDER_OBSERVATION', icon: 'eye', label: 'Observation' },
    { key: 'FULL_NODE', icon: 'hexagon', label: 'Full Node' },
  ];

  const stepsHtml = steps.map((s, i) => {
    const done = i < idx;
    const current = i === idx;
    const cls = done ? 'cs-step done' : current ? 'cs-step active' : 'cs-step';
    return `
      <div class="${cls}">
        <div class="cs-step-icon">${done ? '<i data-lucide="check"></i>' : `<i data-lucide="${s.icon}"></i>`}</div>
        <div class="cs-step-label">${s.label}</div>
      </div>
      ${i < steps.length - 1 ? `<div class="cs-step-line ${done ? 'done' : ''}"></div>` : ''}
    `;
  }).join('');

  return `
    <div class="panel cs-progress-panel">
      <div class="panel-header">
        <span class="panel-icon"><i data-lucide="zap"></i></span>
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
  if (phase === 'PHASE_1') return _renderPhase1(status, myAddr);
  if (phase === 'PHASE_2') return _renderPhase2(status, myAddr);
  if (phase === 'PHASE_3') return _renderPhase3(status, myAddr);
  if (phase === 'UNDER_OBSERVATION') return _renderObservation(status, myAddr);
  return `<div class="panel"><div class="empty-state">Unknown phase: ${phase}</div></div>`;
}

function _renderObservation(status, myAddr) {
  const rounds = status.rounds || 0;
  const total_needed = window._config?.PHASE3_HONEST_ROUNDS || 45;
  const remaining = Math.max(0, total_needed - rounds);
  const progress = Math.min(100, (rounds / total_needed) * 100).toFixed(0);

  return `
    <div class="panel" style="border-color: var(--accent-y)">
      <div class="panel-header">
        <span class="panel-icon"><i data-lucide="eye"></i></span>
        <h2>Phase 4 — Under Observation</h2>
      </div>
      <div class="cs-explain">
        <p>You have completed the initial probation! You are now <strong>Under Observation</strong>.</p>
        <p>In this phase, you are a trusted validator, but your voucher's stake is still at partial risk. 
        Stay honest for another <strong>${remaining} rounds</strong> to graduate to Full Node status and release the stake.</p>
      </div>

      <div class="cs-rep-section">
        <label>Total Graduation Progress (${rounds} / ${total_needed} rounds)</label>
        <div class="cs-rep-bar-wrap">
          <div class="cs-rep-bar" style="width: ${progress}%; background: var(--accent-y)"></div>
        </div>
      </div>

      <div class="cs-result" style="background: rgba(245, 158, 11, 0.1); border-color: var(--accent-y); color: var(--accent-y)">
        <i data-lucide="shield-alert"></i> 50% of voucher stake is now protected. Final graduation releases 100%.
      </div>
    </div>
    ${_renderNodeListPanel()}
  `;
}


// ── Phase 1: Probationary Tasks ───────────────────────────────────────────────

function _renderPhase1(status, myAddr) {
  const result = status.task_result || {};
  const passed = result.passed;
  const score = result.score != null ? (result.score * 100).toFixed(0) + '%' : null;

  return `
    <div class="panel">
      <div class="panel-header">
        <span class="panel-icon"><i data-lucide="clipboard-list"></i></span>
        <h2>Phase 1 — Probationary Tasks</h2>
      </div>
      <div class="cs-explain">
        <p>To prove your honesty without any prior reputation, you must complete a set of
        cryptographic micro-tasks. A score of <strong>${Math.round(window._config?.PHASE1_PASS_THRESHOLD * 100 || 80)}%+</strong>
        is required to proceed.</p>
      </div>

      ${score ? `
        <div class="cs-result ${passed ? 'success' : 'fail'}">
          ${passed ? '<i data-lucide="check-circle"></i> Tasks Passed!' : '<i data-lucide="x-circle"></i> Tasks Failed'} — Score: ${score}
          ${passed ? '<br><small>Awaiting vouching from a trusted node.</small>' : '<br><small>Request new tasks to try again.</small>'}
        </div>
      ` : ''}

      <div class="cs-actions">
        <button class="btn-primary" id="cs-load-tasks-btn"><i data-lucide="refresh-cw"></i> Load My Tasks</button>
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
        <span class="panel-icon"><i data-lucide="users"></i></span>
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
          <button class="btn-outline sm-btn" onclick="copyToClipboard('${myAddr}', this, '<i data-lucide=\'copy\'></i> Copy')"><i data-lucide="copy"></i> Copy</button>
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
  const rounds = status.rounds || 0;
  const needed = window._config?.PHASE3_ROUNDS || 20;
  const progress = Math.min(100, (rounds / needed) * 100).toFixed(0);

  return `
    <div class="panel">
      <div class="panel-header">
        <span class="panel-icon"><i data-lucide="graduation-cap"></i></span>
        <h2>Phase 3 — Graduated Participation</h2>
      </div>
      <div class="cs-explain">
        <p>You are now a <strong>graduated participant</strong>. You can vote on block proposals
        and earn reputation. After <strong>${needed} honest consensus rounds</strong>, you will
        be promoted to the "Under Observation" phase.</p>
      </div>

      <div class="cs-rep-section">
        <label>Round Progress (${rounds} / ${needed})</label>
        <div class="cs-rep-bar-wrap">
          <div class="cs-rep-bar" style="width: ${progress}%"></div>
        </div>
      </div>

      <div class="cs-tip">
        <i data-lucide="lightbulb" style="color:var(--accent-y)"></i>
        Stay online and connected to peers — your node votes automatically when
        blocks are proposed. Each honest vote increases your round count.
      </div>

      ${rounds >= needed
      ? `<div class="cs-result success"><i data-lucide="check-circle"></i> Phase 3 complete! Awaiting transition to Observation.</div>`
      : ''}
    </div>
    ${_renderNodeListPanel()}
  `;
}


// ── FULL_NODE: Admin Panel ─────────────────────────────────────────────────────

function _renderFullNode(status, myAddr) {
  return `
    <!-- Status Alert Strip -->
    <div class="cs-result success" style="margin-bottom: 20px; border-radius: 8px; padding: 12px 20px; display: flex; align-items: center; gap: 12px;">
      <i data-lucide="hexagon" style="width:20px; height:20px; color: var(--accent-v)"></i>
      <div style="font-size:12px;">
        <strong style="color:var(--accent-v)">FULL NODE PRIVILEGES ACTIVE.</strong> 
        You can now authorize new candidates via collateralized vouching and enforce network security protocol.
      </div>
    </div>

    <!-- Grid Control Deck -->
    <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px; align-items: flex-start;">
      
      <!-- Main Action: Vouching Engine -->
      <div class="panel" style="margin-bottom:0;">
        <div class="panel-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 16px;">
          <span class="panel-icon"><i data-lucide="user-plus"></i></span>
          <h2 style="font-size: 15px">Vouch Candidate</h2>
          <div class="info-tip-container" style="position: relative; display: inline-block; margin-left: 8px; cursor: help;">
             <i data-lucide="info" style="width: 12px; opacity: 0.4;"></i>
             <div class="info-tip-popup" style="visibility: hidden; opacity: 0; position: absolute; z-index: 99; width: 200px; background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 6px; padding: 10px; left: 0; bottom: 20px; font-size: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); transition: 0.2s;">
               Stakes native reputation to sponsor new node onboarding. Collateral increases linearly with network risk.
             </div>
          </div>
          <style>.info-tip-container:hover .info-tip-popup { visibility: visible !important; opacity: 1 !important; }</style>
        </div>

        <div class="send-form">
          <input type="text" id="cs-vouch-target" class="input-field" style="font-family: monospace; font-size: 11px; padding: 12px;"
                 placeholder="Paste Phase 2 Node ID here…" oninput="window.updateStakePreview(this.value, ${status.reputation || 0.1})" />
          
          <div id="cs-dynamic-stake-wrap" style="margin-top: 12px">
             <div class="cs-stake-preview-card" style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1);">
                <div class="empty-state sm" style="font-size: 11px; color: var(--text-3)">Awaiting validation sequence...</div>
             </div>
          </div>

          <button class="btn-primary btn-glow" id="cs-vouch-btn" style="width:100%; margin-top: 12px; padding: 14px;">
             <i data-lucide="shield-check"></i> Authorize & Stake
          </button>
          <div class="form-msg" id="cs-vouch-msg"></div>
        </div>
      </div>

      <!-- Secondary Action: Governance -->
      <div class="panel" style="margin-bottom:0;">
        <div class="panel-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 16px;">
          <span class="panel-icon" style="color: var(--accent-r)"><i data-lucide="shield-alert"></i></span>
          <h2 style="font-size: 15px">Governance Slash</h2>
        </div>
        <div class="send-form">
          <div style="font-size: 10px; color: var(--accent-r); opacity: 0.8; margin-bottom: 8px; text-transform: uppercase; font-weight: 800;">⚠️ IRREVOCABLE ACTION</div>
          <input type="text" id="cs-penalize-target" class="input-field" style="font-family: monospace; font-size: 11px; padding: 10px; border-color: rgba(239, 68, 68, 0.2)"
                 placeholder="Target Node ID…" />
          <button class="btn-outline" id="cs-penalize-btn" style="width:100%; border-color: var(--accent-r); color: var(--accent-r); margin-top: 10px; background: rgba(239, 68, 68, 0.05); font-size: 11px;">
            <i data-lucide="ban"></i> Enforce Ban
          </button>
          <div class="form-msg" id="cs-penalize-msg"></div>
        </div>
      </div>

      <!-- Ledger Registry Row (Spans full grid) -->
      <div style="grid-column: 1 / -1; margin-top: 10px;">
         <div class="panel" style="margin-bottom: 0">
           ${_renderNodeListPanel()}
         </div>
      </div>
    </div>
  `;
}

function _renderNodeListPanel() {
  return `
    <div id="cs-sim-anchor"></div>
  `;
}

function _renderBanned() {
  return `
    <div class="panel">
      <div class="cs-result fail" style="margin:0">
        <i data-lucide="ban"></i> This node has been <strong>banned</strong> from the network for malicious behaviour.
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

  // Show node list for all voting phases
  if (['PHASE_3', 'UNDER_OBSERVATION', 'FULL_NODE'].includes(phase)) {
    document.getElementById('cs-refresh-nodes-btn')?.addEventListener('click', () => _loadNodeList());
    _loadNodeList();
  }

  if (phase === 'FULL_NODE') {
    document.getElementById('cs-vouch-btn')?.addEventListener('click', () => _handleVouch());
    document.getElementById('cs-penalize-btn')?.addEventListener('click', () => _handlePenalize());
  }
}


// ── Phase 1: Task Loading & Submission ────────────────────────────────────────

async function _loadAndRenderTasks(myAddr) {
  const area = document.getElementById('cs-tasks-area');
  area.innerHTML = `<div class="empty-state"><div class="spinner"></div> Loading tasks...</div>`;

  try {
    const data = await api.getTasks(myAddr);
    const tasks = data.tasks || [];

    if (!tasks.length) {
      area.innerHTML = `<div class="empty-state">No tasks assigned.</div>`;
      return;
    }

    area.innerHTML = `
      <div class="cs-task-grid">
        ${tasks.map(t => `
          <div class="cs-task-card" id="task-row-${t.task_id}">
            <div class="cs-task-card-header">
              <span class="task-icon-circle">${_taskIcon(t.type)}</span>
              <div class="task-info">
                <span class="task-label">${t.type.replace('_', ' ')}</span>
                <code class="task-subtext">${t.task_id.slice(0, 8)}</code>
              </div>
              <div class="task-status-badge" id="status-badge-${t.task_id}"><i data-lucide="clock"></i> Pending</div>
            </div>
            
            <div class="cs-task-card-body">
              ${t.type === 'SIGN_CHALLENGE'
        ? `<div class="task-success-note">Will be signed by your Node ID</div>`
        : `<input type="text" class="task-input-compact" data-task="${t.task_id}" 
                          placeholder="Waiting..." readonly />`
      }
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="cs-submit-wrap">
        <button class="btn-primary btn-glow" id="cs-submit-tasks-btn" disabled>
          <i data-lucide="check-square"></i> Finalize & Submit Results
        </button>
        <div class="form-msg" id="cs-task-msg"></div>
      </div>
    `;

    console.log("[ColdStart] Starting parallel task computations for", tasks.length, "tasks");

    if (!window.crypto?.subtle) {
      console.error("[ColdStart] CRITICAL: crypto.subtle is not available. This usually happens on non-HTTPS connections.");
      area.innerHTML = `<div class="cs-result fail">❌ Security Error: Cryptographic functions are disabled by your browser on this connection. Please use <b>http://127.0.0.1:5000</b> or HTTPS.</div>`;
      return;
    }

    const taskPromises = tasks.map(async (t) => {
      const input = document.querySelector(`[data-task="${t.task_id}"]`);
      if (!input) return;

      try {
        const badge = document.getElementById(`status-badge-${t.task_id}`);

        if (t.type === 'HASH_PREIMAGE' || t.type === 'VERIFY_HASH') {
          if (badge) badge.innerHTML = '<i data-lucide="search"></i> Verifying...';
          if (window.lucide) lucide.createIcons();
          input.value = await _sha256(t.challenge);
          if (badge) { badge.innerHTML = '<i data-lucide="check"></i> Validated'; badge.className = "task-status-badge success"; }
        } else if (t.type === 'POW') {
          const difficulty = t.difficulty || 3;
          if (badge) badge.innerHTML = '<i data-lucide="hammer"></i> Mining...';
          if (window.lucide) lucide.createIcons();
          input.value = await _minePoW(t.challenge, difficulty, (attempts) => {
            if (attempts % 1000 === 0) {
              if (badge) badge.innerHTML = `<i data-lucide="hammer"></i> Mining (${attempts})`;
            }
          });
          if (badge) { badge.innerHTML = '<i data-lucide="gem"></i> Mined'; badge.className = "task-status-badge success"; }
          input.classList.add('success-text');
        } else if (t.type === 'SIGN_CHALLENGE') {
          const badge = document.getElementById(`status-badge-${t.task_id}`);
          if (badge) { badge.innerHTML = '<i data-lucide="pen-tool"></i> Ready'; badge.className = "task-status-badge success"; }
        }
      } catch (err) {
        console.error(`[ColdStart] Error processing task ${t.task_id}:`, err);
        input.value = "ERROR";
      }
    });

    await Promise.all(taskPromises);

    // Enable submit button
    const submitBtn = document.getElementById('cs-submit-tasks-btn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="send"></i> Send Verification Proofs';
    }
    if (window.lucide) lucide.createIcons();

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
      msg.innerHTML = `<i data-lucide="check"></i> Passed! Score: ${pct}%. Advancing to Phase 2…`;
      if (window.lucide) lucide.createIcons();
      setTimeout(() => renderColdStart(_state), 2000);
    } else {
      msg.className = 'form-msg error';
      msg.innerHTML = `<i data-lucide="x"></i> Score: ${pct}% — need ${Math.round((window._config?.PHASE1_PASS_THRESHOLD || 0.8) * 100)}%+. Try again.`;
      if (window.lucide) lucide.createIcons();
    }
  } catch {
    msg.className = 'form-msg error';
    msg.innerHTML = '<i data-lucide="alert-triangle"></i> Submission failed. Is the node running?';
    if (window.lucide) lucide.createIcons();
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check"></i> Submit All Answers';
    if (window.lucide) lucide.createIcons();
  }
}


async function _refreshRoundProgress(status, phase) {
  const rounds = status.rounds || 0;

  if (phase === 'PHASE_3') {
    const needed = window._config?.PHASE3_ROUNDS || 20;
    const progress = Math.min(100, (rounds / needed) * 100).toFixed(0);
    const bar = document.querySelector('.cs-rep-bar');
    if (bar) bar.style.width = progress + '%';
    const label = document.querySelector('.cs-rep-section label');
    if (label) label.textContent = `Round Progress (${rounds} / ${needed})`;
  } else if (phase === 'UNDER_OBSERVATION') {
    const total_needed = window._config?.PHASE3_HONEST_ROUNDS || 45;
    const remaining = Math.max(0, total_needed - rounds);
    const progress = Math.min(100, (rounds / total_needed) * 100).toFixed(0);
    const bar = document.querySelector('.cs-rep-bar');
    if (bar) bar.style.width = progress + '%';
    const label = document.querySelector('.cs-rep-section label');
    if (label) label.textContent = `Total Graduation Progress (${rounds} / ${total_needed} rounds)`;
    const explain = document.querySelector('.cs-explain strong:last-child');
    if (explain) explain.textContent = `${remaining} rounds`;
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
  } catch { }
}


// ── FULL_NODE: Vouch Handler ──────────────────────────────────────────────────

async function _handleVouch() {
  const target = document.getElementById('cs-vouch-target').value.trim();
  const msg = document.getElementById('cs-vouch-msg');
  const btn = document.getElementById('cs-vouch-btn');
  if (!target) { msg.className = 'form-msg error'; msg.innerHTML = '<i data-lucide="alert-circle"></i> Enter a target Node ID.'; if (window.lucide) lucide.createIcons(); return; }

  btn.disabled = true; btn.textContent = 'Vouching…';
  try {
    const r = await api.submitVouch(target);
    console.log("[Vouch Response]", r);

    // Check for both application-level and framework-level errors
    if (r.error || r.detail) {
      msg.className = 'form-msg error';
      msg.innerHTML = `<i data-lucide="x"></i> ${r.error || r.detail}`;
      if (window.lucide) lucide.createIcons();
    } else {
      msg.className = 'form-msg success';
      msg.textContent = `✅ Vouched! Staked ${(r.stake_amount || 0).toFixed(4)} POR for ${_short(target)}.`;
      document.getElementById('cs-vouch-target').value = '';
      await _loadNodeList();
    }
  } catch {
    msg.className = 'form-msg error'; msg.innerHTML = '<i data-lucide="alert-triangle"></i> Network error.';
    if (window.lucide) lucide.createIcons();
  } finally { btn.disabled = false; btn.innerHTML = '<i data-lucide="users"></i> Vouch & Stake'; if (window.lucide) lucide.createIcons(); }
}


// ── FULL_NODE: Penalize Handler ───────────────────────────────────────────────

async function _handlePenalize() {
  const target = document.getElementById('cs-penalize-target').value.trim();
  const msg = document.getElementById('cs-penalize-msg');
  const btn = document.getElementById('cs-penalize-btn');
  if (!target) { msg.className = 'form-msg error'; msg.innerHTML = '<i data-lucide="alert-circle"></i> Enter a Node ID.'; if (window.lucide) lucide.createIcons(); return; }

  if (!confirm(`Are you sure you want to BAN and SLASH node:\n${target}\n\nThis cannot be undone.`)) return;

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
      msg.innerHTML = `<i data-lucide="ban"></i> Node ${_short(target)} has been banned and slashed.`;
      if (window.lucide) lucide.createIcons();
      document.getElementById('cs-penalize-target').value = '';
      await _loadNodeList();
    } else {
      msg.className = 'form-msg error';
      msg.innerHTML = `<i data-lucide="x"></i> ${data.detail || 'Failed'}`;
      if (window.lucide) lucide.createIcons();
    }
  } catch {
    msg.className = 'form-msg error'; msg.innerHTML = '<i data-lucide="alert-triangle"></i> Network error.';
    if (window.lucide) lucide.createIcons();
  } finally { btn.disabled = false; btn.innerHTML = '<i data-lucide="ban"></i> Slash & Ban Node'; if (window.lucide) lucide.createIcons(); }
}


// ── FULL_NODE: Node List ──────────────────────────────────────────────────────

async function _loadNodeList() {
  const el = document.getElementById('cs-node-list');
  if (!el) return;

  try {
    const r = await fetch(`${BASE_URL}/node/registry`);
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
          <span class="phase-badge ${cls}">${_phaseLabel(n.phase)}${isBanned ? ' <i data-lucide="skull" style="width:12px;height:12px"></i>' : ''}</span>
          <span class="cs-node-rounds">Rounds: ${n.honest_rounds || 0}</span>
        </div>
      `;
    }).join('');
    if (window.lucide) lucide.createIcons();
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

async function _minePoW(challenge, difficulty, onProgress) {
  let nonce = 0;
  const target = '0'.repeat(difficulty);

  return new Promise((resolve, reject) => {
    async function loop() {
      try {
        // Process in batches of 500 to keep the UI responsive
        for (let i = 0; i < 500; i++) {
          nonce++;
          const hash = await _sha256(challenge + nonce);
          if (hash.startsWith(target)) {
            resolve(nonce);
            return;
          }
        }
        if (onProgress) onProgress(nonce);
        setTimeout(loop, 0);
      } catch (e) {
        reject(e);
      }
    }
    loop();
  });
}

function _taskIcon(type) {
  if (type === 'HASH_PREIMAGE') return '<i data-lucide="lock"></i>';
  if (type === 'SIGN_CHALLENGE') return '<i data-lucide="pen-tool"></i>';
  if (type === 'VERIFY_HASH') return '<i data-lucide="search"></i>';
  if (type === 'POW') return '<i data-lucide="hammer"></i>';
  return '<i data-lucide="file-text"></i>';
}

function _phaseLabel(phase) {
  const map = {
    PHASE_1: 'Candidate Node', PHASE_2: 'Phase 1 Complete', PHASE_3: 'Probationary Validator',
    UNDER_OBSERVATION: 'Observation', FULL_NODE: 'Full Validator', BANNED: 'Banned', UNKNOWN: 'Unknown'
  };
  return map[phase] || phase || '—';
}

function _phaseClass(phase) {
  const map = {
    PHASE_1: 'phase-1', PHASE_2: 'phase-2', PHASE_3: 'phase-3',
    UNDER_OBSERVATION: 'phase-obs', FULL_NODE: 'phase-full', BANNED: 'phase-ban'
  };
  return map[phase] || '';
}

// ── Dynamic Staking Helpers ──────────────────────────────────────────────────

window.updateStakePreview = async function (targetId, myRep) {
  const wrap = document.getElementById('cs-dynamic-stake-wrap');
  if (!wrap || !targetId || targetId.length < 10) return;

  try {
    const nodes = await api.getRegistry();
    const target = nodes[targetId];

    if (!target) {
      wrap.innerHTML = `<div class="cs-stake-preview-card"><div class="empty-state sm">Target Node Not Found</div></div>`;
      return;
    }

    const nonce = target.pow_nonce || 0;
    const baseDelta = 0.15;
    const workDiscount = (nonce / 1000000.0);
    const dynamicDelta = Math.max(0.01, Math.min(baseDelta, baseDelta - workDiscount));
    const finalStake = (myRep * dynamicDelta * 100.0).toFixed(4);

    wrap.innerHTML = `
      <div class="cs-stake-preview-card">
        <div class="csp-row">
          <span>Target Work Proof (Nonce)</span>
          <strong>#${nonce.toLocaleString()}</strong>
        </div>
        <div class="csp-row">
          <span>Base Multiplier</span>
          <span>15.0%</span>
        </div>
        <div class="csp-row">
          <span>Work Leverage</span>
          <span class="success-text">-${(workDiscount * 100).toFixed(1)}%</span>
        </div>
        <div class="csp-divider"></div>
        <div class="csp-row total">
          <span>Your Effective Stake</span>
          <strong>${finalStake} POR</strong>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Stake Preview Error:", err);
  }
};

/** coldstart.js — Phase-aware ColdStart onboarding UI */

async function renderColdStart(state) {
  const el = document.getElementById('coldstart-content');
  const phase = state.phase;

  if (phase === 'FULL_NODE') {
    el.innerHTML = `
      <div class="phase-banner full">
        <h2>🎉 Full Node</h2>
        <p>You have completed all ColdStart phases. You are a full participant in the POR-Chain network.
           You can propose blocks, vote, and vouch for new nodes.</p>
      </div>`;
    return;
  }

  if (phase === 'BANNED') {
    el.innerHTML = `
      <div class="phase-banner ban">
        <h2>🚫 Node Banned</h2>
        <p>This node was detected as malicious. The voucher's stake has been slashed.
           Contact the network administrator if you believe this is an error.</p>
      </div>`;
    return;
  }

  if (phase === 'PHASE_1' || phase === 'UNKNOWN') {
    await renderPhase1(el, state);
  } else if (phase === 'PHASE_2') {
    await renderPhase2(el, state);
  } else if (phase === 'PHASE_3') {
    await renderPhase3(el, state);
  }
}

// ── Phase 1 ──────────────────────────────────────────────────────────────────

async function renderPhase1(el, state) {
  el.innerHTML = `
    <div class="phase-banner p1">
      <h2>⚗️ Phase 1 — Probation</h2>
      <p>Complete the assigned verification tasks. Score ≥ 80% to advance to Phase 2 (Vouching).</p>
    </div>
    <div class="panel" id="tasks-panel">
      <div class="panel-header"><span class="panel-icon">📋</span><h2>Assigned Tasks</h2></div>
      <div id="task-list-inner"><div class="empty-state">Loading tasks...</div></div>
      <div class="progress-bar-wrap"><div class="progress-bar-fill" id="task-progress" style="width:0%"></div></div>
      <div style="margin-top:12px;">
        <button class="btn-primary" id="submit-tasks-btn">Submit Answers</button>
        <div class="form-msg" id="tasks-msg"></div>
      </div>
    </div>`;

  const data = await api.getTasks(state.node_id);
  const tasks = data.tasks || [];
  const taskInner = document.getElementById('task-list-inner');

  if (!tasks.length) {
    taskInner.innerHTML = '<div class="empty-state">No tasks assigned yet — refresh the page.</div>';
    return;
  }

  taskInner.innerHTML = tasks.map(t => `
    <div class="task-item" id="task-item-${t.task_id}">
      <div class="task-type">${t.type}</div>
      <div class="task-challenge">${t.challenge}</div>
      <div class="task-answer-row">
        <input type="text" class="input-field task-answer"
               id="ans-${t.task_id}"
               data-task-id="${t.task_id}"
               data-type="${t.type}"
               placeholder="${t.type === 'SIGN_CHALLENGE' ? 'Enter your signature (base64)' : 'Enter SHA-256 hash answer'}" />
      </div>
    </div>
  `).join('');

  document.getElementById('submit-tasks-btn').onclick = async () => {
    const submissions = tasks.map(t => {
      const ansEl = document.getElementById(`ans-${t.task_id}`);
      return {
        task_id: t.task_id,
        answer: ansEl?.value?.trim(),
      };
    });

    const result = await api.submitTasks(state.node_id, submissions);
    const msg = document.getElementById('tasks-msg');
    const score = ((result.score || 0) * 100).toFixed(1);
    document.getElementById('task-progress').style.width = `${score}%`;

    if (result.passed) {
      msg.textContent = `✓ Passed! Score: ${score}% — advancing to Phase 2`;
      msg.className   = 'form-msg success';
      setTimeout(() => location.reload(), 2000);
    } else {
      msg.textContent = `✗ Score: ${score}% — need ≥ 80% to advance`;
      msg.className   = 'form-msg error';
    }
  };
}

// ── Phase 2 ──────────────────────────────────────────────────────────────────

async function renderPhase2(el, state) {
  const vouchers = await api.getEligibleVouchers();
  const voucherList = (vouchers.eligible_vouchers || []);

  el.innerHTML = `
    <div class="phase-banner p2">
      <h2>🤝 Phase 2 — Vouching</h2>
      <p>You need a high-reputation node to vouch for you. The voucher will stake tokens that are locked
         until you become a Full Node (or slashed if malicious).</p>
    </div>
    <div class="panel">
      <div class="panel-header"><span class="panel-icon">✓</span><h2>Request a Vouch</h2></div>
      <div class="vouch-form">
        <div style="font-size:13px;color:var(--text-2);margin-bottom:8px;">
          Share your Node ID with a trusted Full Node and ask them to vouch for you via their dashboard.
        </div>
        <div class="identity-row">
          <span class="id-label">Your ID</span>
          <code class="id-value">${state.node_id}</code>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-header"><span class="panel-icon">◉</span><h2>Eligible Vouchers</h2></div>
      ${voucherList.length
        ? voucherList.map(v => `
          <div class="peer-item">
            <span class="peer-url">${v.node_id.slice(0, 20)}...</span>
            <span class="peer-status online">Eligible to Vouch</span>
          </div>`).join('')
        : '<div class="empty-state">No eligible vouchers found on this node</div>'
      }
    </div>
    <div class="panel">
      <div class="panel-header"><span class="panel-icon">🔗</span><h2>Vouch for Another Node (if you are eligible)</h2></div>
      <div class="vouch-form">
        <input type="text" id="vouch-target-id" class="input-field" placeholder="Target Node ID to vouch for" />
        <button class="btn-primary" id="vouch-btn">Submit Vouch</button>
        <div class="form-msg" id="vouch-msg"></div>
      </div>
    </div>`;

  document.getElementById('vouch-btn').onclick = async () => {
    const targetId = document.getElementById('vouch-target-id').value.trim();
    const msg = document.getElementById('vouch-msg');
    if (!targetId) { msg.textContent = 'Enter a target node ID'; msg.className = 'form-msg error'; return; }
    const result = await api.submitVouch(targetId);
    if (result.error) {
      msg.textContent = result.error;
      msg.className = 'form-msg error';
    } else {
      msg.textContent = `✓ Vouched for ${targetId.slice(0, 16)}... — stake locked: ${(result.stake_amount || 0).toFixed(2)} POR`;
      msg.className = 'form-msg success';
    }
  };
}

// ── Phase 3 ──────────────────────────────────────────────────────────────────

async function renderPhase3(el, state) {
  const vouchStatus = await api.getVouchStatus(state.node_id);

  el.innerHTML = `
    <div class="phase-banner p3">
      <h2>🌱 Phase 3 — Graduated Participation</h2>
      <p>You can now vote on block proposals. After ${10} honest rounds you will become a Full Node.
         Your voucher's stake will be released upon graduation.</p>
    </div>
    <div class="panel">
      <div class="panel-header"><span class="panel-icon">📊</span><h2>Vouching Status</h2></div>
      ${vouchStatus && vouchStatus.voucher_id ? `
        <div class="identity-row">
          <span class="id-label">Voucher</span>
          <code class="id-value">${vouchStatus.voucher_id}</code>
        </div>
        <div class="identity-row">
          <span class="id-label">Stake</span>
          <code class="id-value">${(vouchStatus.stake_amount || 0).toFixed(4)} POR — ${vouchStatus.status}</code>
        </div>
        <div class="identity-row">
          <span class="id-label">Rep Given</span>
          <code class="id-value">${(vouchStatus.rep_granted || 0).toFixed(4)}</code>
        </div>
      ` : '<div class="empty-state">No vouch record</div>'}
    </div>
    <div class="panel">
      <div class="panel-header"><span class="panel-icon">ℹ</span><h2>Your Permissions</h2></div>
      <div class="eligibility-grid">
        <div class="elig-item"><div class="elig-dot ${state.eligible_to_vote ? 'yes' : 'no'}"></div><span>Can Vote</span></div>
        <div class="elig-item"><div class="elig-dot no"></div><span>Can Propose (locked)</span></div>
        <div class="elig-item"><div class="elig-dot ${state.eligible_to_vouch ? 'yes' : 'no'}"></div><span>Can Vouch</span></div>
      </div>
    </div>`;
}

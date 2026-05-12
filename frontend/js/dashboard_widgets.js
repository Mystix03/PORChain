/**
 * dashboard_widgets.js
 * Powers the Chain Growth sparkline and Live Consensus Round panel.
 * Polls the backend on a 3s interval and updates all widgets.
 */

// ── State ──────────────────────────────────────────────────────────────────────
const _spark = { timestamps: [], heights: [] };
const _consensus = { log: [], lastBlock: null };

// ── Rep Gauge ─────────────────────────────────────────────────────────────────
function updateRepGauge(score) {
  const pct = Math.min(1, Math.max(0, score || 0));
  const circumference = 2 * Math.PI * 12; // r=12
  const offset = circumference * (1 - pct);

  const arc = document.getElementById('rep-gauge-arc');
  const label = document.getElementById('rep-gauge-pct');
  const scoreEl = document.getElementById('rep-score');
  if (!arc) return;

  arc.style.strokeDashoffset = offset.toFixed(2);

  // Colour: red < 0.4, amber 0.4–0.7, green >= 0.7
  if (pct >= 0.7) {
    arc.style.stroke = '#22c55e';
  } else if (pct >= 0.4) {
    arc.style.stroke = '#f59e0b';
  } else {
    arc.style.stroke = '#f43f5e';
  }

  if (label) label.textContent = Math.round(pct * 100) + '%';
  if (scoreEl) scoreEl.textContent = (score || 0).toFixed(3);
}

// ── Block Time ────────────────────────────────────────────────────────────────
function updateBlockTime(chain) {
  const blocks = chain?.blocks || chain?.chain || [];
  const el = document.getElementById('stat-blocktime-val');
  const sub = document.getElementById('stat-blocktime-sub');
  if (!el || blocks.length < 2) return;

  // Compute avg delta across last 10 blocks
  const recent = blocks.slice(-10);
  let totalDelta = 0;
  let count = 0;
  for (let i = 1; i < recent.length; i++) {
    const delta = (recent[i].timestamp || 0) - (recent[i - 1].timestamp || 0);
    if (delta > 0 && delta < 3600) { totalDelta += delta; count++; }
  }

  el.classList.remove('skeleton');
  if (count > 0) {
    const avg = (totalDelta / count).toFixed(1);
    el.textContent = avg;
    if (sub) sub.textContent = `seconds per block · ${blocks.length} total`;
  } else {
    el.textContent = '—';
  }
}

// ── Chain Sparkline ───────────────────────────────────────────────────────────
function drawSparkline(chain) {
  const canvas = document.getElementById('chain-sparkline');
  if (!canvas) return;

  const blocks = chain?.blocks || chain?.chain || [];
  if (blocks.length < 2) return;

  // Build time-series of (timestamp, height) for last 20 blocks
  const pts = blocks.slice(-20).map((b, i) => ({
    t: b.timestamp || i,
    h: b.index ?? i,
  }));

  // Update labels
  const fmt = (ts) => ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const oldest = document.getElementById('sparkline-oldest');
  const newest = document.getElementById('sparkline-newest');
  if (oldest) oldest.textContent = `Block ${pts[0].h}  ${fmt(pts[0].t)}`;
  if (newest) newest.textContent = `Block ${pts[pts.length - 1].h}  ${fmt(pts[pts.length - 1].t)}`;

  // Draw
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = 60;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const minH = pts[0].h;
  const maxH = pts[pts.length - 1].h;
  const range = Math.max(1, maxH - minH);
  const padX = 8, padY = 8;

  const xOf = (i) => padX + (i / (pts.length - 1)) * (w - padX * 2);
  const yOf = (h) => padY + (1 - (h - minH) / range) * (60 - padY * 2);

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, 60);
  grad.addColorStop(0, 'rgba(212, 248, 50, .35)');
  grad.addColorStop(1, 'rgba(255, 255, 255, .02)');

  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(pts[0].h));
  for (let i = 1; i < pts.length; i++) {
    const cpx = (xOf(i - 1) + xOf(i)) / 2;
    ctx.bezierCurveTo(cpx, yOf(pts[i-1].h), cpx, yOf(pts[i].h), xOf(i), yOf(pts[i].h));
  }
  ctx.lineTo(xOf(pts.length - 1), 60);
  ctx.lineTo(xOf(0), 60);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(pts[0].h));
  for (let i = 1; i < pts.length; i++) {
    const cpx = (xOf(i - 1) + xOf(i)) / 2;
    ctx.bezierCurveTo(cpx, yOf(pts[i-1].h), cpx, yOf(pts[i].h), xOf(i), yOf(pts[i].h));
  }
  ctx.strokeStyle = '#D4F832';
  ctx.lineWidth = 2;
  ctx.stroke();

  // End dot
  ctx.beginPath();
  ctx.arc(xOf(pts.length - 1), yOf(pts[pts.length - 1].h), 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

// ── Network Topology ──────────────────────────────────────────────────────────
let _topoNodes = []; // Store node positions for animation/hover
function drawTopology(state) {
  const canvas = document.getElementById('topology-canvas');
  const countEl = document.getElementById('topology-count');
  if (!canvas) return;

  const peers = state?.peers_count || 0;
  if (countEl) countEl.textContent = `${peers} active peers`;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = 150;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const cx = w / 2;
  const cy = h / 2;
  const time = Date.now() / 1000;

  // Initialize nodes if needed
  if (_topoNodes.length !== peers + 1) {
    _topoNodes = [{ id: 'ME', x: cx, y: cy, baseR: 0, speed: 0 }];
    for (let i = 0; i < peers; i++) {
      _topoNodes.push({
        id: `P${i}`,
        angle: (i / peers) * Math.PI * 2,
        dist: 45 + Math.random() * 15,
        speed: 0.2 + Math.random() * 0.3,
        offset: Math.random() * 10
      });
    }
  }

  ctx.clearRect(0, 0, w, h);

  // Draw lines first
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(212, 248, 50, 0.2)';
  _topoNodes.slice(1).forEach(node => {
    const nx = cx + Math.cos(node.angle + time * node.speed) * node.dist;
    const ny = cy + Math.sin(node.angle + time * node.speed) * node.dist;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Draw Central Node
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 12);
  glow.addColorStop(0, '#ffffff');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  // Draw Peer Nodes
  _topoNodes.slice(1).forEach(node => {
    const nx = cx + Math.cos(node.angle + time * node.speed) * node.dist;
    const ny = cy + Math.sin(node.angle + time * node.speed) * node.dist;
    
    // Pulse effect
    const s = 1 + Math.sin(time * 3 + node.offset) * 0.2;
    
    ctx.fillStyle = 'rgba(212, 248, 50, 0.4)';
    ctx.beginPath();
    ctx.arc(nx, ny, 4 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#D4F832';
    ctx.beginPath();
    ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Request next frame for animation
  if (peers > 0) requestAnimationFrame(() => drawTopology(state));
}

// ── Consensus Panel ───────────────────────────────────────────────────────────
function updateConsensusPanel(state, chain) {
  const blocks = chain?.blocks || chain?.chain || [];
  const latestBlock = blocks[blocks.length - 1];
  const pill = document.getElementById('consensus-status-pill');
  const roundEl = document.getElementById('c-round');
  const proposerEl = document.getElementById('c-proposer');
  const votesEl = document.getElementById('c-votes');
  const outcomeEl = document.getElementById('c-outcome');
  const hashEl = document.getElementById('c-hash');
  const bar = document.getElementById('c-vote-bar');
  const pct = document.getElementById('c-vote-pct');
  const logEl = document.getElementById('consensus-log');

  if (!pill || !roundEl) return;

  const height = state?.chain_height ?? (blocks.length > 0 ? blocks.length - 1 : 0);
  const peers = state?.peers_count ?? 0;

  // If this is a new block since last time, log a round
  if (latestBlock && latestBlock.index !== _consensus.lastBlock) {
    _consensus.lastBlock = latestBlock.index;

    // Determine if the block was proposed (has proposer field) or genesis
    const proposer = latestBlock.proposer || latestBlock.validator || 'Genesis';
    const votes    = latestBlock.votes ?? peers;
    const total    = Math.max(votes, peers, 1);
    const votePct  = Math.round((votes / total) * 100);
    const accepted = !latestBlock.rejected;

    // Update meta
    if (roundEl)    roundEl.textContent    = `#${latestBlock.index}`;
    if (proposerEl) proposerEl.textContent = proposer !== 'Genesis'
      ? proposer.slice(0, 8) + '…'
      : 'Genesis';
    if (votesEl)    votesEl.textContent    = `${votes}/${total}`;
    if (outcomeEl) {
      outcomeEl.textContent = accepted ? 'Accepted' : 'Rejected';
      outcomeEl.style.color = accepted ? 'var(--accent-g)' : 'var(--accent-r)';
    }
    if (hashEl) {
      const hashVal = latestBlock.hash || `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
      hashEl.textContent = hashVal.slice(0, 14) + '…';
    }

    if (bar) bar.style.width = votePct + '%';
    if (pct) pct.textContent = votePct + '%';

    // Pill
    if (pill) {
      pill.className = 'consensus-pill ' + (accepted ? 'accepted' : 'rejected');
      pill.textContent = accepted ? 'Accepted' : 'Rejected';
      // Reset to idle after 4s
      setTimeout(() => {
        if (pill) { pill.className = 'consensus-pill idle'; pill.textContent = 'Idle'; }
      }, 4000);
    }

    // Log entry
    if (logEl) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const entry = document.createElement('div');
      entry.className = `c-log-entry ${accepted ? 'accepted' : 'rejected'}`;
      entry.innerHTML = `
        <span>Block <strong>#${latestBlock.index}</strong> ${accepted ? 'accepted' : 'rejected'} · Proposer: ${proposer !== 'Genesis' ? proposer.slice(0, 8) + '…' : 'Genesis'}</span>
        <span class="c-log-time">${timeStr}</span>
      `;
      logEl.prepend(entry);
      // Keep max 10 entries
      while (logEl.children.length > 10) logEl.removeChild(logEl.lastChild);
    }
  } else if (peers >= 1 && height > 0) {
    // Active network but no new block — show voting in progress
    if (pill && pill.className.includes('idle')) {
      pill.className = 'consensus-pill active';
      pill.textContent = 'Watching';
    }
    if (roundEl && roundEl.textContent === '—') roundEl.textContent = `#${height}`;
    if (proposerEl && proposerEl.textContent === '—') proposerEl.textContent = 'Awaiting…';
    if (votesEl && votesEl.textContent === '—') votesEl.textContent = `0/${peers}`;
    if (outcomeEl && outcomeEl.textContent === '—') {
      outcomeEl.textContent = 'Pending';
      outcomeEl.style.color = 'var(--accent-y)';
    }
    if (hashEl && hashEl.textContent === '—') {
      hashEl.textContent = 'Calculating…';
    }
  }
}

// ── Main poll / export ────────────────────────────────────────────────────────
async function refreshDashboardWidgets(state) {
  try {
    const chain = await api.getChain();
    updateBlockTime(chain);
    drawSparkline(chain);
    updateConsensusPanel(state, chain);
    drawTopology(state);
  } catch (e) {
    console.warn('dashboard_widgets: poll failed', e);
  }

  if (state) updateRepGauge(state.reputation_score || 0);
}

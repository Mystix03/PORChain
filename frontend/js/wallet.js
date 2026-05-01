/** wallet.js — Full wallet view: balance, send, receive, history */

let _walletState = null;

async function renderWallet(state) {
  _walletState = state;
  let myAddr = WalletManager.getAddress();
  if (!myAddr) myAddr = state.node_id;

  // ── Address card ──────────────────────────────────────────────────────────
  const addrEl = document.getElementById('wallet-address');
  if (addrEl) addrEl.textContent = myAddr || '—';

  // Also populate receive panel address
  const recvDisp = document.getElementById('receive-addr-display');
  if (recvDisp) recvDisp.textContent = myAddr || '—';

  // Copy address button (main card)
  const copyBtn = document.getElementById('copy-address-btn');
  if (copyBtn) {
    copyBtn.onclick = () => copyToClipboard(myAddr, copyBtn, '⎘ Copy Address');
  }

  // Copy in receive panel
  const copyRecvBtn = document.getElementById('copy-receive-btn');
  if (copyRecvBtn) {
    copyRecvBtn.onclick = () => copyToClipboard(myAddr, copyRecvBtn, '⎘ Copy');
  }

  // Refresh TX history button
  const refreshTxBtn = document.getElementById('refresh-tx-btn');
  if (refreshTxBtn) {
    refreshTxBtn.onclick = async () => {
      refreshTxBtn.textContent = '↺ Loading…';
      await renderTxHistory();
      await refreshWalletBalance();
      refreshTxBtn.textContent = '↺ Refresh';
    };
  }

  // ── Balance ───────────────────────────────────────────────────────────────
  await refreshWalletBalance();

  // ── Send form ─────────────────────────────────────────────────────────────
  document.getElementById('send-btn').onclick = handleSend;

  // Paste from clipboard into "To" field
  const pasteBtn = document.getElementById('paste-btn');
  if (pasteBtn) {
    pasteBtn.onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        document.getElementById('send-to').value = text.trim();
      } catch { /* clipboard denied */ }
    };
  }

  // Quick-amount buttons
  document.querySelectorAll('.quick-amount').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('send-amount').value = btn.dataset.amount;
    };
  });

  // ── Transaction history ───────────────────────────────────────────────────
  await renderTxHistory();
}

async function refreshWalletBalance() {
  try {
    const bal = await api.getWalletBalance();
    const balance = bal.balance || 0;
    const staked  = bal.staked  || 0;
    const total   = balance + staked;

    document.getElementById('w-balance').textContent = `${balance.toFixed(4)} POR`;
    document.getElementById('w-staked').textContent  = `${staked.toFixed(4)} POR`;
    document.getElementById('w-total').textContent   = `${total.toFixed(4)} POR`;

    // Progress bar: staked / total
    const pct = total > 0 ? (staked / total * 100).toFixed(1) : 0;
    const bar = document.getElementById('stake-bar');
    if (bar) bar.style.width = `${pct}%`;
    const barLabel = document.getElementById('stake-bar-label');
    if (barLabel) barLabel.textContent = staked > 0 ? `${pct}% staked` : '';
  } catch { /* silent */ }
}

let _lastTxCount = -1;

async function renderTxHistory() {
  const listEl = document.getElementById('tx-list');
  const myAddr = WalletManager.getAddress();
  
  try {
    const data = await api.getWalletHistory();
    const txs  = data.transactions || [];

    if (txs.length === _lastTxCount) return;
    _lastTxCount = txs.length;

    if (!txs.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size:28px;margin-bottom:10px">📭</div>
          No transactions yet.<br>
          <span style="font-size:11px;color:var(--text-3)">Start a second node and send POR tokens to see them here.</span>
        </div>`;
      return;
    }

    listEl.innerHTML = [...txs].map((tx, i) => {
      const ts  = tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : '—';
      const isReceiver = (tx.to === myAddr);
      const isSender = (tx.from === myAddr);
      
      let typeLabel = tx.type;
      if (isReceiver && tx.type === 'SEND') typeLabel = 'RECEIVE';
      
      const dir = typeLabel === 'RECEIVE' ? '↓' : typeLabel === 'SEND' ? '↑' : '⇄';
      const amtClass = typeLabel === 'RECEIVE' ? 'pos' : tx.type === 'SLASH' ? 'neg' : '';
      const isPending = tx.block_index === 'Pending';

      return `
        <div class="tx-row" id="tx-${i}" style="${isPending ? 'opacity: 0.7; border-left: 3px solid #f59e0b;' : ''}">
          <div class="tx-dir-icon ${tx.type}">${dir}</div>
          <div class="tx-info">
            <div class="tx-type-label ${tx.type}">${tx.type} ${isPending ? '<span style="color:#f59e0b; font-size: 0.8em; margin-left: 6px;">(Pending)</span>' : ''}</div>
            <div class="tx-addresses">
              <span class="tx-addr" title="${tx.from}">${shortId(tx.from)}</span>
              <span class="tx-arrow">→</span>
              <span class="tx-addr" title="${tx.to}">${shortId(tx.to)}</span>
            </div>
            ${tx.note ? `<div class="tx-note">${tx.note}</div>` : ''}
          </div>
          <div class="tx-right">
            <div class="tx-amount ${amtClass}">${tx.type === 'RECEIVE' ? '+' : tx.type === 'SEND' || tx.type === 'SLASH' ? '-' : ''}${(tx.amount || 0).toFixed(4)} POR</div>
            <div class="tx-time">${ts}</div>
            <div class="tx-hash" title="${tx.tx_id || ''}">${isPending ? '⏳ Mempool' : 'Block #' + tx.block_index}</div>
          </div>
        </div>`;
    }).join('');
  } catch {
    listEl.innerHTML = '<div class="empty-state">Could not load history</div>';
  }
}

async function handleSend() {
  const to     = document.getElementById('send-to').value.trim();
  const amount = parseFloat(document.getElementById('send-amount').value);
  const msg    = document.getElementById('send-msg');
  const btn    = document.getElementById('send-btn');

  msg.textContent = '';
  msg.className   = 'form-msg';

  if (!to) {
    showSendMsg('error', '⚠ Please enter a recipient Node ID.');
    return;
  }
  if (!amount || amount <= 0) {
    showSendMsg('error', '⚠ Enter a valid amount greater than 0.');
    return;
  }
  if (_walletState && to === _walletState.node_id) {
    showSendMsg('error', '⚠ Cannot send tokens to yourself.');
    return;
  }

  btn.textContent = 'Sending…';
  btn.disabled    = true;

  try {
    const result = await api.sendTokens(to, amount);
    if (result.success) {
      showSendMsg('success', `✓ Sent ${amount} POR to ${to.slice(0, 12)}… TX ID: ${(result.tx?.tx_id || '').slice(0, 12)}…`);
      document.getElementById('send-to').value     = '';
      document.getElementById('send-amount').value = '';
      await renderTxHistory();
      await refreshWalletBalance();
      refreshTopbarBalance();
    } else {
      showSendMsg('error', `✗ ${result.detail || 'Transaction failed.'}`);
    }
  } catch {
    showSendMsg('error', '✗ Network error — is the node running?');
  } finally {
    btn.textContent = '↑ Send POR';
    btn.disabled    = false;
  }
}

function showSendMsg(type, text) {
  const el = document.getElementById('send-msg');
  el.textContent = text;
  el.className   = `form-msg ${type}`;
}

function shortId(id) {
  if (!id || id === 'BURN' || id === 'NETWORK') return id || '—';
  return id.slice(0, 8) + '…' + id.slice(-6);
}

function copyToClipboard(text, btnEl, originalText) {
  navigator.clipboard.writeText(text).then(() => {
    btnEl.textContent = '✓ Copied!';
    btnEl.classList.add('copied');
    setTimeout(() => {
      btnEl.textContent = originalText;
      btnEl.classList.remove('copied');
    }, 2000);
  });
}


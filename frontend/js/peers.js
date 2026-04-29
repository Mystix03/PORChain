let _lastPeerCount = -1;

async function renderPeers() {
  const listEl = document.getElementById('peer-list');
  try {
    const data  = await api.getPeers();
    const peers = data.peers || [];

    if (peers.length === _lastPeerCount) return;
    _lastPeerCount = peers.length;
    if (!peers.length) {
      listEl.innerHTML = '<div class="empty-state">No peers — add one below</div>';
      return;
    }
    listEl.innerHTML = peers.map(p => `
      <div class="peer-item">
        <span class="peer-url">${p.url}</span>
        <span class="peer-status ${p.status}">${p.status}</span>
      </div>
    `).join('');
  } catch {
    listEl.innerHTML = '<div class="empty-state">Failed to load peers</div>';
  }

  // Add peer form
  document.getElementById('add-peer-btn').onclick = async () => {
    const url = document.getElementById('peer-url-input').value.trim();
    const msg = document.getElementById('peer-msg');
    if (!url) { msg.textContent = 'Enter a peer URL'; msg.className = 'form-msg error'; return; }
    const result = await api.addPeer(url);
    if (result.added) {
      msg.textContent = `✓ Peer added: ${url}`;
      msg.className   = 'form-msg success';
      document.getElementById('peer-url-input').value = '';
      await renderPeers();
    } else {
      msg.textContent = result.error || 'Failed to add peer';
      msg.className   = 'form-msg error';
    }
  };
}

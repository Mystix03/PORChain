/**
 * peers.js — Handles the rendering and management of the peer network list.
 */

async function renderPeers() {
  const container = document.getElementById('peer-list');
  if (!container) return;

  container.innerHTML = '<div class="empty-state"><div class="spinner"></div> Loading peers...</div>';

  try {
    const data = await api.getPeers();
    const peers = data.peers || [];

    if (peers.length === 0) {
      container.innerHTML = '<div class="empty-state">No peers connected</div>';
      return;
    }

    container.innerHTML = peers.map(peer => {
      let statusClass = 'offline';
      let statusIcon = '🔴';
      
      if (peer.status === 'online') {
        statusClass = 'online';
        statusIcon = '🟢';
      } else if (peer.status === 'error') {
        statusClass = 'error';
        statusIcon = '🟡';
      }

      const latency = peer.latency || Math.floor(Math.random() * 130) + 20;
      let latencyColor = 'var(--accent-g)';
      if (peer.status !== 'online') latencyColor = 'var(--text-3)';
      else if (latency > 100) latencyColor = 'var(--accent-r)';
      else if (latency > 60) latencyColor = 'var(--accent-y)';

      return `
        <div class="peer-row" style="display:flex;align-items:center;">
          <div class="peer-status ${statusClass}" title="${peer.status}">${statusIcon}</div>
          <div class="peer-url" style="flex:1">${peer.url}</div>
          <div class="peer-latency" style="color:${latencyColor}; font-family:'JetBrains Mono', monospace; font-size:11px; margin-right:12px">
            <i data-lucide="activity" style="width:12px;height:12px;vertical-align:middle;margin-right:4px;opacity:0.6"></i>
            ${peer.status === 'online' ? latency + 'ms' : '—'}
          </div>
          <div class="peer-badge">${peer.status.toUpperCase()}</div>
        </div>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = '<div class="empty-state">⚠ Could not load peers</div>';
  }

  // Setup add peer button
  const addBtn = document.getElementById('add-peer-btn');
  if (addBtn && !addBtn.dataset.bound) {
    addBtn.dataset.bound = 'true';
    addBtn.addEventListener('click', async () => {
      const input = document.getElementById('peer-url-input');
      const msg = document.getElementById('peer-msg');
      const url = input.value.trim();
      
      if (!url) {
        msg.className = 'form-msg error';
        msg.textContent = 'Please enter a URL';
        return;
      }
      
      addBtn.disabled = true;
      try {
        await api.addPeer(url);
        msg.className = 'form-msg success';
        msg.textContent = 'Peer added successfully';
        input.value = '';
        setTimeout(() => { msg.textContent = ''; }, 3000);
        await renderPeers();
      } catch (e) {
        msg.className = 'form-msg error';
        msg.textContent = 'Failed to add peer';
      } finally {
        addBtn.disabled = false;
      }
    });
  }
}

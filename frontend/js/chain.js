/** chain.js — Block explorer rendering */

let _lastChainHeight = -1;

async function renderChain() {
  const listEl = document.getElementById('chain-list');
  
  try {
    const data = await api.getChain();
    const height = data.height || 0;
    const chain = data.chain || [];

    // FIX: Only re-render if the chain has actually grown
    if (height === _lastChainHeight) {
      return; 
    }
    _lastChainHeight = height;

    if (!chain.length) {
      listEl.innerHTML = '<div class="empty-state">No blocks yet</div>';
      return;
    }
    // Show in natural order (Genesis first) so new blocks don't push content down
    listEl.innerHTML = chain.map(b => renderBlock(b)).join('');
  } catch (e) {
    listEl.innerHTML = `<div class="empty-state">Failed to load chain</div>`;
    _lastChainHeight = -1;
  }
}

function renderBlock(b) {
  const isGenesis = b.index === 0;
  const ts = b.timestamp ? new Date(b.timestamp * 1000).toLocaleString() : 'Genesis';
  
  const eventsHtml = (b.events || []).map(e => {
    let detail = '';
    if (e.type === 'SEND') {
      detail = `<span class="ev-detail"><strong>${(e.amount || 0).toFixed(2)}</strong> from <code class="sm-id">${(e.from || '').slice(0, 8)}</code> to <code class="sm-id">${(e.to || '').slice(0, 8)}</code></span>`;
    } else if (e.type === 'GENESIS') {
      detail = `<span class="ev-detail">Initial allocation to <code class="sm-id">${(e.data?.note || '').slice(0, 10)}</code></span>`;
    } else if (e.amount) {
      detail = `<span class="ev-detail"><strong>${(e.amount || 0).toFixed(2)} POR</strong></span>`;
    }

    return `
      <div class="chain-event-row">
        <span class="chain-ev-type ${e.type}">${e.type}</span>
        ${detail}
      </div>
    `;
  }).join('');

  return `
    <div class="block-card ${isGenesis ? 'genesis' : ''}" id="block-${b.index}">
      <div class="block-header">
        <div class="block-index">#${b.index}${isGenesis ? ' Genesis' : ''}</div>
        <div class="block-time">${ts}</div>
      </div>
      
      <div class="block-body">
        <div class="block-hash-group">
          <div class="hash-label">BLOCK HASH</div>
          <code class="hash-val">${b.hash || '—'}</code>
        </div>
        
        <div class="block-proposer-row">
          <span class="prop-label">PROPOSER:</span>
          <code class="prop-val">${b.proposer || 'NETWORK'}</code>
        </div>

        <div class="block-events-container">
          <div class="events-title">TRANSACTIONS (${(b.events || []).length})</div>
          <div class="events-list">
            ${eventsHtml || '<div class="empty-ev">No transactions</div>'}
          </div>
        </div>
      </div>

      <div class="block-footer">
        <span class="prev-hash-label">PREV HASH:</span>
        <code class="prev-hash-val">${(b.previous_hash || '').slice(0, 16)}...</code>
      </div>
    </div>
  `;
}

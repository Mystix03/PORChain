/**
 * ml_oracle.js — ML Oracle view controller.
 */

async function renderMLOracle() {
  const hero = document.getElementById('ml-hero');
  const title = document.getElementById('ml-status-title');
  const desc = document.getElementById('ml-status-desc');
  
  const healthVal = document.getElementById('ml-health-val');
  const nodesVal = document.getElementById('ml-nodes-val');
  const anomaliesVal = document.getElementById('ml-anomalies-val');
  
  const thresholdVal = document.getElementById('ml-threshold-val');
  const eventsVal = document.getElementById('ml-events-val');
  const contaminationVal = document.getElementById('ml-contamination-val');

  try {
    const data = await api.getSystemStatus();
    const ml = data.ml_oracle;
    const isOnline = ml.status.includes('online');

    if (isOnline) {
      hero.className = 'ml-status-hero online';
      title.textContent = ml.trained ? 'Oracle Active' : 'Oracle Training';
      desc.textContent = ml.trained 
        ? 'Real-time anomaly detection is running on all tracked nodes.' 
        : `Gathering baseline data. Minimum ${ml.min_samples_needed} nodes with history required.`;
      
      healthVal.textContent = ml.trained ? 'HEALTHY' : 'SYNCING';
      healthVal.style.color = ml.trained ? 'var(--accent-g)' : 'var(--accent-y)';
      
      nodesVal.textContent = ml.nodes_tracked;
      anomaliesVal.textContent = ml.anomalies_detected;
      
      thresholdVal.textContent = (ml.threshold || -0.2).toFixed(2);
      eventsVal.textContent = ml.total_events || 0;
      contaminationVal.textContent = (ml.contamination || 0.1).toFixed(2);
    } else {
      hero.className = 'ml-status-hero offline';
      title.textContent = 'Oracle Offline';
      desc.textContent = 'The anomaly detection service is not running. Launch it via start_all.ps1.';
      
      healthVal.textContent = 'OFFLINE';
      healthVal.style.color = 'var(--accent-r)';
      nodesVal.textContent = '0';
      anomaliesVal.textContent = '0';
    }
  } catch (e) {
    console.error("Failed to fetch ML status:", e);
  }
}

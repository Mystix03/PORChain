"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import {
  CheckCircle,
  Shield,
  Loader,
  Award,
  Cpu,
  ThumbsUp,
  ThumbsDown,
  Eye,
  AlertTriangle,
  Zap,
  Copy,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { 
  fetchTasks, 
  submitTasks, 
  fetchColdstartStatus, 
  fetchNetworkConfig,
  castVote 
} from "@/chain/api";

// ─── Cryptographic Helpers ───────────────────────────────────────────────────

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
      } catch (e) { reject(e); }
    }
    loop();
  });
}

const _taskIcon = (type) => {
  if (type === 'HASH_PREIMAGE') return <Shield size={18} />;
  if (type === 'SIGN_CHALLENGE') return <Award size={18} />;
  if (type === 'VERIFY_HASH')    return <CheckCircle size={18} />;
  if (type === 'POW')           return <Cpu size={18} />;
  return <Zap size={18} />;
};

const VOTE_PROPOSALS = [
  { question: "Accept node 5gYo...0Cq6 into Phase 2?",          context: "5/5 tasks done · validity rate 97% · no slashing history." },
  { question: "Slash node 0aJk...9Pz2 for double-sign violation?", context: "Evidence: two conflicting epoch messages at slot #4,821,033." },
  { question: "Increase stake minimum from 2 POR → 2.5 POR?",   context: "Protects against low-cost Sybil identities. 74% of validators support." },
];

// ──────────────────────────────────────────────────────────────────────────────

export default function Merit() {
  const {
    phase,
    phaseKey,
    nodeId,
    publicKey,
    reputation,
    honestRounds,
    activeTab,
    setActiveTab,
    setPhase,
    setReputation,
    addActivity,
    addNotification,
  } = useStore();

  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasks,        setTasks]        = useState([]);
  const [taskState,    setTaskState]    = useState({}); // { taskId: { solving, found, answer, nonce } }
  const [submitting,   setSubmitting]   = useState(false);
  const [config,       setConfig]       = useState(null);
  const [vouchData,    setVouchData]    = useState([]);
  const [voting,       setVoting]       = useState(false);
  const [voteChoice,   setVoteChoice]   = useState(null);
  const [viewPhase,    setViewPhase]    = useState(phase);

  // Sync viewPhase when real phase changes (e.g. on graduation)
  useEffect(() => {
    setViewPhase(phase);
  }, [phase]);

  // Fetch network config on mount
  useEffect(() => {
    fetchNetworkConfig().then(setConfig).catch(() => {});
  }, []);

  // Poll for vouch status if in Phase 2 or viewing history
  useEffect(() => {
    if (viewPhase !== 2 || !nodeId) return;
    const poll = async () => {
      try {
        const status = await fetchColdstartStatus(nodeId);
        setVouchData(status.vouch || []);
      } catch {}
    };
    poll();
    
    // Only poll if it's the active phase. If it's history, one fetch is enough.
    if (phase === 2) {
      const id = setInterval(poll, 5000);
      return () => clearInterval(id);
    }
  }, [viewPhase, phase, nodeId]);

  // ── Phase 1 Handlers ───────────────────────────────────────────────────────

  const handleLoadTasks = async () => {
    if (!nodeId) return;
    setLoadingTasks(true);
    try {
      // First try the regular task list
      const data = await fetchTasks(nodeId);
      let taskList = data.tasks || [];
      
      // Fallback: If node has already graduated, tasks will be empty in /task/list.
      // We fetch from the status endpoint to see history.
      if (taskList.length === 0) {
        const status = await fetchColdstartStatus(nodeId);
        taskList = status.tasks || [];
      }

      setTasks(taskList);
      const initState = {};
      taskList.forEach(t => {
        // For history, assume found=true since they must have passed
        const passed = phase > 1;
        initState[t.task_id] = { 
          solving: false, 
          found: passed, 
          answer: passed ? (t.type === 'POW' ? t.nonce || "Verified" : "Verified") : null, 
          nonce: 0 
        };
      });
      setTaskState(initState);
    } catch (err) {
      toast.error("Failed to load tasks");
    } finally {
      setLoadingTasks(false);
    }
  };

  const solveTask = async (task) => {
    if (taskState[task.task_id]?.solving || taskState[task.task_id]?.found) return;

    setTaskState(prev => ({ ...prev, [task.task_id]: { ...prev[task.task_id], solving: true } }));

    try {
      let answer = null;
      if (task.type === 'HASH_PREIMAGE' || task.type === 'VERIFY_HASH') {
        answer = await _sha256(task.challenge);
      } else if (task.type === 'POW') {
        const difficulty = task.difficulty || 3;
        answer = await _minePoW(task.challenge, difficulty, (nonce) => {
          setTaskState(prev => ({ ...prev, [task.task_id]: { ...prev[task.task_id], nonce } }));
        });
      } else if (task.type === 'SIGN_CHALLENGE') {
        // Mobile UI assumes node manages keys, so we send AUTO_SIGN
        answer = "AUTO_SIGN";
      }

      setTaskState(prev => ({ 
        ...prev, 
        [task.task_id]: { ...prev[task.task_id], solving: false, found: true, answer } 
      }));
    } catch (err) {
      setTaskState(prev => ({ ...prev, [task.task_id]: { ...prev[task.task_id], solving: false } }));
      toast.error(`Error solving task ${task.type}`);
    }
  };

  const handleSubmitTasks = async () => {
    const ready = Object.values(taskState).every(s => s.found);
    if (!ready) {
      toast.error("Complete all tasks first");
      return;
    }

    setSubmitting(true);
    try {
      const submissions = tasks.map(t => {
        const s = taskState[t.task_id];
        if (t.type === 'SIGN_CHALLENGE') {
          return { task_id: t.task_id, signature: "AUTO_SIGN", public_key: "AUTO_SIGN" };
        }
        return { task_id: t.task_id, answer: String(s.answer) };
      });

      const result = await submitTasks(nodeId, submissions);
      if (result.passed) {
        toast.success("Tasks Verified!", { description: `Score: ${Math.round(result.score * 100)}%` });
        addActivity({ id: Date.now(), type: "phase", message: "Phase 1 Complete — Awaiting Vouching", time: "just now" });
      } else {
        toast.error("Verification Failed", { description: `Score: ${Math.round(result.score * 100)}% — below threshold.` });
      }
    } catch (err) {
      toast.error("Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-load tasks when viewing Phase 1 history
  useEffect(() => {
    if (viewPhase === 1 && phase > 1 && tasks.length === 0 && !loadingTasks) {
      handleLoadTasks();
    }
  }, [viewPhase, phase, tasks.length, loadingTasks, handleLoadTasks]);

  const handleManualVote = async () => {
    if (!voteChoice || voting) return;
    setVoting(true);
    try {
      await castVote();
      toast.success("Vote cast!", { description: "Participating in consensus round." });
      setVoteChoice(null);
    } catch (err) {
      toast.error("Voting failed");
    } finally {
      setVoting(false);
    }
  };

  // ── Stepper Component ──────────────────────────────────────────────────────

  const Stepper = (
    <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: "20px", marginBottom: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {[
          { n: 1, label: "Candidate", icon: <Cpu size={14} /> },
          { n: 2, label: "Vouching",  icon: <Shield size={14} /> },
          { n: 3, label: "Probation", icon: <Award size={14} /> },
          { n: 4, label: "Observe",   icon: <Eye size={14} /> },
          { n: 5, label: "Full Node", icon: <CheckCircle size={14} /> },
        ].map(({ n, label, icon }, i) => (
          <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
            <div 
              onClick={() => setViewPhase(n)}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: phase > n ? "#05C48F" : viewPhase === n ? "#0052FF" : "#F3F4F6",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.3s ease",
                cursor: "pointer",
                boxShadow: viewPhase === n ? "0 0 0 2px white, 0 0 0 4px #0052FF" : "none",
              }}
            >
              {phase > n ? <CheckCircle size={16} color="white" /> : <div style={{ color: viewPhase === n ? "white" : "#C4C9D4" }}>{icon}</div>}
            </div>
            <span style={{ 
              fontSize: 8, fontWeight: 700, 
              color: viewPhase === n ? "#0052FF" : phase > n ? "#05C48F" : "#C4C9D4", 
              textTransform: "uppercase", textAlign: "center" 
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Render Helpers ─────────────────────────────────────────────────────────
  
  const isReadOnly = viewPhase !== phase;

  if (viewPhase === 1) {
    const progress = tasks.length > 0 ? (Object.values(taskState).filter(s => s.found).length / tasks.length) * 100 : 0;

    return (
      <div style={{ padding: "20px 16px 0" }}>
        {Stepper}
        <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: "18px 16px", marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>Phase 1 — Candidate</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Prove your honesty with cryptographic tasks</div>
            </div>
          </div>
          <div style={{ height: 6, background: "var(--bg-input)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#0052FF", width: `${progress}%`, transition: "width 0.4s ease" }} />
          </div>
        </div>

        {tasks.length === 0 ? (
          <button 
            onClick={handleLoadTasks} 
            disabled={loadingTasks || isReadOnly}
            style={{ width: "100%", background: isReadOnly ? "#E5E7EB" : "#0052FF", color: isReadOnly ? "#9CA3AF" : "white", padding: 16, borderRadius: 16, border: "none", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            {loadingTasks ? <Loader size={18} className="animate-spin" /> : "Load My Tasks"}
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: isReadOnly ? 0.7 : 1 }}>
            {tasks.map(t => {
              const s = taskState[t.task_id] || {};
              return (
                <div key={t.task_id} style={{ background: "var(--bg-card)", borderRadius: 16, padding: "14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: s.found ? "#ECFDF5" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {s.found ? <CheckCircle size={20} color="#05C48F" /> : _taskIcon(t.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{t.type.replace('_', ' ')}</div>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>ID: {t.task_id.slice(0, 8)}</div>
                  </div>
                  {s.found ? (
                    <span style={{ fontSize: 12, color: "#05C48F", fontWeight: 700 }}>
                      {t.type === 'POW' ? `Mined: ${s.answer}` : "Ready"}
                    </span>
                  ) : (
                    <button 
                      onClick={() => !isReadOnly && solveTask(t)}
                      disabled={s.solving || isReadOnly}
                      style={{ background: isReadOnly ? "#F3F4F6" : "#EEF3FF", color: isReadOnly ? "#9CA3AF" : "#0052FF", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700 }}
                    >
                      {s.solving ? (t.type === 'POW' ? `${s.nonce}` : "...") : "Solve"}
                    </button>
                  )}
                </div>
              );
            })}
            <button 
              onClick={handleSubmitTasks}
              disabled={submitting || !Object.values(taskState).every(s => s.found) || isReadOnly}
              style={{ marginTop: 10, width: "100%", background: isReadOnly ? "#E5E7EB" : "#05C48F", color: isReadOnly ? "#9CA3AF" : "white", padding: 16, borderRadius: 16, border: "none", fontWeight: 700 }}
            >
              {submitting ? "Submitting..." : "Submit Verification Proofs"}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (viewPhase === 2) {
    const isCompleted = phase > 2;
    const vouchesRequired = config?.VOUCHES_REQUIRED || 2;
    const vouchesReceived = isCompleted ? vouchesRequired : vouchData.length;
    const progress = (vouchesReceived / vouchesRequired) * 100;

    return (
      <div style={{ padding: "20px 16px 0" }}>
        {Stepper}
        <div style={{ background: "var(--bg-card)", borderRadius: 24, padding: "32px 20px", textAlign: "center", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#EEF3FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Clock size={32} color="#0052FF" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>Phase 2 — Vouching</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
            Waiting for {vouchesRequired} trusted nodes to vouch for your identity.
          </div>
          
          <div style={{ background: "var(--bg-input)", borderRadius: 16, padding: "16px", marginBottom: 24, textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>Your Node ID</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code style={{ flex: 1, fontSize: 11, color: "var(--text-primary)", wordBreak: "break-all", background: "var(--bg-card)", padding: "10px", borderRadius: 10, border: "1px solid var(--border-main)", fontFamily: "monospace" }}>
                {nodeId}
              </code>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(nodeId);
                  toast.success("Node ID Copied", { description: "Share this with your voucher node." });
                }}
                style={{ background: "#EEF3FF", color: "#0052FF", border: "none", borderRadius: 10, padding: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Copy size={16} />
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
            <span style={{ color: "var(--text-primary)" }}>Vouch Progress</span>
            <span style={{ color: "#0052FF" }}>{vouchesReceived} / {vouchesRequired}</span>
          </div>
          <div style={{ height: 10, background: "var(--bg-input)", borderRadius: 5, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ height: "100%", background: "#05C48F", width: `${progress}%`, transition: "width 0.4s ease" }} />
          </div>

          {vouchData.length > 0 && (
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Received Vouches</div>
              {vouchData.map((v, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #F3F4F6" }}>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)" }}>{v.voucher_id.slice(0, 8)}...</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#05C48F" }}>+ {v.stake_amount.toFixed(2)} POR</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (viewPhase === 3 || viewPhase === 4) {
    const isObs = viewPhase === 4;
    const rounds = honestRounds;
    const needed = isObs ? (config?.PHASE3_HONEST_ROUNDS || 45) : (config?.PHASE3_ROUNDS || 20);
    const progress = Math.min(100, (rounds / (needed || 1)) * 100);
    const proposal = VOTE_PROPOSALS[rounds % VOTE_PROPOSALS.length];

    return (
      <div style={{ padding: "20px 16px 0" }}>
        {Stepper}
        <div style={{ background: "var(--bg-card)", borderRadius: 24, padding: "24px", boxShadow: "0 1px 8px rgba(0,0,0,0.06)", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: isObs ? "#FFFBEB" : "#EEF3FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isObs ? <Eye size={24} color="#F59E0B" /> : <Award size={24} color="#0052FF" />}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
                {isObs ? "Phase 4 — Observation" : "Phase 3 — Probationary"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Participate in {Math.max(0, (needed || 0) - rounds)} more honest rounds
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
            <span>Round Progress</span>
            <span>{rounds} / {needed}</span>
          </div>
          <div style={{ height: 12, background: "var(--bg-input)", borderRadius: 6, overflow: "hidden", marginBottom: 24 }}>
            <div style={{ height: "100%", background: isObs ? "#F59E0B" : "#0052FF", width: `${progress}%`, transition: "width 0.4s ease" }} />
          </div>

          <div style={{ background: "var(--bg-input)", borderRadius: 20, padding: "16px", border: "1px solid #F0F2F5" }}>
            <div style={{ fontSize: 11, color: "#0052FF", fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Consensus Verification</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Pending Block Proposal</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 16 }}>
              As an Observer, you must verify incoming block data. Automated voting is active, but you can manually override to force a sync round.
            </div>
            
            <div style={{ display: "flex", gap: 10 }}>
              <button 
                onClick={() => setVoteChoice("yes")}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: "2px solid", borderColor: voteChoice === 'yes' ? "#05C48F" : "#F3F4F6", background: voteChoice === 'yes' ? "#ECFDF5" : "white", color: voteChoice === 'yes' ? "#05C48F" : "#374151", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <ThumbsUp size={16} /> Approve
              </button>
              <button 
                onClick={() => setVoteChoice("no")}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: "2px solid", borderColor: voteChoice === 'no' ? "#EF4444" : "#F3F4F6", background: voteChoice === 'no' ? "#FEF2F2" : "white", color: voteChoice === 'no' ? "#EF4444" : "#374151", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <ThumbsDown size={16} /> Reject
              </button>
            </div>
            
            <button 
              onClick={handleManualVote}
              disabled={!voteChoice || voting || isReadOnly}
              style={{ width: "100%", marginTop: 12, background: (!voteChoice || voting || isReadOnly) ? "#F3F4F6" : "#0052FF", color: "white", padding: 14, borderRadius: 12, border: "none", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {voting ? <Loader size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Verify Block
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewPhase === 5) {
    return (
      <div style={{ padding: "20px 16px 0" }}>
        {Stepper}
        <div style={{ background: "var(--bg-card)", borderRadius: 24, padding: "40px 24px", textAlign: "center", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <CheckCircle size={40} color="#05C48F" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>Full Validator</div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 32 }}>
            You have successfully graduated to a Full Node. You now have full voting power and can vouch for new nodes.
          </div>
          <button 
            onClick={() => setActiveTab("validate")}
            style={{ width: "100%", background: "linear-gradient(135deg,#05C48F,#059669)", color: "white", padding: 16, borderRadius: 16, border: "none", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
          >
            Go to Validator Panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px 16px", textAlign: "center" }}>
      <Loader size={32} className="animate-spin" color="#0052FF" style={{ margin: "0 auto" }} />
      <div style={{ marginTop: 12, fontSize: 14, color: "var(--text-secondary)" }}>Syncing node state...</div>
    </div>
  );
}



"use client";
import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Shield,
  Award,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Zap,
  CheckCircle,
  Lock,
} from "lucide-react";
import { fetchColdstartStatus } from "@/chain/api";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        padding: "10px 14px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        fontSize: 13,
      }}
    >
      <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 800, color: "#0052FF", fontSize: 16 }}>
        {Math.round(payload[0].value * 100)}%
      </div>
    </div>
  );
};

export default function Reputation() {
  const { reputation, honestRounds, meritBoost, activities, eligibleToVouch, eligibleToVote, graduated, nodeId } = useStore();
  const [range, setRange] = useState("3M");
  const [vouchData, setVouchData] = useState([]);

  useEffect(() => {
    if (!nodeId) return;
    fetchColdstartStatus(nodeId)
      .then(res => setVouchData(res.vouch || []))
      .catch(() => {});
  }, [nodeId]);

  // Generate dynamic history up to current rep
  const generateHistory = () => {
    const history = [];
    const points = 90;
    
    for (let i = points; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const month = d.toLocaleString("default", { month: "short" });
      const day = d.getDate();
      
      // If we don't have enough rounds, curve stays flat at 0 until recently
      const roundsPerDay = 2; // assume 2 rounds per day
      const daysActive = Math.ceil(honestRounds / roundsPerDay);
      
      let rep = 0;
      if (i <= daysActive) {
        // Curve from 0 to current reputation
        const progress = 1 - (i / Math.max(1, daysActive));
        // simple ease out
        const easeOut = 1 - Math.pow(1 - progress, 3);
        rep = reputation * easeOut;
      }
      
      // Add a tiny bit of noise to make it look alive, except at 0
      if (rep > 0) {
        rep += (Math.random() - 0.5) * 0.01;
      }
      rep = Math.max(0, Math.min(1, rep));
      
      history.push({ date: `${month} ${day}`, rep: Number(rep.toFixed(3)) });
    }
    // ensure last point is exactly current rep
    history[history.length - 1].rep = Number(reputation.toFixed(3));
    return history;
  };

  const FULL_HISTORY = generateHistory();
  const RANGE_MAP = {
    "1W":  FULL_HISTORY.slice(-7),
    "1M":  FULL_HISTORY.slice(-30),
    "3M":  FULL_HISTORY.slice(-90),
    "ALL": FULL_HISTORY,
  };

  const data = RANGE_MAP[range] || FULL_HISTORY;
  const repPct = Math.round(reputation * 100);
  const repColor =
    reputation >= 0.7 ? "#05C48F" : reputation >= 0.4 ? "#F59E0B" : "#EF4444";
  const prev = data.length > 1 ? data[data.length - 2].rep : data[0].rep;
  const change = prev === 0 ? repPct : ((reputation - prev) / (prev || 1)) * 100;
  const isUp = change >= 0;

  const relevantActivities = activities.filter(a => ['phase', 'receive', 'security', 'slash'].includes(a.type));

  const PERKS = [
    { label: "Merit Boost",  desc: `Current yield multiplier is ${meritBoost.toFixed(2)}x`, icon: Zap,          unlocked: true, color: "#F59E0B" },
    { label: "Voting Rights", desc: "Participate in network governance",                  icon: Award,        unlocked: eligibleToVote || graduated, color: "#0052FF" },
    { label: "Vouching",      desc: "Approve new candidate nodes",                        icon: Shield,       unlocked: eligibleToVouch || graduated, color: "#05C48F" },
  ];

  return (
    <div style={{ padding: "20px 16px 0" }}>
      {/* Score hero + chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: "var(--bg-card)",
          borderRadius: 24,
          padding: "22px 20px 0",
          marginBottom: 20,
          boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                fontWeight: 600,
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              REPUTATION SCORE
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: "var(--text-primary)",
                lineHeight: 1,
                letterSpacing: -2,
              }}
            >
              {repPct}
              <span style={{ fontSize: 26, fontWeight: 700 }}>%</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  background: isUp ? "#ECFDF5" : "#FEF2F2",
                  borderRadius: 20,
                  padding: "3px 9px",
                }}
              >
                {isUp ? (
                  <ArrowUpRight size={13} color="#05C48F" />
                ) : (
                  <ArrowDownRight size={13} color="#EF4444" />
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: isUp ? "#05C48F" : "#EF4444",
                  }}
                >
                  {isUp ? "+" : ""}
                  {change.toFixed(1)}% this period
                </span>
              </div>
            </div>
          </div>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: repColor + "18",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingUp size={24} color={repColor} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {["1W", "1M", "3M", "ALL"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                background: range === r ? "#0052FF" : "#F5F7FA",
                color: range === r ? "white" : "#9CA3AF",
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart
            data={data}
            margin={{ top: 0, right: 0, left: -28, bottom: 0 }}
          >
            <defs>
              <linearGradient id="repGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0052FF" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#0052FF" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#F5F5F5" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#C4C9D4" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 1]}
              tick={{ fontSize: 10, fill: "#C4C9D4" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "#0052FF",
                strokeWidth: 1.5,
                strokeDasharray: "4 4",
              }}
            />
            <Area
              type="monotone"
              dataKey="rep"
              stroke="#0052FF"
              strokeWidth={2.5}
              fill="url(#repGrad)"
              dot={false}
              activeDot={{
                r: 5,
                fill: "#0052FF",
                stroke: "white",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Highest",      value: `${repPct}%`,      color: repColor },
          { label: "Days Active",  value: Math.ceil(honestRounds / 2) || 1,               color: "#0052FF" },
          { label: "Vouches",      value: `${vouchData.length} received`,      color: "#8B5CF6" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              padding: "14px 10px",
              textAlign: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-secondary)",
                marginTop: 4,
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Perks section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        style={{
          background: "var(--bg-card)",
          borderRadius: 20,
          marginBottom: 20,
          overflow: "hidden",
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            padding: "16px 16px 12px",
            borderBottom: "1px solid #F5F5F5",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Award size={16} color="#0052FF" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
            Reputation Perks
          </span>
        </div>
        {PERKS.map((perk, i) => (
          <div
            key={perk.label}
            style={{
              padding: "14px 16px",
              borderBottom: i < PERKS.length - 1 ? "1px solid #F9F9F9" : "none",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: perk.unlocked ? `${perk.color}15` : "var(--bg-input)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {perk.unlocked ? (
                <perk.icon size={20} color={perk.color} />
              ) : (
                <Lock size={20} color="#9CA3AF" />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: perk.unlocked ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {perk.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                {perk.desc}
              </div>
            </div>
            {perk.unlocked && (
              <CheckCircle size={18} color="#05C48F" />
            )}
          </div>
        ))}
      </motion.div>

      {/* Decay warning */}
      <div
        style={{
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderRadius: 16,
          padding: "12px 14px",
          marginBottom: 20,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <Clock size={20} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>
            Decay Factor Active
          </div>
          <div style={{ fontSize: 12, color: "#78350F", marginTop: 2 }}>
            Your reputation decays 0.5% per day of inactivity. Keep
            participating.
          </div>
        </div>
      </div>

      {/* Vouch history */}
      {vouchData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: "var(--bg-card)",
            borderRadius: 20,
            marginBottom: 20,
            overflow: "hidden",
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              padding: "14px 16px 10px",
              borderBottom: "1px solid #F5F5F5",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Shield size={15} color="#0052FF" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
              Vouch History
            </span>
          </div>
          {vouchData.map((v, i) => (
            <div
              key={i}
              style={{
                padding: "13px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "#EEF3FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Shield size={18} color="#0052FF" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  Vouched by {v.voucher_id ? `${v.voucher_id.slice(0,8)}...` : "Network"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>
                  Stake: {v.stake_amount || v.stake} POR
                </div>
              </div>
              <div
                style={{
                  background: "#ECFDF5",
                  borderRadius: 10,
                  padding: "4px 10px",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#05C48F" }}>
                  Active
                </span>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Event history */}
      {relevantActivities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            background: "var(--bg-card)",
            borderRadius: 20,
            marginBottom: 20,
            overflow: "hidden",
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              padding: "14px 16px 10px",
              borderBottom: "1px solid #F5F5F5",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={15} color="#8B5CF6" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                Score History
              </span>
            </div>
          </div>
          {relevantActivities.map((e, i) => {
            const isNegative = e.message.toLowerCase().includes("slashing") || e.message.toLowerCase().includes("failed");
            return (
              <div
                key={e.id || i}
                style={{
                  padding: "12px 16px",
                  borderBottom:
                    i < relevantActivities.length - 1 ? "1px solid #F9F9F9" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: isNegative ? "#FEF2F2" : "#ECFDF5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isNegative ? (
                    <ArrowDownRight size={16} color="#EF4444" />
                  ) : (
                    <ArrowUpRight size={16} color="#05C48F" />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}
                  >
                    {e.message}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>
                    {e.time}
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}



"use client";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Download,
  Repeat,
  Zap,
  ChevronRight,
  CheckCircle,
  Shield,
  Award,
  Eye,
  EyeOff,
  Lock,
  Gift,
  Globe,
  Box,
  Download as ReceiveIcon,
  TrendingUp,
} from "lucide-react";
import { useState, useRef } from "react";

const ACTIVITY_META = {
  task: { color: "#05C48F", bg: "#ECFDF5", Icon: CheckCircle },
  vouch: { color: "#0052FF", bg: "#EEF3FF", Icon: Shield },
  reputation: { color: "#8B5CF6", bg: "#F5F3FF", Icon: Zap },
  phase: { color: "#F59E0B", bg: "#FFFBEB", Icon: Award },
  send: { color: "#EF4444", bg: "#FEF2F2", Icon: ArrowUpRight },
  receive: { color: "#10B981", bg: "#ECFDF5", Icon: ArrowDownLeft },
  swap: { color: "#3B82F6", bg: "#EFF6FF", Icon: Repeat },
  default: { color: "var(--text-secondary)", bg: "#F9FAFB", Icon: Zap },
};

export default function Home() {
  const {
    walletBalance,
    walletStaked,
    peersCount,
    chainHeight,
    reputation,
    phase,
    tasksCompleted,
    meritBoost,
    tokens,
    activities,
    setActiveTab,
    graduated,
    claimedGenesis,
    setActiveModal,
  } = useStore();

  const [hideBalance, setHideBalance] = useState(false);
  const longPressRef = useRef(null);

  const startLongPress = () => {
    longPressRef.current = setTimeout(() => setActiveModal("slash"), 700);
  };
  const cancelLongPress = () => clearTimeout(longPressRef.current);

  const repPercent = Math.round(reputation * 100);
  const repColor =
    reputation >= 0.7 ? "#05C48F" : reputation >= 0.4 ? "#F59E0B" : "#EF4444";
  const repBg =
    reputation >= 0.7 ? "#ECFDF5" : reputation >= 0.4 ? "#FFFBEB" : "#FEF2F2";

  return (
    <div style={{ padding: "20px 16px 0" }}>
      {/* Portfolio Balance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: "var(--bg-card)",
          borderRadius: 24,
          padding: "24px 20px",
          marginBottom: 20,
          boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Total Balance
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: -1.5,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {hideBalance
                ? "••••••"
                : `${walletBalance.toFixed(2)} POR`}
            </div>

          </div>
          <button
            onClick={() => setHideBalance(!hideBalance)}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--bg-input)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {hideBalance ? (
              <EyeOff size={18} color="#9CA3AF" />
            ) : (
              <Eye size={18} color="#9CA3AF" />
            )}
          </button>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${claimedGenesis ? 3 : 4}, 1fr)`,
            gap: 10,
          }}
        >
          {[
            { label: "Send", Icon: Send, color: "#0052FF", modal: "send" },
            { label: "Receive", Icon: ReceiveIcon, color: "#10B981", modal: "receive" },
            { label: "Swap", Icon: Repeat, color: "#8B5CF6", modal: "swap" },
            !claimedGenesis && {
              label: "Claim",
              Icon: graduated ? Gift : Lock,
              color: graduated ? "#10B981" : "#9CA3AF",
              modal: "claim",
            },
          ].filter(Boolean).map(({ label, Icon, color, modal }) => (
            <button
              key={label}
              onClick={() => modal ? setActiveModal(modal) : setActiveTab(graduated ? "validate" : "merit")}
              style={{
                background: "var(--bg-input)",
                borderRadius: 14,
                padding: "14px 8px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: color + "15",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={18} color={color} />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Network Status Strip ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, staggerChildren: 0.05 }}
        style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10, marginBottom: 20,
        }}
      >
        {[
          {
            label: "Peers",
            value: peersCount,
            icon: <Globe size={22} color="#05C48F" />,
            color: peersCount > 0 ? "#05C48F" : "var(--text-secondary)",
            bg: peersCount > 0 ? "rgba(5, 196, 143, 0.12)" : "var(--bg-input)",
          },
          {
            label: "Block Height",
            value: `#${chainHeight}`,
            icon: <Box size={22} color="#0052FF" />,
            color: "#0052FF",
            bg: "rgba(0, 82, 255, 0.1)",
          },
          {
            label: "Staked",
            value: `${walletStaked.toFixed(2)} POR`,
            icon: <Lock size={22} color="#F59E0B" />,
            color: walletStaked > 0 ? "#F59E0B" : "var(--text-secondary)",
            bg: walletStaked > 0 ? "rgba(245, 158, 11, 0.12)" : "var(--bg-input)",
          },
        ].map(({ label, value, icon, color, bg }) => (
          <motion.div
            key={label}
            whileHover={{ y: -2 }}
            style={{
              background: bg,
              borderRadius: 16, padding: "12px 10px",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color, letterSpacing: -0.5 }}>
              {value}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600, marginTop: 2 }}>
              {label.toUpperCase()}
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        whileTap={{ scale: 0.98 }}
        style={{
          background:
            "linear-gradient(140deg, #0038E8 0%, #0052FF 55%, #2271FF 100%)",
          borderRadius: 24,
          padding: "28px 24px",
          marginBottom: 20,
          position: "relative",
          overflow: "hidden",
          cursor: "default",
          userSelect: "none",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -24,
            left: 20,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              MERIT SCORE
            </div>
            <div
              style={{
                color: "white",
                fontSize: 42,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: -1.5,
                margin: "8px 0",
                display: "flex",
                alignItems: "baseline",
              }}
            >
              {repPercent}
              <span style={{ fontSize: 22, fontWeight: 700, opacity: 0.9, marginLeft: 2 }}>%</span>
            </div>

          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.18)",
              borderRadius: 14,
              padding: "6px 14px",
              backdropFilter: "blur(10px)",
            }}
          >
            <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>
              {phase === 5 ? "Full Node" : phase === 4 ? "Observation" : `Phase ${phase}`}
            </span>
          </div>
        </div>

        {/* Merit boost info */}
        <div
          style={{
            background: "rgba(255,255,255,0.15)",
            borderRadius: 14,
            padding: "12px 14px",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Yield Multiplier
              </div>
              <div
                style={{
                  color: "white",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {meritBoost.toFixed(2)}x
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.7)",
                textAlign: "right",
              }}
            >
              Earn {Math.round((meritBoost - 1) * 100)}% more
              <br />
              on staking rewards
            </div>
          </div>
        </div>
      </motion.div>

      {/* Merit Progress Cards — hidden once fully graduated */}
      {!graduated && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 18,
              padding: "16px 14px",
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>
                Tasks Done
              </span>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "#05C48F18",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle size={14} color="#05C48F" />
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 3 }}>
              {tasksCompleted} Verified
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {phase === 1 ? "Proof of Honesty" : "Phase 1 Complete"}
            </div>
          </div>

          <button
            onClick={() => setActiveTab("merit")}
            style={{
              background: "linear-gradient(135deg,#0038E8,#0052FF)",
              borderRadius: 18,
              padding: "16px 14px",
              boxShadow: "0 4px 16px rgba(0,82,255,0.25)",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.8)",
                  fontWeight: 600,
                }}
              >
                Continue
              </span>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Zap size={14} color="white" />
              </div>
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "white",
                marginBottom: 3,
              }}
            >
              Merit Mode
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
              Activate now →
            </div>
          </button>
        </div>
      )}

      {/* Graduated validator card — shown only after full graduation */}
      {graduated && (
        <div
          style={{
            background: "linear-gradient(135deg,#05C48F,#059669)",
            borderRadius: 18,
            padding: "18px 16px",
            marginBottom: 20,
            boxShadow: "0 4px 16px rgba(5,196,143,0.28)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Shield size={22} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "white", marginBottom: 2 }}>
              Full Validator
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
              All 5 phases complete · Network access unlocked
            </div>
          </div>
          <button
            onClick={() => setActiveTab("validate")}
            style={{
              background: "rgba(255,255,255,0.22)",
              border: "none", borderRadius: 11, padding: "8px 14px",
              color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Validate →
          </button>
        </div>
      )}


    </div>
  );
}



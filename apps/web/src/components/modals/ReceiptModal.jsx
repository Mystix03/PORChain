"use client";
import { motion } from "framer-motion";
import { X, CheckCircle, ExternalLink, Copy, Box, Clock, Shield } from "lucide-react";
import { toast } from "sonner";

export default function ReceiptModal({ activity, onClose }) {
  if (!activity) return null;

  const copyId = () => {
    navigator.clipboard.writeText(activity.id);
    toast.success("Transaction ID copied");
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(13,20,33,0.6)",
          backdropFilter: "blur(4px)",
        }}
      />
      
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        style={{
          position: "relative",
          background: "var(--bg-card)",
          borderRadius: "32px 32px 0 0",
          padding: "20px 24px 44px",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{ width: 40, height: 5, borderRadius: 2.5, background: "var(--border-main)" }} />
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#ECFDF5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <CheckCircle size={32} color="#10B981" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>
             {activity.type === "REWARD" ? "Block Reward" : "Transaction Confirmed"}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
            Successfully recorded on PoR-Chain
          </div>
        </div>

        {/* Details Card */}
        <div
          style={{
            background: "var(--bg-input)",
            borderRadius: 24,
            padding: 20,
            marginBottom: 24,
            border: "1px solid var(--border-main)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Amount</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
              {activity.amount?.toFixed(4)} POR
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Type</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0052FF" }}>
              {activity.type}
            </span>
          </div>

          <div style={{ borderTop: "1px dashed var(--border-main)", margin: "16px 0", paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Transaction Hash
            </div>
            <div
              onClick={copyId}
              style={{
                fontSize: 12,
                color: "var(--text-primary)",
                fontFamily: "monospace",
                wordBreak: "break-all",
                background: "rgba(0,82,255,0.05)",
                padding: "10px",
                borderRadius: 10,
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {activity.id}
              <Copy size={14} color="#0052FF" />
            </div>
          </div>
        </div>

        {/* Meta Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
          <div style={{ background: "var(--bg-input)", borderRadius: 18, padding: 16, border: "1px solid var(--border-main)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Box size={14} color="#6B7280" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>BLOCK</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
              #{activity.blockLabel?.split("#")[1] || "—"}
            </div>
          </div>

          <div style={{ background: "var(--bg-input)", borderRadius: 18, padding: 16, border: "1px solid var(--border-main)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Shield size={14} color="#6B7280" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>STATUS</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#10B981" }}>
              FINALIZED
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "16px",
              borderRadius: 16,
              background: "var(--text-primary)",
              color: "var(--bg-card)",
              border: "none",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Done
          </button>
          <button
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              background: "var(--bg-input)",
              border: "1.5px solid var(--border-main)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ExternalLink size={20} color="var(--text-primary)" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

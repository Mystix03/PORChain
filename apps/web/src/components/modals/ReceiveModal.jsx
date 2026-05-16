"use client";
import { motion } from "framer-motion";
import { X, Copy, QrCode, Download, Share2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";

import Logo from "../Logo";

export default function ReceiveModal({ onClose }) {
  const { wallet } = useStore();

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet);
    toast.success("Node ID copied to clipboard");
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
          textAlign: "center",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{ width: 40, height: 5, borderRadius: 2.5, background: "var(--border-main)" }} />
        </div>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
             Receive POR
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
            Show this QR code to the sender
          </div>
        </div>

        {/* QR Code Container */}
        <div
          style={{
            background: "white",
            padding: 24,
            borderRadius: 24,
            width: "fit-content",
            margin: "0 auto 32px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
            border: "1px solid #F3F4F6",
          }}
        >
          <div
            style={{
              width: 200,
              height: 200,
              background: "#F9FAFB",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              padding: 10,
            }}
          >
             {/* Simulated QR Code with Ascent Logo in middle */}
             <div style={{
               width: "100%", height: "100%",
               backgroundImage: "radial-gradient(#0D1421 30%, transparent 30%), radial-gradient(#0D1421 30%, transparent 30%)",
               backgroundPosition: "0 0, 4px 4px",
               backgroundSize: "8px 8px",
               opacity: 0.8,
             }} />
             
             <Logo size={50} />
          </div>
        </div>

        {/* Wallet Address Chip */}
        <div
          onClick={handleCopy}
          style={{
            background: "var(--bg-input)",
            borderRadius: 16,
            padding: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 32,
            cursor: "pointer",
            border: "1px solid var(--border-main)",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Your Node ID
            </div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, fontFamily: "monospace" }}>
               {wallet.length > 20 ? `${wallet.slice(0, 10)}...${wallet.slice(-10)}` : wallet}
            </div>
          </div>
          <Copy size={18} color="#0052FF" />
        </div>

        {/* Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
           <button
            style={{
              padding: "16px",
              borderRadius: 16,
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1.5px solid var(--border-main)",
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <Download size={18} />
            Save
          </button>
          <button
            style={{
              padding: "16px",
              borderRadius: 16,
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1.5px solid var(--border-main)",
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <Share2 size={18} />
            Share
          </button>
        </div>
      </motion.div>
    </div>
  );
}

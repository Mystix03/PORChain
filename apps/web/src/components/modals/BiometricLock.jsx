"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { ShieldCheck, Fingerprint, Lock } from "lucide-react";

export default function BiometricLock({ onUnlock }) {
  const [status, setStatus] = useState("waiting"); // waiting | scanning | success

  useEffect(() => {
    // Start scanning after a short delay
    const timer = setTimeout(() => setStatus("scanning"), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (status === "scanning") {
      const timer = setTimeout(() => {
        setStatus("success");
        setTimeout(onUnlock, 1200);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, onUnlock]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "var(--bg-shell)",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <div style={{ position: "relative", marginBottom: 30 }}>
        {/* Background glow */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 3, repeat: Infinity }}
          style={{
            position: "absolute",
            top: -20,
            left: -20,
            right: -20,
            bottom: -20,
            background: status === "success" ? "#10B981" : "#0052FF",
            filter: "blur(40px)",
            borderRadius: "50%",
            zIndex: -1,
          }}
        />

        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 30,
            background: "var(--bg-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <AnimatePresence mode="wait">
            {status === "waiting" && (
              <motion.div
                key="waiting"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
              >
                <Lock size={40} color="#94A3B8" />
              </motion.div>
            )}

            {status === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                style={{ position: "relative" }}
              >
                <Fingerprint size={48} color="#0052FF" />
                {/* Scanner Line */}
                <motion.div
                  animate={{
                    top: ["0%", "100%", "0%"],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{
                    position: "absolute",
                    left: -10,
                    right: -10,
                    height: 2,
                    background: "linear-gradient(90deg, transparent, #0052FF, transparent)",
                    boxShadow: "0 0 10px #0052FF",
                    zIndex: 10,
                  }}
                />
              </motion.div>
            )}

            {status === "success" && (
              <motion.div
                key="success"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 12 }}
              >
                <ShieldCheck size={48} color="#10B981" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          textAlign: "center",
          letterSpacing: -0.5,
        }}
      >
        {status === "waiting" && "Securing Wallet..."}
        {status === "scanning" && "Face ID Scanning..."}
        {status === "success" && "Identity Verified"}
      </motion.div>

      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
        {status === "success" ? "Unlocking Ascent" : "Keep your face in view"}
      </div>
    </motion.div>
  );
}

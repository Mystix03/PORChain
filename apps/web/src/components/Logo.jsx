"use client";
import { motion } from "framer-motion";

export default function Logo({ size = 36, color = "white", style = {} }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: "linear-gradient(135deg, #0038E8, #1A6BFF)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 4px 12px rgba(0, 56, 232, 0.25)",
        ...style,
      }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Iconic 'A' / Mountain / Ascent Shape */}
        <path
          d="M12 4L4 20H8L12 11L16 20H20L12 4Z"
          fill={color}
          stroke={color}
          strokeWidth="1"
          strokeLinejoin="round"
        />
        {/* Accent dot / spark representing Reputation */}
        <circle cx="12" cy="14" r="2" fill="#0038E8" />
        <motion.path
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.5 }}
          d="M7 16L12 6L17 16"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}

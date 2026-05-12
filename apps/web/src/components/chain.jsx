"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { fetchChain } from "@/chain/api";
import {
  Box,
  Layers,
  Clock,
  ChevronRight,
  Database,
  Hash,
  User,
  ArrowRightLeft,
  Circle,
} from "lucide-react";

export default function Chain() {
  const [chainData, setChainData] = useState({ height: 0, chain: [] });
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState(null);

  useEffect(() => {
    const loadChain = async () => {
      try {
        const data = await fetchChain();
        setChainData(data);
      } catch (err) {
        console.error("Failed to load chain:", err);
      } finally {
        setLoading(false);
      }
    };
    loadChain();
    const id = setInterval(loadChain, 6000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (ts) => {
    if (!ts) return "Genesis";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <div style={{ padding: "40px 16px", textAlign: "center" }}>
        <div style={{ display: "inline-block", animation: "spin 1.5s linear infinite" }}>
          <Layers size={32} color="#0052FF" />
        </div>
        <div style={{ marginTop: 12, fontSize: 14, color: "#9CA3AF" }}>Synchronizing blocks...</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 0" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#0D1421", marginBottom: 4 }}>
          PoR-Chain Explorer
        </div>
        <div style={{ fontSize: 13, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#05C48F" }}>
            <Circle size={8} fill="#05C48F" />
            Live Network
          </span>
          <div style={{ width: 1, height: 12, background: "#E5E7EB" }} />
          <span>Height: #{chainData.height}</span>
        </div>
      </div>

      <style>{`
        @keyframes tx-glow {
          0%, 100% { box-shadow: 0 1px 5px rgba(0,0,0,0.06); border-color: transparent; }
          50% { box-shadow: 0 0 12px rgba(5, 196, 143, 0.25); border-color: rgba(5, 196, 143, 0.4); }
        }
        .tx-active { animation: tx-glow 3s ease-in-out infinite; }
      `}</style>

      {/* Block List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 100 }}>
        {chainData.chain.slice().reverse().map((block) => {
          const hasTx = (block.events || []).length > 0;
          return (
            <div 
              key={block.index}
              onClick={() => setSelectedBlock(selectedBlock === block.index ? null : block.index)}
              className={hasTx ? "tx-active" : ""}
              style={{
                background: "white",
                borderRadius: 20,
                padding: "16px",
                boxShadow: "0 1px 5px rgba(0,0,0,0.06)",
                cursor: "pointer",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                border: selectedBlock === block.index ? "1.5px solid #0052FF" : "1.5px solid transparent",
              }}
            >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 13,
                  background: block.index === 0 ? "#EEF3FF" : "#F5F7FA",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0
                }}>
                  {block.index === 0 ? <Database size={20} color="#0052FF" /> : <Box size={20} color="#6B7280" />}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0D1421" }}>
                    Block #{block.index}
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={10} />
                    {formatTime(block.timestamp)}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ 
                  fontSize: 13, fontWeight: 800, 
                  color: (block.events?.length > 0) ? "#05C48F" : "#9CA3AF"
                }}>
                  {block.events?.length || 0} TXs
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>
                  {block.proposer?.slice(0, 8)}...
                </div>
              </div>
            </div>

            {selectedBlock === block.index && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #F3F4F6" }}>
                {/* Hash Info */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 6 }}>Block Hash</div>
                  <code style={{ fontSize: 11, background: "#F9FAFB", padding: "8px 10px", borderRadius: 8, display: "block", color: "#374151", wordBreak: "break-all", border: "1px solid #F0F2F5" }}>
                    {block.hash}
                  </code>
                </div>

                {/* Previous Hash */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 6 }}>Previous Hash</div>
                  <code style={{ fontSize: 11, background: "#F9FAFB", padding: "8px 10px", borderRadius: 8, display: "block", color: "#374151", wordBreak: "break-all", border: "1px solid #F0F2F5" }}>
                    {block.previous_hash || "—"}
                  </code>
                </div>

                {/* Transactions */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 10 }}>Transactions</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(block.events || []).length === 0 ? (
                      <div style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic", padding: "4px 0" }}>No transactions in this block</div>
                    ) : (
                      block.events.map((ev, i) => (
                        <div key={i} style={{ 
                          background: (ev.type === 'SEND' || ev.type === 'SLASH') ? "#FEF2F2" : (ev.type === 'GENESIS' || ev.type === 'RECEIVE') ? "#ECFDF5" : "#F9FAFB", 
                          borderRadius: 12, padding: "10px", 
                          border: `1px solid ${(ev.type === 'SEND' || ev.type === 'SLASH') ? "#FECACA" : (ev.type === 'GENESIS' || ev.type === 'RECEIVE') ? "#D1FAE5" : "#F0F2F5"}`
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ 
                              fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
                              background: (ev.type === 'SEND' || ev.type === 'SLASH') ? "#EF4444" : (ev.type === 'GENESIS' || ev.type === 'RECEIVE') ? "#05C48F" : "#6B7280",
                              color: "white"
                            }}>
                              {ev.type}
                            </span>
                            {ev.amount && (
                              <span style={{ 
                                fontSize: 12, fontWeight: 800, 
                                color: (ev.type === 'SEND' || ev.type === 'SLASH') ? "#DC2626" : (ev.type === 'GENESIS' || ev.type === 'RECEIVE') ? "#05C48F" : "#0D1421" 
                              }}>
                                {ev.type === 'SEND' ? "−" : ev.type === 'RECEIVE' ? "+" : ""}
                                {ev.amount.toFixed(4)} POR
                              </span>
                            )}
                          </div>
                          {ev.type === 'SEND' && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#6B7280" }}>
                              <span style={{ fontFamily: "monospace" }}>
                                {ev.from?.length > 12 ? `${ev.from.slice(0, 6)}...${ev.from.slice(-4)}` : ev.from}
                              </span>
                              <ArrowRightLeft size={10} />
                              <span style={{ fontFamily: "monospace" }}>
                                {ev.to?.length > 12 ? `${ev.to.slice(0, 6)}...${ev.to.slice(-4)}` : ev.to}
                              </span>
                            </div>
                          )}
                          {ev.type === 'GENESIS' && (
                            <div style={{ fontSize: 10, color: "#6B7280" }}>{ev.data?.note || "Protocol Launch"}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

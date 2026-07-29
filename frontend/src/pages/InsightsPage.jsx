import React, { useState, useEffect } from "react";
import { api } from "../api.js";

export default function InsightsPage() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInsights();
  }, []);

  async function loadInsights() {
    setLoading(true);
    try {
      const data = await api.getInsights();
      setInsights(data);
      setLoading(false);
    } catch (err) {
      setError("Failed to generate AI insights.");
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>AI Nutrition Insights</h2>
      <p className="muted" style={{ marginBottom: "24px" }}>
        Review automated analysis of your dietary history and logging habits. Insights are classified as factual observations, healthy suggestions, or warnings.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ marginBottom: "24px" }}>
        <button onClick={loadInsights} disabled={loading}>
          {loading ? "Analyzing..." : "Refresh Insights"}
        </button>
      </div>

      {loading && insights.length === 0 ? (
        <div className="muted">Analyzing dietary history...</div>
      ) : (
        <div>
          {insights.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "40px 0" }}>
              <p className="muted">Not enough logging history to generate weekly insights. Log a few meals first.</p>
            </div>
          ) : (
            <div>
              {insights.map((ins, idx) => {
                const typeClass = ins.type.toLowerCase();
                let emoji = "💡";
                if (typeClass === "warning") emoji = "⚠️";
                if (typeClass === "observation") emoji = "📊";
                if (typeClass === "suggestion") emoji = "🥗";

                return (
                  <div key={idx} className={`insight-card ${typeClass}`}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "20px" }}>{emoji}</span>
                      <div>
                        <h4 style={{ textTransform: "capitalize", fontSize: "14px", fontWeight: 700, margin: 0, marginBottom: "4px" }}>
                          {ins.type}
                        </h4>
                        <p style={{ color: "var(--text)", fontSize: "14px" }}>{ins.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

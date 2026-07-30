import React, { useEffect, useState, useRef } from "react";
import { api } from "../api.js";

const insightIcons = { warning: "⚠️", observation: "📊", suggestion: "🥗" };

export default function InsightsPage() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [asking, setAsking] = useState(false);
  const chatContainerRef = useRef(null);

  useEffect(() => { loadInsights(); }, []);
  
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  async function loadInsights() {
    setLoading(true);
    setError(null);
    try {
      setInsights(await api.getInsights());
    } catch (err) {
      setError("Failed to generate AI insights.");
    } finally {
      setLoading(false);
    }
  }

  async function askQuestion(event) {
    event.preventDefault();
    if (!question.trim() || asking) return;
    
    const q = question.trim();
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    setAsking(true);
    setError(null);
    
    try {
      const result = await api.askNutritionQuestion(q);
      setMessages((prev) => [...prev, { role: "assistant", text: result.answer }]);
    } catch (err) {
      setError(`Unable to answer your question: ${err.message}`);
      setMessages((prev) => prev.slice(0, -1)); // Remove the user message on error
    } finally {
      setAsking(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 80px)" }}>
      <div style={{ flex: 1 }}>
        <h2>AI Nutrition Insights</h2>
      <p className="muted" style={{ marginBottom: "24px" }}>
        Review your logged-meal patterns or ask a question about your calories and nutrients.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {messages.length > 0 ? (
        <section className="nutrition-chat-response" aria-live="polite" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
             <button className="secondary" onClick={() => setMessages([])}>Back to Insights</button>
          </div>
          <div 
            ref={chatContainerRef}
            style={{ 
              maxHeight: "500px", 
              overflowY: "auto", 
              display: "flex", 
              flexDirection: "column", 
              gap: "12px",
              paddingRight: "10px"
            }}
          >
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble ${msg.role === "user" ? "user-question" : "assistant-answer"}`}>
                {msg.role === "assistant" && <span aria-hidden="true">✨</span>}
                <p>{msg.text}</p>
              </div>
            ))}
            {asking && (
              <div className="chat-bubble assistant-answer">
                <span aria-hidden="true">✨</span>
                <p className="muted">Thinking...</p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <>
          <div style={{ marginBottom: "24px" }}>
            <button onClick={loadInsights} disabled={loading}>{loading ? "Analyzing..." : "Refresh Insights"}</button>
          </div>
          {loading && insights.length === 0 ? <div className="muted">Analyzing dietary history...</div> : (
            insights.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "40px 0" }}>
                <p className="muted">Not enough logging history to generate weekly insights. Log a few meals first.</p>
              </div>
            ) : (
              insights.map((ins, idx) => {
                const type = ins.type.toLowerCase();
                return <div key={idx} className={`insight-card ${type}`}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "20px" }}>{insightIcons[type] || "💡"}</span>
                    <div><h4 style={{ textTransform: "capitalize", fontSize: "14px", fontWeight: 700, margin: "0 0 4px" }}>{ins.type}</h4><p>{ins.message}</p></div>
                  </div>
                </div>;
              })
            )
          )}
        </>
      )}
      </div>

      <form className="nutrition-chat-input" onSubmit={askQuestion} style={{ marginTop: "auto", position: "sticky", bottom: "16px" }}>
        <label htmlFor="nutrition-question">Ask the nutrition assistant</label>
        <div>
          <input id="nutrition-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. How can I eat more protein?" disabled={asking} />
          <button type="submit" disabled={!question.trim() || asking}>{asking ? "Thinking..." : "Ask"}</button>
        </div>
      </form>
    </div>
  );
}

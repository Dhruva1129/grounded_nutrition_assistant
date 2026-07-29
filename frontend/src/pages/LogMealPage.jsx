import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function LogMealPage() {
  const [rawText, setRawText] = useState("");
  const [mealType, setMealType] = useState("lunch");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Parsed results state
  const [mealId, setMealId] = useState(null);
  const [items, setItems] = useState([]);
  const [clarifications, setClarifications] = useState([]);
  const [assumptions, setAssumptions] = useState([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  const navigate = useNavigate();

  async function handleParse(e) {
    e.preventDefault();
    if (!rawText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.parseMeal(
        rawText,
        mealType,
        new Date().toISOString().split("T")[0]
      );
      setMealId(res.meal_id);
      setItems(res.items);
      setClarifications(res.clarifications);
      setAssumptions(res.ai_assumptions);
      setTotals({
        calories: res.total_calories,
        protein: res.total_protein,
        carbs: res.total_carbs,
        fat: res.total_fat
      });
    } catch (err) {
      setError("Failed to parse meal: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswerClarification(clarId, answerText) {
    setLoading(true);
    try {
      const res = await api.answerClarification(mealId, clarId, answerText);
      setItems(res.items);
      setClarifications(res.clarifications);
      setAssumptions(res.ai_assumptions);
      setTotals({
        calories: res.total_calories,
        protein: res.total_protein,
        carbs: res.total_carbs,
        fat: res.total_fat
      });
    } catch (err) {
      setError("Failed to answer clarification: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    setItems(updated);

    // Recalculate totals client-side
    const cal = updated.reduce((sum, i) => sum + (i.calories || 0), 0);
    const prot = updated.reduce((sum, i) => sum + (i.protein_g || 0), 0);
    const carb = updated.reduce((sum, i) => sum + (i.carbs_g || 0), 0);
    const f = updated.reduce((sum, i) => sum + (i.fat_g || 0), 0);
    setTotals({ calories: cal, protein: prot, carbs: carb, fat: f });
  };

  async function handleSave() {
    setLoading(true);
    try {
      // Map corrections
      const corrections = items.map((it) => ({
        calories: it.calories,
        protein_g: it.protein_g,
        carbs_g: it.carbs_g,
        fat_g: it.fat_g,
        food_name: it.food_name,
        quantity: it.quantity,
        unit: it.unit,
        preparation_method: it.preparation_method
      }));
      await api.saveMeal(mealId, corrections);
      navigate("/dashboard");
    } catch (err) {
      setError("Failed to save meal: " + err.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Log a New Meal</h2>
      <p className="muted" style={{ marginBottom: "24px" }}>
        Describe your meal in plain English. The AI extracts items, matches them to our verified knowledge base, and flags any uncertainty.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <form onSubmit={handleParse}>
          <div className="grid grid-2">
            <div className="form-group">
              <label>Meal Type</label>
              <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>What did you eat?</label>
            <textarea
              rows={4}
              placeholder="e.g. I had two scrambled eggs with butter and a cup of black coffee"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading || !rawText.trim()}>
            {loading ? "Analyzing Meal..." : "Parse & Analyze Meal"}
          </button>
        </form>
      </div>

      {/* Render Clarification Dialogs */}
      {clarifications.length > 0 && (
        <div className="card card-accent" style={{ borderColor: "var(--warning)" }}>
          <h3 style={{ color: "var(--warning)" }}>🤖 AI Clarification Required</h3>
          <p className="muted" style={{ marginBottom: "16px" }}>The assistant detected some ambiguity in your portion sizes or prep methods. Please specify:</p>
          {clarifications.map((q) => (
            <div key={q.id} style={{ marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
              <p style={{ fontWeight: 600, marginBottom: "10px" }}>{q.question_text}</p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {q.options.map((opt) => (
                  <button key={opt} type="button" className="secondary" onClick={() => handleAnswerClarification(q.id, opt)}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Render Parsed Items & Corrections Form */}
      {mealId && (
        <div className="card parse-preview-box">
          <h3>Review & Correct Nutrient Estimates</h3>
          <p className="muted" style={{ marginBottom: "20px" }}>
            Below are the extracted details. You can edit any calorie or macronutrient value directly before saving it to your history.
          </p>

          <div style={{ marginBottom: "24px" }}>
            {items.map((item, idx) => (
              <div key={item.id || idx} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontWeight: 700 }}>{item.food_name}</span>
                    <span className={`badge ${item.confidence === "high" ? "badge-success" : "badge-warning"}`}>
                      {item.confidence} confidence
                    </span>
                    <span className="badge badge-neutral">{item.source.replace("_", " ")}</span>
                  </div>
                  {item.kb_entry_name && (
                    <span className="muted" style={{ fontSize: "11px" }}>
                      Matched to KB: <strong>{item.kb_entry_name}</strong>
                    </span>
                  )}
                </div>

                <div className="item-editor-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Calories (Kcal)</label>
                    <input
                      type="number"
                      value={item.calories}
                      onChange={(e) => handleItemChange(idx, "calories", e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Protein (g)</label>
                    <input
                      type="number"
                      value={item.protein_g}
                      onChange={(e) => handleItemChange(idx, "protein_g", e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Carbs (g)</label>
                    <input
                      type="number"
                      value={item.carbs_g}
                      onChange={(e) => handleItemChange(idx, "carbs_g", e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Fats (g)</label>
                    <input
                      type="number"
                      value={item.fat_g}
                      onChange={(e) => handleItemChange(idx, "fat_g", e.target.value)}
                    />
                  </div>
                </div>
                {item.source_citation && (
                  <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>
                    Source Citation: <em>{item.source_citation}</em>
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* AI Assumptions List */}
          {assumptions.length > 0 && (
            <div style={{ marginBottom: "24px", padding: "12px", backgroundColor: "var(--bg-panel-alt)", borderRadius: "var(--radius-sm)" }}>
              <h5 style={{ fontFamily: "Space Grotesk", fontSize: "12px", marginBottom: "6px" }}>AI Assumptions & Warnings:</h5>
              <ul style={{ paddingLeft: "16px", fontSize: "13px" }}>
                {assumptions.map((ass, i) => (
                  <li key={i} className="muted" style={{ marginBottom: "4px" }}>{ass}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Meal Totals */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid var(--border-accent)", paddingTop: "16px" }}>
            <div>
              <span style={{ fontSize: "14px", fontWeight: 700, marginRight: "16px" }}>Total Meal Calories:</span>
              <span style={{ fontFamily: "Space Grotesk", fontSize: "24px", fontWeight: 700 }}>
                {Math.round(totals.calories)} kcal
              </span>
              <div className="muted" style={{ marginTop: "4px" }}>
                Protein: {Math.round(totals.protein)}g | Carbs: {Math.round(totals.carbs)}g | Fats: {Math.round(totals.fat)}g
              </div>
            </div>
            <button onClick={handleSave} disabled={loading || clarifications.length > 0}>
              Save to History
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

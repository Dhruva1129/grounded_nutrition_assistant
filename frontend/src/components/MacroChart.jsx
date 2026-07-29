import React from "react";

export default function MacroChart({ protein, carbs, fat }) {
  const total = protein * 4 + carbs * 4 + fat * 9;
  
  const pPct = total > 0 ? ((protein * 4) / total) * 100 : 0;
  const cPct = total > 0 ? ((carbs * 4) / total) * 100 : 0;
  const fPct = total > 0 ? ((fat * 9) / total) * 100 : 0;

  return (
    <div className="macro-chart-box">
      <h4 style={{ marginBottom: "16px" }}>Macronutrient Ratio (By Energy)</h4>
      
      <div className="macro-bar-container">
        <div className="macro-bar-label">
          <span>Protein</span>
          <span>{Math.round(protein)}g ({Math.round(pPct)}%)</span>
        </div>
        <div className="macro-bar-bg">
          <div className="macro-bar-fill" style={{ width: `${pPct}%`, backgroundColor: "#EF4444" }}></div>
        </div>
      </div>

      <div className="macro-bar-container">
        <div className="macro-bar-label">
          <span>Carbohydrates</span>
          <span>{Math.round(carbs)}g ({Math.round(cPct)}%)</span>
        </div>
        <div className="macro-bar-bg">
          <div className="macro-bar-fill" style={{ width: `${cPct}%`, backgroundColor: "#3B82F6" }}></div>
        </div>
      </div>

      <div className="macro-bar-container">
        <div className="macro-bar-label">
          <span>Fats</span>
          <span>{Math.round(fat)}g ({Math.round(fPct)}%)</span>
        </div>
        <div className="macro-bar-bg">
          <div className="macro-bar-fill" style={{ width: `${fPct}%`, backgroundColor: "#F59E0B" }}></div>
        </div>
      </div>
      
      <p className="muted" style={{ marginTop: "12px", fontSize: "11px" }}>
        Total energy from logged macros: {Math.round(total)} kcal
      </p>
    </div>
  );
}

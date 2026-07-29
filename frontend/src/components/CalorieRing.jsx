import React from "react";

export default function CalorieRing({ consumed, target }) {
  const pct = target > 0 ? Math.min(consumed / target, 1.2) : 0;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - Math.min(pct, 1) * circumference;

  return (
    <div className="circular-progress-container">
      <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: "rotate(-90deg)" }}>
        {/* Background circle */}
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="transparent"
          stroke="var(--bg-panel-alt)"
          strokeWidth="10"
        />
        {/* Progress circle */}
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="transparent"
          stroke="var(--border-accent)"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="circular-progress-text">
        <span className="number">{Math.round(consumed)}</span>
        <span className="muted" style={{ fontSize: "11px" }}>of {target}</span>
        <span className="label">Kcal</span>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function ProgressPage() {
  const [trends, setTrends] = useState(null);
  const [wellness, setWellness] = useState({ water_ml: 0, weight_kg: "", steps: 0, exercise_minutes: 0, exercise_calories: 0 });
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.getWeeklyTrends().then(setTrends).catch(() => setMessage("Unable to load weekly trends."));
    api.getDailyWellness().then((data) => setWellness({ ...data, weight_kg: data.weight_kg ?? "" })).catch(() => setMessage("Unable to load today’s activity log."));
  }, []);

  const change = (field, value) => setWellness({ ...wellness, [field]: value === "" ? "" : Number(value) || 0 });
  async function save(event) {
    event.preventDefault();
    await api.saveDailyWellness({ ...wellness, weight_kg: wellness.weight_kg === "" ? null : wellness.weight_kg });
    setMessage("Today’s wellness log saved.");
  }

  return <div>
    <h2>Progress & Activity</h2>
    <p className="muted" style={{ marginBottom: 24 }}>Track seven-day nutrition patterns and daily wellness habits.</p>
    {message && <div className="badge badge-success" style={{ display: "block", padding: 10, marginBottom: 16 }}>{message}</div>}
    {trends && <div className="grid grid-3">
      <div className="stat-box"><span className="label">Logging streak</span><span className="value">{trends.streak} days</span></div>
      <div className="stat-box"><span className="label">7-day avg calories</span><span className="value">{trends.average_calories} kcal</span></div>
      <div className="stat-box"><span className="label">7-day avg protein</span><span className="value">{trends.average_protein}g</span></div>
    </div>}
    {trends && <div className="card" style={{ marginTop: 20 }}><h3>Daily calories</h3><div className="trend-bars">{trends.days.map((day) => <div key={day.date} className="trend-day"><div className="trend-bar" style={{ height: `${Math.min(100, day.calories / 20)}px` }} title={`${day.calories} kcal`} /><span>{day.date.slice(5)}</span><strong>{Math.round(day.calories)}</strong></div>)}</div></div>}
    <form className="card" style={{ marginTop: 20 }} onSubmit={save}>
      <h3>Today’s wellness log</h3><div className="grid grid-2">
        <div className="form-group"><label>Water (ml)</label><input type="number" value={wellness.water_ml} onChange={(e) => change("water_ml", e.target.value)} /></div>
        <div className="form-group"><label>Weight (kg)</label><input type="number" value={wellness.weight_kg} onChange={(e) => change("weight_kg", e.target.value)} /></div>
        <div className="form-group"><label>Steps</label><input type="number" value={wellness.steps} onChange={(e) => change("steps", e.target.value)} /></div>
        <div className="form-group"><label>Exercise minutes</label><input type="number" value={wellness.exercise_minutes} onChange={(e) => change("exercise_minutes", e.target.value)} /></div>
      </div><button>Save activity</button>
    </form>
  </div>;
}

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import CalorieRing from "../components/CalorieRing.jsx";
import MacroChart from "../components/MacroChart.jsx";

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [streak, setStreak] = useState(0);
  const [recentMeals, setRecentMeals] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const dateStr = new Date().toISOString().split("T")[0];
      const sumData = await api.getDailySummary(dateStr);
      setSummary(sumData);

      const history = await api.getMealHistory();
      setRecentMeals(history.slice(0, 5));

      // Calculate simple streak (consecutive days of logs)
      if (history.length > 0) {
        let count = 0;
        let lastDate = new Date();
        // unique dates logged
        const dates = [...new Set(history.map(m => m.date))].sort().reverse();
        
        // check if logged today or yesterday
        const todayStr = lastDate.toISOString().split("T")[0];
        lastDate.setDate(lastDate.getDate() - 1);
        const yesterdayStr = lastDate.toISOString().split("T")[0];

        if (dates.includes(todayStr) || dates.includes(yesterdayStr)) {
          count = 1;
          let expectedDate = new Date(dates[0]);
          for (let i = 1; i < dates.length; i++) {
            expectedDate.setDate(expectedDate.getDate() - 1);
            const expStr = expectedDate.toISOString().split("T")[0];
            if (dates[i] === expStr) {
              count++;
            } else {
              break;
            }
          }
        }
        setStreak(count);
      }
    } catch (err) {
      setError("Failed to load dashboard data.");
    }
  }

  async function handleQuickLog(foodName) {
    setError(null);
    try {
      // Find food details in KB
      const kb = await api.getKnowledgeBase(foodName);
      if (kb && kb.length > 0) {
        const item = kb[0];
        // Create direct meal parse and save
        const response = await api.parseMeal(
          `1 serving of ${item.food_name}`,
          "snack",
          new Date().toISOString().split("T")[0]
        );
        // Automatically save
        await api.saveMeal(response.meal_id, []);
        loadDashboard();
      }
    } catch (err) {
      setError("Failed to quick-log meal: " + err.message);
    }
  }

  if (!summary) return <div className="muted" style={{ padding: "40px 0" }}>Loading dashboard...</div>;

  return (
    <div>
      <div className="summary-header">
        <div>
          <h2>Today's Summary</h2>
          <p className="muted">{new Date(summary.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {streak > 0 && (
            <div className="badge badge-success" style={{ padding: "8px 14px", display: "flex", gap: "6px", alignItems: "center" }}>
              <span>🔥</span> {streak} Day Streak
            </div>
          )}
          <Link to="/log" className="btn accent-btn">Log a Meal</Link>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="grid grid-3">
        {/* Calorie Ring Card */}
        <div className="card" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <CalorieRing consumed={summary.total_calories} target={summary.calorie_target} />
        </div>

        {/* Nutrition values summary */}
        <div className="card">
          <h3>Nutrients Logged</h3>
          <div className="grid grid-2" style={{ marginTop: "16px", gap: "12px" }}>
            <div className="stat-box">
              <span className="label">Protein</span>
              <span className="value">{summary.total_protein}g</span>
            </div>
            <div className="stat-box">
              <span className="label">Carbs</span>
              <span className="value">{summary.total_carbs}g</span>
            </div>
            <div className="stat-box">
              <span className="label">Fats</span>
              <span className="value">{summary.total_fat}g</span>
            </div>
            <div className="stat-box">
              <span className="label">Remaining</span>
              <span className="value" style={{ color: summary.remaining_calories < 0 ? "var(--danger)" : "inherit" }}>
                {summary.remaining_calories}
              </span>
            </div>
          </div>
        </div>

        {/* Macro Ratio widget */}
        <div className="card">
          <MacroChart protein={summary.total_protein} carbs={summary.total_carbs} fat={summary.total_fat} />
        </div>
      </div>

      <div className="grid grid-2">
        {/* Today's Meals */}
        <div className="card">
          <h3>Meals Logged Today</h3>
          {summary.meals.length === 0 ? (
            <div style={{ padding: "30px 0", textAlign: "center" }}>
              <p className="muted" style={{ marginBottom: "16px" }}>You haven't logged any meals today.</p>
              <Link to="/log" className="btn secondary">Log First Meal</Link>
            </div>
          ) : (
            <table style={{ marginTop: "12px" }}>
              <thead>
                <tr>
                  <th>Meal</th>
                  <th>Description</th>
                  <th>Calories</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {summary.meals.map((m) => (
                  <tr key={m.id}>
                    <td style={{ textTransform: "capitalize", fontWeight: 600 }}>{m.meal_type}</td>
                    <td className="muted">{m.raw_text}</td>
                    <td>{Math.round(m.total_calories)} kcal</td>
                    <td>
                      <Link to="/history" className="link-btn">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Log widget */}
        <div className="card">
          <h3>Quick Log Favorites</h3>
          <p className="muted" style={{ marginBottom: "16px" }}>One-click log standard portions of healthy foods as a snack.</p>
          <div className="grid grid-2" style={{ gap: "10px" }}>
            <div className="quick-log-item" onClick={() => handleQuickLog("Apple")}>
              <span>🍎 Fresh Apple</span>
              <span className="muted">95 kcal</span>
            </div>
            <div className="quick-log-item" onClick={() => handleQuickLog("Banana")}>
              <span>🍌 Banana</span>
              <span className="muted">105 kcal</span>
            </div>
            <div className="quick-log-item" onClick={() => handleQuickLog("Egg (Boiled)")}>
              <span>🥚 Boiled Egg</span>
              <span className="muted">78 kcal</span>
            </div>
            <div className="quick-log-item" onClick={() => handleQuickLog("Almonds")}>
              <span>🫘 Almonds (28g)</span>
              <span className="muted">164 kcal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

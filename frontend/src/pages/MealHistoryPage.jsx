import React, { useState, useEffect } from "react";
import { api } from "../api.js";

export default function MealHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedMeal, setExpandedMeal] = useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const data = await api.getMealHistory();
      setHistory(data);
      setLoading(false);
    } catch (err) {
      setError("Failed to load meal history.");
      setLoading(false);
    }
  }

  // Group meals by date
  const groupedMeals = history.reduce((groups, meal) => {
    const dateKey = meal.date;
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: dateKey,
        meals: [],
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0
      };
    }
    groups[dateKey].meals.push(meal);
    groups[dateKey].totalCalories += meal.total_calories;
    groups[dateKey].totalProtein += meal.total_protein;
    groups[dateKey].totalCarbs += meal.total_carbs;
    groups[dateKey].totalFat += meal.total_fat;
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedMeals).sort().reverse();

  if (loading) return <div className="muted">Loading meal logs...</div>;

  return (
    <div>
      <h2>Meal History & Logs</h2>
      <p className="muted" style={{ marginBottom: "24px" }}>
        Review your complete logging history. Expand any meal to view itemized nutritional details, confidence metrics, and your saved corrections.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {sortedDates.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 0" }}>
          <p className="muted">No meals logged yet.</p>
        </div>
      ) : (
        sortedDates.map((dateStr) => {
          const day = groupedMeals[dateStr];
          return (
            <div className="card" key={dateStr}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--border-accent)", paddingBottom: "12px", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ margin: 0 }}>
                    {new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h3>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontFamily: "Space Grotesk", fontSize: "18px", fontWeight: 700 }}>
                    {Math.round(day.totalCalories)} kcal
                  </span>
                  <div className="muted" style={{ fontSize: "11px", marginTop: "2px" }}>
                    P: {Math.round(day.totalProtein)}g | C: {Math.round(day.totalCarbs)}g | F: {Math.round(day.totalFat)}g
                  </div>
                </div>
              </div>

              <div>
                {day.meals.map((meal) => {
                  const isExpanded = expandedMeal === meal.id;
                  return (
                    <div key={meal.id} style={{ borderBottom: "1px solid var(--border)", padding: "12px 0", lastChild: { borderBottom: "none" } }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ textTransform: "capitalize", fontWeight: 700, marginRight: "12px" }}>
                            {meal.meal_type}
                          </span>
                          <span className="muted" style={{ fontSize: "13px" }}>{meal.raw_text}</span>
                        </div>
                        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                          <span style={{ fontWeight: 600 }}>{Math.round(meal.total_calories)} kcal</span>
                          <button className="secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}>
                            {isExpanded ? "Hide Details" : "Show Details"}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: "16px", padding: "14px", backgroundColor: "var(--bg-panel-alt)", borderRadius: "var(--radius-sm)" }}>
                          <h4 style={{ marginBottom: "10px" }}>Food Items:</h4>
                          <table style={{ background: "white", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                            <thead>
                              <tr>
                                <th>Food</th>
                                <th>Quantity</th>
                                <th>Calories</th>
                                <th>Protein</th>
                                <th>Carbs</th>
                                <th>Fats</th>
                                <th>Source</th>
                              </tr>
                            </thead>
                            <tbody>
                              {meal.items.map((item) => (
                                <tr key={item.id}>
                                  <td style={{ fontWeight: 600 }}>{item.food_name}</td>
                                  <td>{item.quantity} {item.unit}</td>
                                  <td>
                                    {item.calories} kcal
                                    {item.user_corrected && item.original_calories !== null && (
                                      <div style={{ fontSize: "10px", color: "var(--warning)" }}>
                                        (Corrected from {item.original_calories} kcal)
                                      </div>
                                    )}
                                  </td>
                                  <td>{item.protein_g}g</td>
                                  <td>{item.carbs_g}g</td>
                                  <td>{item.fat_g}g</td>
                                  <td>
                                    <span className={`badge ${item.confidence === "high" ? "badge-success" : "badge-warning"}`} style={{ fontSize: "9px" }}>
                                      {item.confidence}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {meal.ai_assumptions && meal.ai_assumptions.length > 0 && (
                            <div style={{ marginTop: "12px" }}>
                              <span style={{ fontSize: "11px", fontWeight: 700 }}>AI Assumptions:</span>
                              <ul style={{ paddingLeft: "14px", fontSize: "12px", marginTop: "4px" }}>
                                {meal.ai_assumptions.map((ass, idx) => (
                                  <li key={idx} className="muted">{ass}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { api } from "../api.js";

export default function MealPlanPage() {
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedItems, setEditedItems] = useState([]);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setLoading(true);
    try {
      const allPlans = await api.getMealPlans();
      setPlans(allPlans);
      
      // If there's an active draft or approved plan for tomorrow/future, show it
      if (allPlans.length > 0) {
        setCurrentPlan(allPlans[0]);
      }
    } catch (err) {
      setError("Failed to load meal plans.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      const res = await api.generateMealPlan(tomorrowStr);
      setCurrentPlan(res);
      setEditing(false);
      loadPlans();
    } catch (err) {
      setError("Failed to generate plan: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(planId) {
    setLoading(true);
    try {
      const res = await api.approveMealPlan(planId);
      setCurrentPlan(res);
      loadPlans();
    } catch (err) {
      setError("Failed to approve plan.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(planId) {
    setLoading(true);
    try {
      const res = await api.rejectMealPlan(planId);
      setCurrentPlan(res);
      loadPlans();
    } catch (err) {
      setError("Failed to reject plan.");
    } finally {
      setLoading(false);
    }
  }

  const startEditing = () => {
    setEditedItems(currentPlan.items.map(it => ({ ...it })));
    setEditing(true);
  };

  const handleEditItem = (index, field, value) => {
    const updated = [...editedItems];
    if (field === "food_name" || field === "meal_type" || field === "unit" || field === "preparation_method") {
      updated[index][field] = value;
    } else {
      updated[index][field] = parseFloat(value) || 0;
    }
    setEditedItems(updated);
  };

  async function saveEdits() {
    setLoading(true);
    try {
      const res = await api.editMealPlan(currentPlan.id, editedItems);
      setCurrentPlan(res);
      setEditing(false);
      loadPlans();
    } catch (err) {
      setError("Failed to save plan edits.");
    } finally {
      setLoading(false);
    }
  };

  // Group current plan items by meal type
  const groupedPlanItems = currentPlan
    ? (editing ? editedItems : currentPlan.items).reduce((groups, item) => {
        if (!groups[item.meal_type]) groups[item.meal_type] = [];
        groups[item.meal_type].push(item);
        return groups;
      }, {})
    : {};

  const mealTypes = ["breakfast", "lunch", "dinner", "snack"];

  return (
    <div>
      <h2>Daily Meal Plans</h2>
      <p className="muted" style={{ marginBottom: "24px" }}>
        Generate next-day AI meal suggestions customized for your dietary requirements. Edit, approve, or reject suggestions directly.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: "flex", gap: "16px", marginBottom: "30px" }}>
        <button onClick={handleGenerate} disabled={loading}>
          {loading ? "Generating Plan..." : "Generate Plan for Tomorrow"}
        </button>
      </div>

      <div className="grid grid-3">
        {/* Main Current Plan Area */}
        <div className="card card-accent" style={{ gridColumn: "span 2" }}>
          {currentPlan ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--border-accent)", paddingBottom: "16px", marginBottom: "20px" }}>
                <div>
                  <span style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)" }}>Target Date</span>
                  <h3 style={{ margin: 0 }}>{new Date(currentPlan.plan_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className={`badge ${currentPlan.status === "approved" ? "badge-success" : (currentPlan.status === "rejected" ? "badge-danger" : "badge-neutral")}`}>
                    {currentPlan.status}
                  </span>
                  <span style={{ fontFamily: "Space Grotesk", fontSize: "20px", fontWeight: 700 }}>
                    {Math.round(currentPlan.total_calories)} kcal
                  </span>
                </div>
              </div>

              {/* Meal Plan items grouped */}
              <div>
                {mealTypes.map((mType) => {
                  const items = groupedPlanItems[mType] || [];
                  if (items.length === 0 && !editing) return null;
                  return (
                    <div key={mType} className="meal-plan-section">
                      <h4 className="meal-plan-section-title">
                        <span>🍳</span> {mType}
                      </h4>
                      {items.map((item, idx) => (
                        <div key={item.id || idx} className="plan-item-card">
                          {editing ? (
                            <div className="grid grid-4" style={{ width: "100%", gap: "10px" }}>
                              <input
                                type="text"
                                value={item.food_name}
                                onChange={(e) => handleEditItem(currentPlan.items.indexOf(currentPlan.items.find(x => x.id === item.id)), "food_name", e.target.value)}
                              />
                              <input
                                type="number"
                                placeholder="Qty"
                                value={item.quantity}
                                onChange={(e) => handleEditItem(currentPlan.items.indexOf(currentPlan.items.find(x => x.id === item.id)), "quantity", e.target.value)}
                              />
                              <input
                                type="number"
                                placeholder="Kcal"
                                value={item.calories}
                                onChange={(e) => handleEditItem(currentPlan.items.indexOf(currentPlan.items.find(x => x.id === item.id)), "calories", e.target.value)}
                              />
                              <span className="muted" style={{ alignSelf: "center" }}>{item.unit}</span>
                            </div>
                          ) : (
                            <>
                              <div>
                                <span style={{ fontWeight: 700 }}>{item.food_name}</span>
                                <span className="muted" style={{ fontSize: "12px", marginLeft: "12px" }}>
                                  {item.quantity} {item.unit} ({item.preparation_method || "standard"})
                                </span>
                              </div>
                              <div style={{ fontWeight: 600 }}>{item.calories} kcal</div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {currentPlan.ai_rationale && !editing && (
                <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "var(--bg-panel-alt)", borderRadius: "var(--radius-sm)" }}>
                  <h4 style={{ marginBottom: "6px" }}>AI Rationale & Analysis:</h4>
                  <p className="muted" style={{ fontSize: "13px" }}>{currentPlan.ai_rationale}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "20px", marginTop: "24px", display: "flex", gap: "12px" }}>
                {editing ? (
                  <>
                    <button onClick={saveEdits}>Save Edits</button>
                    <button className="secondary" onClick={() => setEditing(false)}>Cancel</button>
                  </>
                ) : (
                  <>
                    {currentPlan.status === "draft" && (
                      <>
                        <button onClick={() => handleApprove(currentPlan.id)}>Approve Plan</button>
                        <button className="secondary" onClick={startEditing}>Edit Plan</button>
                        <button className="danger" onClick={() => handleReject(currentPlan.id)}>Reject Plan</button>
                      </>
                    )}
                    {currentPlan.status === "approved" && (
                      <div className="badge badge-success" style={{ padding: "8px 14px" }}>
                        ✓ Approved Plan
                      </div>
                    )}
                    {currentPlan.status === "rejected" && (
                      <div className="badge badge-danger" style={{ padding: "8px 14px" }}>
                        ✗ Rejected Plan
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: "40px 0", textAlign: "center" }} className="muted">
              No plan currently loaded. Generate tomorrow's meal suggestion using the button above.
            </div>
          )}
        </div>

        {/* Saved Approved History list */}
        <div className="card">
          <h3>Saved Plan History</h3>
          <p className="muted" style={{ marginBottom: "16px" }}>Previous daily plans generated by the assistant.</p>
          {plans.length === 0 ? (
            <div className="muted" style={{ fontSize: "13px" }}>No previous plans.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {plans.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: "12px 14px",
                    backgroundColor: currentPlan?.id === p.id ? "var(--bg-panel-alt)" : "white",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer"
                  }}
                  onClick={() => {
                    setCurrentPlan(p);
                    setEditing(false);
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                    <span>{new Date(p.plan_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    <span>{Math.round(p.total_calories)} kcal</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "11px" }}>
                    <span className="muted" style={{ textTransform: "capitalize" }}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { api } from "../api.js";

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    name: "User",
    calorie_target: 2000,
    dietary_preferences: [],
    allergies: [],
    foods_to_avoid: [],
  });
  
  const [prefInput, setPrefInput] = useState("");
  const [allergyInput, setAllergyInput] = useState("");
  const [avoidInput, setAvoidInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [nutritionSettings, setNutritionSettings] = useState({ goal: "maintenance", protein_target_g: 100, carbs_target_g: 250, fat_target_g: 65 });

  useEffect(() => {
    api.getProfile()
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to fetch profile settings.");
        setLoading(false);
      });
    api.getNutritionSettings().then((data) => setNutritionSettings(data)).catch(() => {});
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const [updated] = await Promise.all([api.updateProfile(profile), api.updateNutritionSettings(nutritionSettings)]);
      setProfile(updated);
      setMessage("Profile saved successfully!");
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError("Failed to save profile: " + err.message);
    }
  }

  async function exportData() {
    const data = await api.exportData();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    link.download = "nutrition-data.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function deleteData() {
    if (!window.confirm("Delete all meal plans, meal history, favorites, and wellness logs? This cannot be undone.")) return;
    await api.deletePersonalData();
    setMessage("Your nutrition records have been deleted. Your profile was kept.");
  }

  const addTag = (field, tag, setTagInput) => {
    if (!tag.trim()) return;
    const cleanTag = tag.trim().toLowerCase();
    if (!profile[field].includes(cleanTag)) {
      setProfile({
        ...profile,
        [field]: [...profile[field], cleanTag],
      });
    }
    setTagInput("");
  };

  const removeTag = (field, tag) => {
    setProfile({
      ...profile,
      [field]: profile[field].filter((t) => t !== tag),
    });
  };

  const autoCalculateMacros = () => {
    const cals = profile.calorie_target;
    let pPct, cPct, fPct;
    if (nutritionSettings.goal === "weight_loss") {
      pPct = 0.40; cPct = 0.35; fPct = 0.25;
    } else if (nutritionSettings.goal === "muscle_gain") {
      pPct = 0.35; cPct = 0.45; fPct = 0.20;
    } else { // maintenance
      pPct = 0.30; cPct = 0.40; fPct = 0.30;
    }
    
    setNutritionSettings(prev => ({
      ...prev,
      protein_target_g: Math.round((cals * pPct) / 4),
      carbs_target_g: Math.round((cals * cPct) / 4),
      fat_target_g: Math.round((cals * fPct) / 9)
    }));
  };

  if (loading) return <div className="muted">Loading profile settings...</div>;

  return (
    <div>
      <h2>My Nutrition Profile</h2>
      <p className="muted" style={{ marginBottom: "24px" }}>
        Customize your health targets, preferences, allergies, and foods to avoid. The AI assistant uses these details to parse meals and generate tomorrow's meal plans.
      </p>

      {message && <div className="badge badge-success" style={{ padding: "10px 16px", marginBottom: "20px", display: "block" }}>{message}</div>}
      {error && <div className="error-banner">{error}</div>}

      <form className="card card-accent" onSubmit={handleSave}>
        <div className="grid grid-2">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Calorie Intake Target (Kcal/day)</label>
            <input
              type="number"
              value={profile.calorie_target}
              onChange={(e) => setProfile({ ...profile, calorie_target: parseInt(e.target.value) || 0 })}
              min="500"
              max="10000"
              required
            />
          </div>
        </div>

        <div style={{ marginTop: "24px", padding: "20px", backgroundColor: "var(--bg-panel-alt)", borderRadius: "var(--radius-md)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Macro Goals</h3>
            <button type="button" className="btn secondary" onClick={autoCalculateMacros} style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
              ✨ Auto-calculate from Goal
            </button>
          </div>
          <div className="grid grid-2">
            <div className="form-group">
              <label>Goal</label>
              <select value={nutritionSettings.goal} onChange={(e) => setNutritionSettings({ ...nutritionSettings, goal: e.target.value })}>
                <option value="weight_loss">Weight loss (High Protein, Lower Carbs)</option>
                <option value="maintenance">Maintenance (Balanced)</option>
                <option value="muscle_gain">Muscle gain (High Carbs, Mod Protein)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Protein target (g/day)</label>
              <input type="number" value={nutritionSettings.protein_target_g} onChange={(e) => setNutritionSettings({ ...nutritionSettings, protein_target_g: Number(e.target.value) || 0 })} />
            </div>
            <div className="form-group">
              <label>Carbohydrate target (g/day)</label>
              <input type="number" value={nutritionSettings.carbs_target_g} onChange={(e) => setNutritionSettings({ ...nutritionSettings, carbs_target_g: Number(e.target.value) || 0 })} />
            </div>
            <div className="form-group">
              <label>Fat target (g/day)</label>
              <input type="number" value={nutritionSettings.fat_target_g} onChange={(e) => setNutritionSettings({ ...nutritionSettings, fat_target_g: Number(e.target.value) || 0 })} />
            </div>
          </div>
        </div>

        {/* Dietary Preferences Tag Box */}
        <div className="form-group">
          <label>Dietary Preferences (e.g. Vegetarian, Keto, Low-carb, Vegan)</label>
          <div className="tag-input-container">
            {profile.dietary_preferences.map((p) => (
              <span className="tag-chip" key={p}>
                {p}
                <button type="button" onClick={() => removeTag("dietary_preferences", p)}>✕</button>
              </span>
            ))}
            <input
              type="text"
              placeholder="Type preference & press Enter"
              value={prefInput}
              onChange={(e) => setPrefInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag("dietary_preferences", prefInput, setPrefInput);
                }
              }}
            />
          </div>
        </div>

        {/* Allergies Tag Box */}
        <div className="form-group">
          <label>Allergies (e.g. Peanuts, Gluten, Dairy, Shellfish)</label>
          <div className="tag-input-container">
            {profile.allergies.map((a) => (
              <span className="tag-chip" key={a} style={{ backgroundColor: "#F59E0B" }}>
                {a}
                <button type="button" onClick={() => removeTag("allergies", a)}>✕</button>
              </span>
            ))}
            <input
              type="text"
              placeholder="Type allergy & press Enter"
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag("allergies", allergyInput, setAllergyInput);
                }
              }}
            />
          </div>
        </div>

        {/* Foods to Avoid Tag Box */}
        <div className="form-group">
          <label>Foods to Avoid (e.g. Mushrooms, Butter, Sugar)</label>
          <div className="tag-input-container">
            {profile.foods_to_avoid.map((f) => (
              <span className="tag-chip" key={f} style={{ backgroundColor: "#EF4444" }}>
                {f}
                <button type="button" onClick={() => removeTag("foods_to_avoid", f)}>✕</button>
              </span>
            ))}
            <input
              type="text"
              placeholder="Type foods & press Enter"
              value={avoidInput}
              onChange={(e) => setAvoidInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag("foods_to_avoid", avoidInput, setAvoidInput);
                }
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: "24px" }}>
          <button type="submit">Save Settings</button>
        </div>
      </form>
      <section className="card" style={{ marginTop: "24px" }}><h3>Privacy & Data</h3><p className="muted">Your meal records are stored in this application database. Export a copy at any time or permanently clear your records.</p><div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}><button className="secondary" onClick={exportData}>Export My Data</button><button className="danger" onClick={deleteData}>Delete My Data</button></div></section>
    </div>
  );
}

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
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const updated = await api.updateProfile(profile);
      setProfile(updated);
      setMessage("Profile saved successfully!");
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError("Failed to save profile: " + err.message);
    }
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
    </div>
  );
}

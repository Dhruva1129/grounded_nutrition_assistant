import React, { useState, useEffect } from "react";
import { api } from "../api.js";

export default function KnowledgeBasePage() {
  const [kbItems, setKbItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadKB();
  }, [searchQuery]);

  async function loadKB() {
    setLoading(true);
    try {
      const data = await api.getKnowledgeBase(searchQuery);
      setKbItems(data);
      setLoading(false);
    } catch (err) {
      setError("Failed to load knowledge base items.");
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Seeded Nutrition Knowledge Base</h2>
      <p className="muted" style={{ marginBottom: "24px" }}>
        Browse and search verified food items. Every value logged by the AI is sourced directly from these certified USDA references to ensure absolute data integrity.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ padding: "16px", marginBottom: "24px" }}>
        <input
          type="text"
          placeholder="Search foods (e.g. rice, chicken, apple, milk)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading && kbItems.length === 0 ? (
        <div className="muted">Searching database...</div>
      ) : (
        <div>
          {kbItems.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "40px 0" }}>
              <p className="muted">No matches found for your search query.</p>
            </div>
          ) : (
            <div className="grid grid-3">
              {kbItems.map((item) => (
                <div className="card" key={item.id}>
                  <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>{item.food_name}</h3>
                  <div className="muted" style={{ fontSize: "12px", marginBottom: "12px" }}>
                    Standard Serving: <strong>{item.serving_size} {item.unit}</strong> | Prep: <strong>{item.preparation_method || "raw"}</strong>
                  </div>

                  <div className="grid grid-2" style={{ gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                    <div style={{ fontSize: "13px" }}>
                      <span className="muted">Calories:</span> <strong>{item.calories} kcal</strong>
                    </div>
                    <div style={{ fontSize: "13px" }}>
                      <span className="muted">Protein:</span> <strong>{item.protein_g}g</strong>
                    </div>
                    <div style={{ fontSize: "13px" }}>
                      <span className="muted">Carbs:</span> <strong>{item.carbs_g}g</strong>
                    </div>
                    <div style={{ fontSize: "13px" }}>
                      <span className="muted">Fats:</span> <strong>{item.fat_g}g</strong>
                    </div>
                  </div>

                  {item.source_citation && (
                    <div style={{ marginTop: "12px", borderTop: "1px dashed var(--border)", paddingTop: "8px" }}>
                      <span className="muted" style={{ fontSize: "10px", display: "block" }}>Source Citation:</span>
                      <span className="muted" style={{ fontSize: "10px", fontWeight: "bold" }}>{item.source_citation}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

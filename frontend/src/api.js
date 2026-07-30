const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch (_) {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Profile
  getProfile: () => request("/profile"),
  updateProfile: (profileData) =>
    request("/profile", { method: "POST", body: JSON.stringify(profileData) }),

  // Meals
  parseMeal: (rawText, mealType, date) =>
    request("/meals/parse", {
      method: "POST",
      body: JSON.stringify({ raw_text: rawText, meal_type: mealType, date }),
    }),
  answerClarification: (mealId, clarificationId, answerText) =>
    request(`/meals/${mealId}/clarify/${clarificationId}`, {
      method: "POST",
      body: JSON.stringify({ answer_text: answerText }),
    }),
  saveMeal: (mealId, items) =>
    request("/meals/save", {
      method: "POST",
      body: JSON.stringify({ meal_id: mealId, items }),
    }),
  getDailySummary: (dateStr) =>
    request(`/meals/daily-summary?date=${dateStr || ""}`),
  getMealHistory: () => request("/meals/history"),
  getInsights: () => request("/meals/insights"),
  askNutritionQuestion: (question) =>
    request("/meals/insights/chat", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),

  // Meal Plans
  generateMealPlan: (planDate) =>
    request("/meal-plans/generate", {
      method: "POST",
      body: JSON.stringify({ plan_date: planDate }),
    }),
  approveMealPlan: (planId) =>
    request(`/meal-plans/${planId}/approve`, { method: "POST" }),
  rejectMealPlan: (planId) =>
    request(`/meal-plans/${planId}/reject`, { method: "POST" }),
  editMealPlan: (planId, items) =>
    request(`/meal-plans/${planId}`, {
      method: "PATCH",
      body: JSON.stringify({ items }),
    }),
  getMealPlans: () => request("/meal-plans"),
  getMealPlan: (planId) => request(`/meal-plans/${planId}`),

  // Knowledge Base
  getKnowledgeBase: (query) =>
    request(`/knowledge-base?q=${encodeURIComponent(query || "")}`),
  getKBItem: (id) => request(`/knowledge-base/${id}`),

  // Disclaimer
  getDisclaimer: () => request("/disclaimer"),

  // Goals, trends, activity, favorites and privacy
  getNutritionSettings: () => request("/wellness/settings"),
  updateNutritionSettings: (data) => request("/wellness/settings", { method: "PUT", body: JSON.stringify(data) }),
  getDailyWellness: () => request("/wellness/daily"),
  saveDailyWellness: (data) => request("/wellness/daily", { method: "PUT", body: JSON.stringify(data) }),
  getWeeklyTrends: () => request("/wellness/trends"),
  getFavorites: () => request("/favorites"),
  createFavorite: (data) => request("/favorites", { method: "POST", body: JSON.stringify(data) }),
  deleteFavorite: (id) => request(`/favorites/${id}`, { method: "DELETE" }),
  exportData: () => request("/privacy/export"),
  deletePersonalData: () => request("/privacy/data", { method: "DELETE" }),
  getGroceryList: (planId) => request(`/meal-plans/${planId}/grocery-list`),
};

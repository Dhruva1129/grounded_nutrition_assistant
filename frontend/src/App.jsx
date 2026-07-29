import React from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage.jsx";
import LogMealPage from "./pages/LogMealPage.jsx";
import MealHistoryPage from "./pages/MealHistoryPage.jsx";
import MealPlanPage from "./pages/MealPlanPage.jsx";
import KnowledgeBasePage from "./pages/KnowledgeBasePage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import InsightsPage from "./pages/InsightsPage.jsx";
import DisclaimerBanner from "./components/DisclaimerBanner.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <nav className="sidebar">
        <h1>Grounded Nutrition</h1>
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
          Dashboard
        </NavLink>
        <NavLink to="/log" className={({ isActive }) => (isActive ? "active" : "")}>
          Log a Meal
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => (isActive ? "active" : "")}>
          Meal History
        </NavLink>
        <NavLink to="/plan" className={({ isActive }) => (isActive ? "active" : "")}>
          Daily Meal Plans
        </NavLink>
        <NavLink to="/insights" className={({ isActive }) => (isActive ? "active" : "")}>
          AI insights
        </NavLink>
        <NavLink to="/knowledge" className={({ isActive }) => (isActive ? "active" : "")}>
          Knowledge Base
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? "active" : "")}>
          My Profile
        </NavLink>
      </nav>
      
      <main className="main-content fade-in">
        <DisclaimerBanner />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/log" element={<LogMealPage />} />
          <Route path="/history" element={<MealHistoryPage />} />
          <Route path="/plan" element={<MealPlanPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/knowledge" element={<KnowledgeBasePage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </main>
    </div>
  );
}

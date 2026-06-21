import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import FormulaList from "./pages/FormulaList";
import FormulaNew from "./pages/FormulaNew";
import FormulaDetail from "./pages/FormulaDetail";
import AIRecommend from "./pages/AIRecommend";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="app-header">
          <span className="app-logo">⚗️ Chemical Dev</span>
          <nav className="app-nav">
            <NavLink to="/recommend" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              AI 처방 추천
            </NavLink>
            <NavLink to="/formulas" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              처방전 목록
            </NavLink>
          </nav>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/recommend" replace />} />
            <Route path="/recommend" element={<AIRecommend />} />
            <Route path="/formulas" element={<FormulaList />} />
            <Route path="/formulas/new" element={<FormulaNew />} />
            <Route path="/formulas/:id" element={<FormulaDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

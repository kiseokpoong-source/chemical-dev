import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import type { Formula } from "../api/types";

export default function FormulaList() {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Formula[]>("/formulas")
      .then((r) => setFormulas(r.data))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 처방전을 삭제할까요?`)) return;
    await api.delete(`/formulas/${id}`);
    setFormulas((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>처방전 목록</h2>
        <Link to="/formulas/new" className="btn-primary">+ 새 처방전</Link>
      </div>

      {loading && <p>불러오는 중...</p>}

      {!loading && formulas.length === 0 && (
        <div className="empty-state">
          <p>등록된 처방전이 없습니다.</p>
          <Link to="/formulas/new" className="btn-primary">첫 처방전 만들기</Link>
        </div>
      )}

      <div className="formula-grid">
        {formulas.map((f) => (
          <div key={f.id} className="formula-card">
            <div className="formula-card-header">
              <span className="badge">{f.category || "기타"}</span>
              <div className="formula-card-actions">
                <Link to={`/formulas/${f.id}`} className="btn-small">편집</Link>
                <button onClick={() => handleDelete(f.id, f.name)} className="btn-danger-small">삭제</button>
              </div>
            </div>
            <Link to={`/formulas/${f.id}`} className="formula-card-title">{f.name}</Link>
            <p className="formula-card-purpose">{f.purpose || "—"}</p>
            <div className="formula-card-footer">
              원료 {f.ingredients.length}종 · {new Date(f.created_at).toLocaleDateString("ko-KR")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

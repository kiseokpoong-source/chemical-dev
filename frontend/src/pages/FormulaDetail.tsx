import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import type { Formula, FormulaCreate } from "../api/types";
import FormulaForm from "../components/FormulaForm";
import AIPanel from "../components/AIPanel";

export default function FormulaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formula, setFormula] = useState<Formula | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Formula>(`/formulas/${id}`)
      .then((r) => setFormula(r.data))
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleSubmit = async (data: FormulaCreate) => {
    setSaving(true);
    try {
      const res = await api.put<Formula>(`/formulas/${id}`, data);
      setFormula(res.data);
      alert("저장되었습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page"><p>불러오는 중...</p></div>;
  if (!formula) return null;

  return (
    <div className="page">
      <div className="page-header">
        <h2>{formula.name}</h2>
        <button onClick={() => navigate("/")} className="btn-small">← 목록</button>
      </div>

      <div className="detail-layout">
        <section className="detail-form">
          <h3>처방 정보</h3>
          <FormulaForm initial={formula} onSubmit={handleSubmit} loading={saving} />
        </section>

        <section className="detail-ai">
          <AIPanel formulaId={formula.id} />
        </section>
      </div>
    </div>
  );
}

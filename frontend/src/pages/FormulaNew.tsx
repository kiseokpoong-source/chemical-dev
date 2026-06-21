import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import type { FormulaCreate } from "../api/types";
import FormulaForm from "../components/FormulaForm";

export default function FormulaNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: FormulaCreate) => {
    setLoading(true);
    try {
      const res = await api.post("/formulas", data);
      navigate(`/formulas/${res.data.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h2>새 처방전</h2>
      <FormulaForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}

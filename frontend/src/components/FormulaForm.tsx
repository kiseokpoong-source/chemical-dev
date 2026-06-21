import { useState } from "react";
import type { FormulaCreate, Ingredient } from "../api/types";

interface Props {
  initial?: Partial<FormulaCreate>;
  onSubmit: (data: FormulaCreate) => void;
  loading?: boolean;
}

const emptyIngredient = (): Ingredient => ({ name: "", percentage: 0, role: "" });

export default function FormulaForm({ initial = {}, onSubmit, loading }: Props) {
  const [name, setName] = useState(initial.name ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [purpose, setPurpose] = useState(initial.purpose ?? "");
  const [phTarget, setPhTarget] = useState(initial.ph_target ?? "");
  const [viscosityTarget, setViscosityTarget] = useState(initial.viscosity_target ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initial.ingredients?.length ? initial.ingredients : [emptyIngredient()]
  );

  const updateIngredient = (i: number, field: keyof Ingredient, value: string | number) => {
    setIngredients((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, [field]: value } : ing)));
  };

  const addIngredient = () => setIngredients((prev) => [...prev, emptyIngredient()]);
  const removeIngredient = (i: number) => setIngredients((prev) => prev.filter((_, idx) => idx !== i));

  const totalPct = ingredients.reduce((sum, i) => sum + Number(i.percentage), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      category,
      purpose,
      ph_target: phTarget,
      viscosity_target: viscosityTarget,
      notes,
      total_weight: 100,
      ingredients,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="form-row">
        <label>처방전 이름 *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="예) 금속 탈지 세정제 v1" />
      </div>

      <div className="form-row">
        <label>카테고리</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">선택</option>
          <option value="세정제">세정제</option>
          <option value="코팅제">코팅제</option>
          <option value="제거제">제거제</option>
          <option value="방청제">방청제</option>
          <option value="기타">기타</option>
        </select>
      </div>

      <div className="form-row">
        <label>개발 목적</label>
        <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} placeholder="예) 금속 표면의 유류 오염 제거용" />
      </div>

      <div className="form-row">
        <label>pH 목표</label>
        <input value={phTarget} onChange={(e) => setPhTarget(e.target.value)} placeholder="예) 7.0~8.0" />
      </div>

      <div className="form-row">
        <label>점도 목표</label>
        <input value={viscosityTarget} onChange={(e) => setViscosityTarget(e.target.value)} placeholder="예) 500~800 cPs" />
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label>원료 구성 <span style={{ color: totalPct === 100 ? "green" : "orange" }}>({totalPct.toFixed(1)}%)</span></label>
          <button type="button" onClick={addIngredient} className="btn-small">+ 원료 추가</button>
        </div>
        <table className="ingredient-table">
          <thead>
            <tr><th>원료명</th><th>함량(%)</th><th>역할</th><th></th></tr>
          </thead>
          <tbody>
            {ingredients.map((ing, i) => (
              <tr key={i}>
                <td><input value={ing.name} onChange={(e) => updateIngredient(i, "name", e.target.value)} placeholder="예) LAS" /></td>
                <td><input type="number" value={ing.percentage} onChange={(e) => updateIngredient(i, "percentage", parseFloat(e.target.value) || 0)} step="0.1" min="0" max="100" /></td>
                <td><input value={ing.role ?? ""} onChange={(e) => updateIngredient(i, "role", e.target.value)} placeholder="예) 계면활성제" /></td>
                <td><button type="button" onClick={() => removeIngredient(i)} className="btn-danger-small">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="form-row">
        <label>메모</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}

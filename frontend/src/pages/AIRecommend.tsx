import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import type { RecommendRequest, RecommendResult, RecommendResponse } from "../api/types";

const CATEGORIES = ["세정제", "코팅제", "제거제", "방청제", "기타"];

const PROVIDER_COLOR: Record<string, string> = {
  claude: "#d97706",
  openai: "#16a34a",
  gemini: "#2563eb",
};
const PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude",
  openai: "GPT-4o",
  gemini: "Gemini",
};

export default function AIRecommend() {
  const navigate = useNavigate();

  const [form, setForm] = useState<RecommendRequest>({
    product_name: "",
    category: "세정제",
    cost_target: "",
    volume_ml: undefined,
    requirements: "",
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RecommendResult[]>([]);
  const [error, setError] = useState("");
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  const set = (field: keyof RecommendRequest, value: string | number | undefined) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleRecommend = async () => {
    if (!form.product_name.trim() || !form.requirements.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const { data } = await api.post<RecommendResponse>("/ai/recommend", form);
      setResults(data.results);
    } catch {
      setError("AI 호출 실패. 백엔드 서버와 API 키를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (r: RecommendResult, idx: number) => {
    setSavingIdx(idx);
    try {
      const payload = {
        name: `${form.product_name} (${PROVIDER_LABEL[r.provider]})`,
        category: form.category,
        purpose: form.requirements,
        ingredients: r.ingredients,
        total_weight: 100,
        ph_target: r.ph_target,
        viscosity_target: r.viscosity_target,
        notes: `[공정] ${r.process_notes}\n\n[추천 이유] ${r.rationale}`,
      };
      const res = await api.post("/formulas", payload);
      navigate(`/formulas/${res.data.id}`);
    } finally {
      setSavingIdx(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>AI 처방 추천</h2>
      </div>

      <div className="recommend-form-card">
        <div className="recommend-form-grid">
          <div className="form-row">
            <label>제품명 *</label>
            <input
              value={form.product_name}
              onChange={(e) => set("product_name", e.target.value)}
              placeholder="예) 유리발수코팅제"
            />
          </div>

          <div className="form-row">
            <label>카테고리</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-row">
            <label>목표 원가 (원)</label>
            <input
              value={form.cost_target ?? ""}
              onChange={(e) => set("cost_target", e.target.value)}
              placeholder="예) 500"
            />
          </div>

          <div className="form-row">
            <label>용량 (ml)</label>
            <input
              type="number"
              value={form.volume_ml ?? ""}
              onChange={(e) => set("volume_ml", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="예) 100"
            />
          </div>
        </div>

        <div className="form-row" style={{ marginTop: 12 }}>
          <label>요구사항 / USP *</label>
          <textarea
            value={form.requirements}
            onChange={(e) => set("requirements", e.target.value)}
            rows={4}
            placeholder={"예) 자동차 유리에 발수 코팅 효과, 3개월 이상 지속, 바르기 쉬운 점도,\n친환경 성분 우선, 냄새 최소화, pH 중성"}
          />
        </div>

        <button
          onClick={handleRecommend}
          disabled={loading || !form.product_name.trim() || !form.requirements.trim()}
          className="btn-primary"
          style={{ marginTop: 16, width: "100%", padding: "12px" }}
        >
          {loading ? "Claude · GPT-4o · Gemini 처방 설계 중..." : "⚗️  AI에게 처방 추천받기"}
        </button>

        {error && <p style={{ color: "red", marginTop: 8 }}>{error}</p>}
      </div>

      {results.length > 0 && (
        <div className="recommend-results">
          {results.map((r, idx) => (
            <div key={r.provider} className="recommend-card">
              <div className="recommend-card-header" style={{ borderColor: PROVIDER_COLOR[r.provider] }}>
                <span style={{ color: PROVIDER_COLOR[r.provider], fontWeight: 700, fontSize: 16 }}>
                  {PROVIDER_LABEL[r.provider]}
                </span>
                <span className="compare-meta">{r.model} · {r.tokens_used} tokens</span>
              </div>

              {r.error ? (
                <p style={{ color: "red", padding: "12px 0" }}>오류: {r.error}</p>
              ) : (
                <>
                  <table className="ingredient-table" style={{ marginTop: 12 }}>
                    <thead>
                      <tr><th>원료명</th><th>함량(%)</th><th>역할</th></tr>
                    </thead>
                    <tbody>
                      {r.ingredients.map((ing, i) => (
                        <tr key={i}>
                          <td style={{ padding: "4px 6px" }}>{ing.name}</td>
                          <td style={{ padding: "4px 6px", textAlign: "right" }}>{ing.percentage}%</td>
                          <td style={{ padding: "4px 6px", color: "#6b7280" }}>{ing.role}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: "2px solid #e5e7eb", fontWeight: 700 }}>
                        <td style={{ padding: "4px 6px" }}>합계</td>
                        <td style={{ padding: "4px 6px", textAlign: "right" }}>
                          {r.ingredients.reduce((s, i) => s + i.percentage, 0).toFixed(1)}%
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="recommend-meta-grid">
                    <div><span className="meta-label">pH 목표</span><span>{r.ph_target || "—"}</span></div>
                    <div><span className="meta-label">점도 목표</span><span>{r.viscosity_target || "—"}</span></div>
                  </div>

                  {r.process_notes && (
                    <div className="recommend-section">
                      <div className="meta-label">제조 공정</div>
                      <p>{r.process_notes}</p>
                    </div>
                  )}

                  {r.rationale && (
                    <div className="recommend-section">
                      <div className="meta-label">추천 이유</div>
                      <p>{r.rationale}</p>
                    </div>
                  )}

                  <button
                    onClick={() => handleSave(r, idx)}
                    disabled={savingIdx !== null}
                    className="btn-primary"
                    style={{ marginTop: 16, width: "100%" }}
                  >
                    {savingIdx === idx ? "저장 중..." : "이 처방으로 저장 →"}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

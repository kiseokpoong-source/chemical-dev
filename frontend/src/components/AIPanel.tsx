import { useState } from "react";
import api from "../api/client";

interface Props {
  formulaId?: number;
}

interface ProviderResult {
  provider: string;
  model: string;
  response: string;
  tokens_used: number;
  error?: string;
}

const QUERY_TYPES = [
  { value: "recommend", label: "처방 추천" },
  { value: "analyze", label: "처방 분석" },
  { value: "improve", label: "개선 방안" },
];

const PROVIDER_COLORS: Record<string, string> = {
  claude: "#d97706",
  openai: "#16a34a",
  gemini: "#2563eb",
};

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude",
  openai: "GPT-4o",
  gemini: "Gemini",
};

export default function AIPanel({ formulaId }: Props) {
  const [queryType, setQueryType] = useState("recommend");
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCompare = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const { data } = await api.post<{ results: ProviderResult[] }>("/ai/compare", {
        query_type: queryType,
        user_prompt: prompt,
        formula_id: formulaId,
      });
      setResults(data.results);
    } catch {
      setError("AI 호출 실패. 백엔드 서버와 API 키를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-panel">
      <h3>AI 3종 비교 추천</h3>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select value={queryType} onChange={(e) => setQueryType(e.target.value)} style={{ flex: "0 0 auto" }}>
          {QUERY_TYPES.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
        </select>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder={"예) 금속 표면의 유류 오염을 제거하는 중성 세정제를 추천해주세요.\npH 7~8, 점도 낮음, 수용성 필요."}
        style={{ width: "100%", boxSizing: "border-box" }}
      />

      <button
        onClick={handleCompare}
        disabled={loading || !prompt.trim()}
        className="btn-primary"
        style={{ marginTop: 8, width: "100%" }}
      >
        {loading ? "Claude · GPT-4o · Gemini 분석 중..." : "⚗️  3개 AI 동시 추천받기"}
      </button>

      {error && <p style={{ color: "red", marginTop: 8 }}>{error}</p>}

      {results.length > 0 && (
        <div className="compare-grid">
          {results.map((r) => (
            <div key={r.provider} className="compare-card">
              <div
                className="compare-card-header"
                style={{ borderColor: PROVIDER_COLORS[r.provider] }}
              >
                <span style={{ color: PROVIDER_COLORS[r.provider], fontWeight: 700 }}>
                  {PROVIDER_LABELS[r.provider]}
                </span>
                <span className="compare-meta">{r.model} · {r.tokens_used} tokens</span>
              </div>
              {r.error ? (
                <p style={{ color: "red", fontSize: 13 }}>오류: {r.error}</p>
              ) : (
                <pre className="ai-result-body">{r.response}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

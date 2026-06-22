from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
import os
from dotenv import load_dotenv

from database import Formula, AIAnalysis, get_db, init_db

load_dotenv()

app = FastAPI(title="Chemical Dev API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# --- Pydantic Schemas ---

class IngredientItem(BaseModel):
    name: str
    percentage: float
    role: Optional[str] = None


class FormulaCreate(BaseModel):
    name: str
    category: Optional[str] = None
    purpose: Optional[str] = None
    ingredients: Optional[List[IngredientItem]] = []
    total_weight: Optional[float] = 100.0
    ph_target: Optional[str] = None
    viscosity_target: Optional[str] = None
    notes: Optional[str] = None


class FormulaOut(FormulaCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AIRequest(BaseModel):
    query_type: str                    # recommend / analyze / improve
    user_prompt: str
    ai_provider: str                   # openai / gemini / claude
    formula_id: Optional[int] = None


class AIResponse(BaseModel):
    id: int
    response: str
    ai_provider: str
    ai_model: str
    tokens_used: int
    created_at: datetime

    class Config:
        from_attributes = True


# --- Formula CRUD ---

@app.get("/formulas", response_model=List[FormulaOut])
def list_formulas(db: Session = Depends(get_db)):
    return db.query(Formula).order_by(Formula.created_at.desc()).all()


@app.get("/formulas/{formula_id}", response_model=FormulaOut)
def get_formula(formula_id: int, db: Session = Depends(get_db)):
    formula = db.query(Formula).filter(Formula.id == formula_id).first()
    if not formula:
        raise HTTPException(status_code=404, detail="처방전을 찾을 수 없습니다.")
    return formula


@app.post("/formulas", response_model=FormulaOut)
def create_formula(data: FormulaCreate, db: Session = Depends(get_db)):
    formula = Formula(
        **data.model_dump(exclude={"ingredients"}),
        ingredients=[i.model_dump() for i in (data.ingredients or [])],
    )
    db.add(formula)
    db.commit()
    db.refresh(formula)
    return formula


@app.put("/formulas/{formula_id}", response_model=FormulaOut)
def update_formula(formula_id: int, data: FormulaCreate, db: Session = Depends(get_db)):
    formula = db.query(Formula).filter(Formula.id == formula_id).first()
    if not formula:
        raise HTTPException(status_code=404, detail="처방전을 찾을 수 없습니다.")
    for field, value in data.model_dump(exclude={"ingredients"}).items():
        setattr(formula, field, value)
    formula.ingredients = [i.model_dump() for i in (data.ingredients or [])]
    formula.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(formula)
    return formula


@app.delete("/formulas/{formula_id}")
def delete_formula(formula_id: int, db: Session = Depends(get_db)):
    formula = db.query(Formula).filter(Formula.id == formula_id).first()
    if not formula:
        raise HTTPException(status_code=404, detail="처방전을 찾을 수 없습니다.")
    db.delete(formula)
    db.commit()
    return {"message": "삭제 완료"}


# --- AI Analysis ---

def _call_openai(prompt: str) -> tuple[str, str, int]:
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    model = "gpt-4o"
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "당신은 화학 처방 전문가입니다. 세정제, 코팅제, 제거제 등 산업용 화학 제품 처방 개발을 도와주세요."},
            {"role": "user", "content": prompt},
        ],
    )
    text = resp.choices[0].message.content or ""
    tokens = resp.usage.total_tokens if resp.usage else 0
    return text, model, tokens


def _call_gemini(prompt: str) -> tuple[str, str, int]:
    from google import genai
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    model_name = "gemini-2.5-flash"
    system = "당신은 화학 처방 전문가입니다. 세정제, 코팅제, 제거제 등 산업용 화학 제품 처방 개발을 도와주세요."
    from google.genai import types as gtypes
    resp = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=gtypes.GenerateContentConfig(system_instruction=system),
    )
    text = resp.text or ""
    tokens = resp.usage_metadata.total_token_count if resp.usage_metadata else 0
    return text, model_name, tokens


def _call_claude(prompt: str) -> tuple[str, str, int]:
    import anthropic
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    model_name = "claude-sonnet-4-6"
    resp = client.messages.create(
        model=model_name,
        max_tokens=2048,
        system="당신은 화학 처방 전문가입니다. 세정제, 코팅제, 제거제 등 산업용 화학 제품 처방 개발을 도와주세요.",
        messages=[{"role": "user", "content": prompt}],
    )
    text = resp.content[0].text if resp.content else ""
    tokens = resp.usage.input_tokens + resp.usage.output_tokens
    return text, model_name, tokens


@app.post("/ai/analyze", response_model=AIResponse)
def ai_analyze(req: AIRequest, db: Session = Depends(get_db)):
    formula_context = ""
    if req.formula_id:
        formula = db.query(Formula).filter(Formula.id == req.formula_id).first()
        if formula:
            formula_context = f"\n\n[처방전 정보]\n이름: {formula.name}\n카테고리: {formula.category}\n목적: {formula.purpose}\n원료: {formula.ingredients}\npH 목표: {formula.ph_target}\n점도 목표: {formula.viscosity_target}\n"

    full_prompt = formula_context + req.user_prompt

    provider = req.ai_provider.lower()
    try:
        if provider == "openai":
            text, model_name, tokens = _call_openai(full_prompt)
        elif provider == "gemini":
            text, model_name, tokens = _call_gemini(full_prompt)
        elif provider == "claude":
            text, model_name, tokens = _call_claude(full_prompt)
        else:
            raise HTTPException(status_code=400, detail=f"지원하지 않는 AI 프로바이더: {provider}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 호출 오류: {str(e)}")

    record = AIAnalysis(
        formula_id=req.formula_id,
        query_type=req.query_type,
        user_prompt=req.user_prompt,
        ai_provider=provider,
        ai_model=model_name,
        response=text,
        tokens_used=tokens,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get("/ai/history", response_model=List[AIResponse])
def ai_history(formula_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(AIAnalysis).order_by(AIAnalysis.created_at.desc())
    if formula_id:
        q = q.filter(AIAnalysis.formula_id == formula_id)
    return q.limit(50).all()


# --- AI 처방 추천 (요구사항 → 처방) ---

RECOMMEND_SYSTEM = """당신은 산업용 화학 처방 전문가입니다.
사용자의 제품 요구사항을 분석하여 최적의 화학 처방을 설계해주세요.
반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만 출력하세요.

{
  "ingredients": [
    {"name": "원료명", "percentage": 숫자, "role": "역할"},
    ...
  ],
  "ph_target": "pH 범위 (예: 6.5~7.5)",
  "viscosity_target": "점도 (예: 500~800 cPs)",
  "process_notes": "제조 공정 요약",
  "rationale": "이 처방을 추천하는 이유 (원가, 성능, 안전성 관점)"
}"""


class RecommendRequest(BaseModel):
    product_name: str
    category: str
    cost_target: Optional[str] = None
    volume_ml: Optional[float] = None
    requirements: str


class AIIngredient(BaseModel):
    name: str
    percentage: float
    role: Optional[str] = None


class RecommendResult(BaseModel):
    provider: str
    model: str
    ingredients: List[AIIngredient]
    ph_target: str
    viscosity_target: str
    process_notes: str
    rationale: str
    tokens_used: int
    error: Optional[str] = None


class RecommendResponse(BaseModel):
    results: List[RecommendResult]


def _build_recommend_prompt(req: RecommendRequest) -> str:
    lines = [
        f"제품명: {req.product_name}",
        f"카테고리: {req.category}",
    ]
    if req.cost_target:
        lines.append(f"목표 원가: {req.cost_target}원 / {req.volume_ml or ''}ml")
    lines.append(f"요구사항/USP: {req.requirements}")
    return "\n".join(lines)


def _parse_recommend_response(text: str, provider: str, model: str, tokens: int) -> RecommendResult:
    import json, re
    cleaned = re.sub(r"```(?:json)?|```", "", text).strip()
    try:
        data = json.loads(cleaned)
        ingredients = [AIIngredient(**i) for i in data.get("ingredients", [])]
        return RecommendResult(
            provider=provider,
            model=model,
            ingredients=ingredients,
            ph_target=data.get("ph_target", ""),
            viscosity_target=data.get("viscosity_target", ""),
            process_notes=data.get("process_notes", ""),
            rationale=data.get("rationale", ""),
            tokens_used=tokens,
        )
    except Exception as e:
        return RecommendResult(
            provider=provider, model=model,
            ingredients=[], ph_target="", viscosity_target="",
            process_notes="", rationale=text,
            tokens_used=tokens, error=f"JSON 파싱 실패: {e}",
        )


def _call_recommend(provider: str, prompt: str) -> RecommendResult:
    try:
        if provider == "claude":
            import anthropic
            client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            model_name = "claude-sonnet-4-6"
            resp = client.messages.create(
                model=model_name, max_tokens=2048,
                system=RECOMMEND_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text if resp.content else ""
            tokens = resp.usage.input_tokens + resp.usage.output_tokens

        elif provider == "openai":
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            model_name = "gpt-4o"
            resp = client.chat.completions.create(
                model=model_name,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": RECOMMEND_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
            )
            text = resp.choices[0].message.content or ""
            tokens = resp.usage.total_tokens if resp.usage else 0

        elif provider == "gemini":
            from google import genai as ggenai
            from google.genai import types as gtypes
            gclient = ggenai.Client(api_key=os.getenv("GEMINI_API_KEY"))
            model_name = "gemini-2.5-flash"
            resp = gclient.models.generate_content(
                model=model_name,
                contents=prompt,
                config=gtypes.GenerateContentConfig(system_instruction=RECOMMEND_SYSTEM),
            )
            text = resp.text or ""
            tokens = resp.usage_metadata.total_token_count if resp.usage_metadata else 0
        else:
            return RecommendResult(
                provider=provider, model="", ingredients=[], ph_target="",
                viscosity_target="", process_notes="", rationale="",
                tokens_used=0, error="지원하지 않는 프로바이더",
            )

        return _parse_recommend_response(text, provider, model_name, tokens)

    except Exception as e:
        return RecommendResult(
            provider=provider, model="", ingredients=[], ph_target="",
            viscosity_target="", process_notes="", rationale="",
            tokens_used=0, error=str(e),
        )


@app.post("/ai/recommend", response_model=RecommendResponse)
def ai_recommend(req: RecommendRequest):
    prompt = _build_recommend_prompt(req)
    providers = ["claude", "openai", "gemini"]
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {p: executor.submit(_call_recommend, p, prompt) for p in providers}
        results = [futures[p].result() for p in providers]
    return RecommendResponse(results=results)


class CompareRequest(BaseModel):
    query_type: str
    user_prompt: str
    formula_id: Optional[int] = None


class ProviderResult(BaseModel):
    provider: str
    model: str
    response: str
    tokens_used: int
    error: Optional[str] = None


class CompareResponse(BaseModel):
    results: List[ProviderResult]


@app.post("/ai/compare", response_model=CompareResponse)
def ai_compare(req: CompareRequest, db: Session = Depends(get_db)):
    formula_context = ""
    if req.formula_id:
        formula = db.query(Formula).filter(Formula.id == req.formula_id).first()
        if formula:
            formula_context = f"\n\n[처방전 정보]\n이름: {formula.name}\n카테고리: {formula.category}\n목적: {formula.purpose}\n원료: {formula.ingredients}\npH 목표: {formula.ph_target}\n점도 목표: {formula.viscosity_target}\n"

    full_prompt = formula_context + req.user_prompt

    callers = {
        "claude": _call_claude,
        "openai": _call_openai,
        "gemini": _call_gemini,
    }

    def call_one(provider: str):
        try:
            text, model_name, tokens = callers[provider](full_prompt)
            record = AIAnalysis(
                formula_id=req.formula_id,
                query_type=req.query_type,
                user_prompt=req.user_prompt,
                ai_provider=provider,
                ai_model=model_name,
                response=text,
                tokens_used=tokens,
            )
            db.add(record)
            return ProviderResult(provider=provider, model=model_name, response=text, tokens_used=tokens)
        except Exception as e:
            return ProviderResult(provider=provider, model="", response="", tokens_used=0, error=str(e))

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {provider: executor.submit(call_one, provider) for provider in callers}
        results = [futures[p].result() for p in ["claude", "openai", "gemini"]]

    db.commit()
    return CompareResponse(results=results)

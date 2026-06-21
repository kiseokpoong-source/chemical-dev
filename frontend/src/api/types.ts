export interface Ingredient {
  name: string;
  percentage: number;
  role?: string;
}

export interface Formula {
  id: number;
  name: string;
  category?: string;
  purpose?: string;
  ingredients: Ingredient[];
  total_weight: number;
  ph_target?: string;
  viscosity_target?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type FormulaCreate = Omit<Formula, "id" | "created_at" | "updated_at">;

export interface AIAnalysis {
  id: number;
  response: string;
  ai_provider: string;
  ai_model: string;
  tokens_used: number;
  created_at: string;
}

export interface AIRequest {
  query_type: string;
  user_prompt: string;
  ai_provider: string;
  formula_id?: number;
}

export interface RecommendRequest {
  product_name: string;
  category: string;
  cost_target?: string;
  volume_ml?: number;
  requirements: string;
}

export interface RecommendResult {
  provider: string;
  model: string;
  ingredients: Ingredient[];
  ph_target: string;
  viscosity_target: string;
  process_notes: string;
  rationale: string;
  tokens_used: number;
  error?: string;
}

export interface RecommendResponse {
  results: RecommendResult[];
}

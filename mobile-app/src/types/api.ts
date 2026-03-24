export type RiskLevel = "OK" | "RISKY" | "CRITICAL";
export type DecisionSource = "rules_only" | "hybrid";

export type FieldLayoutPosition = "top" | "right" | "bottom" | "left";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  province: string;
  district: string;
  village: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  username: string;
  province: string;
  district: string;
  village: string;
}

export interface UserSummary {
  username: string;
  province: string;
  district: string;
  village: string;
}

export interface UsersResponse {
  users: UserSummary[];
}

export interface ParcelItem {
  parcel_id: string;
  field_block: "A" | "B";
  planned_crop: string;
}

export interface ParcelListResponse {
  village_id: string;
  parcels: ParcelItem[];
}

export interface FieldLayoutResponse {
  village_id: string;
  field_layout_position: FieldLayoutPosition;
  valid_positions: FieldLayoutPosition[];
  message?: string;
}

export interface NeighborItem {
  parcel_id: string;
  adjacency_type: "INTRA_BLOCK" | "INTER_BLOCK";
}

export interface NeighborsResponse {
  parcel_id: string;
  season: string;
  layout_position: FieldLayoutPosition;
  neighbors: {
    intra_block: NeighborItem[];
    inter_block: NeighborItem[];
  };
}

export interface ScoreRequest {
  village_id: string;
  season: string;
  parcel_id: string;
  ml_score?: number;
  ml_confidence?: number;
  crop_overrides?: Record<string, CropKey>;
}

export interface DecisionResponse {
  parcel_id: string;
  season: string;
  risk_score: number;
  risk_level: RiskLevel;
  reason_codes: string[];
  confidence: number | null;
  model_version: string;
  decision_source: DecisionSource;
}

export type CropKey = "corn" | "sunflower" | "wheat" | "barley";
export type PlanType = "balanced" | "low_risk" | "yield_balance";
export type HarvestStatus = "planned" | "active" | "done";

export interface ScenarioRecommendRequest {
  village_id: string;
  season: string;
}

export interface ScenarioPlanParcel {
  parcel_id: string;
  crop: CropKey;
  risk_score: number;
  risk_level: RiskLevel;
  explanation: string[];
}

export interface ScenarioPlan {
  id: string;
  plan_type: PlanType;
  title: string;
  badge: string;
  summary: string;
  emphasis: string;
  balanced_count: number;
  risky_count: number;
  critical_count: number;
  optimizer_score: number;
  final_score: number;
  final_rank: number;
  reason_list: string[];
  selections: ScenarioPlanParcel[];
  rules_passed: boolean;
  rules_warnings: string[];
  llm_explanation: string;
  what_if: string[];
}

export interface ScenarioRecommendResponse {
  village_id: string;
  season: string;
  graph_node_count: number;
  graph_edge_count: number;
  plans: ScenarioPlan[];
}

export interface ScenarioCreateParcel {
  parcel_id: string;
  crop: CropKey;
}

export interface ScenarioCreateRequest {
  name: string;
  village_id: string;
  season: string;
  plan_type?: string;
  parcels: ScenarioCreateParcel[];
}

export interface ScenarioItem {
  id: string;
  name: string;
  village_id: string;
  season: string;
  created_at: string;
  summary: string;
  plan_type: string;
  balanced_count: number;
  risky_count: number;
  critical_count: number;
  parcels: ScenarioPlanParcel[];
}

export interface ScenarioListResponse {
  scenarios: ScenarioItem[];
}

export interface HarvestPlanRequest {
  title: string;
  parcel_id: string;
  planned_date: string;
  notes: string;
  status: HarvestStatus;
}

export interface HarvestPlan {
  id: string;
  title: string;
  parcel_id: string;
  planned_date: string;
  notes: string;
  status: HarvestStatus;
  created_at: string;
}

export interface HarvestPlanListResponse {
  harvest_plans: HarvestPlan[];
}

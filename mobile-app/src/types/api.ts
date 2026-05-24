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

export interface AIStatusResponse {
  enabled: boolean;
  provider: string | null;
  reason: string;
}

export interface ParcelItem {
  parcel_id: string;
  field_block: "A" | "B";
  planned_crop: string;
  display_name?: string | null;
  owner_user_id?: string | null;
  parent_parcel_id?: string | null;
  area_m2?: number | null;
  geometry?: [number, number][] | null;
  centroid?: { lat: number; lng: number } | null;
  split_strategy?: string | null;
  subparcel_index?: number | null;
  is_subparcel?: boolean;
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
  shared_boundary_ratio?: number;
  shared_boundary_m?: number;
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

export interface ParcelSubdivideRequest {
  requested_count: number;
  split_strategy?: string;
}

export interface ParcelSubdivideResponse {
  parcel_id: string;
  requested_count: number;
  split_strategy: string;
  subparcels: ParcelItem[];
}

export interface FieldSubdivideResponse {
  field_block: "A" | "B";
  requested_count: number;
  split_strategy: string;
  parcels: ParcelItem[];
}

export interface ParcelMutationResponse {
  parcel_id: string;
  parcels: ParcelItem[];
}

export interface ParcelNameUpdateRequest {
  display_name: string;
}

export interface RiskSummaryResponse {
  parcel_id: string;
  season: string;
  risk_score: number;
  risk_level: RiskLevel;
  area_weighted_score: number;
  child_count: number;
  dominant_crop: string;
  subparcels: DecisionResponse[];
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
  llm_provider: string;
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

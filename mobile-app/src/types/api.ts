export type RiskLevel = "OK" | "RISKY" | "CRITICAL";
export type DecisionSource = "rules_only" | "hybrid";

export type FieldLayoutPosition = "top" | "right" | "bottom" | "left";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
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

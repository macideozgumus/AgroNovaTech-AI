import type { CropKey } from "../utils/farmUi";
import type { RiskLevel } from "../types/api";

export type SavedScenarioParcel = {
  parcelId: string;
  crop: CropKey | null;
  riskLevel: RiskLevel | "UNKNOWN";
  score: number;
  explanation: string[];
};

export type SavedScenario = {
  id: string;
  name: string;
  createdAt: string;
  parcels: SavedScenarioParcel[];
  summary: string;
};

let savedScenarios: SavedScenario[] = [];

export function getSavedScenarios() {
  return savedScenarios;
}

export function getSavedScenarioById(id: string) {
  return savedScenarios.find((scenario) => scenario.id === id);
}

export function addSavedScenario(scenario: SavedScenario) {
  savedScenarios = [scenario, ...savedScenarios];
}

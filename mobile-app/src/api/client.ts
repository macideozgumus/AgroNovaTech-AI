import Constants from "expo-constants";
import { Platform } from "react-native";

import { loadAuthToken } from "./cache";
import type {
  AIStatusResponse,
  DecisionResponse,
  FieldSubdivideResponse,
  FieldLayoutPosition,
  FieldLayoutResponse,
  HarvestPlan,
  HarvestPlanListResponse,
  HarvestPlanRequest,
  LoginRequest,
  LoginResponse,
  NeighborsResponse,
  ParcelItem,
  ParcelListResponse,
  ParcelMutationResponse,
  ParcelNameUpdateRequest,
  ParcelSubdivideRequest,
  ParcelSubdivideResponse,
  RegisterRequest,
  RiskSummaryResponse,
  ScenarioCreateRequest,
  ScenarioItem,
  ScenarioListResponse,
  ScenarioRecommendRequest,
  ScenarioRecommendResponse,
  ScoreRequest,
  UsersResponse,
} from "../types/api";

function resolveLanBaseUrlFromExpoHost(): string | undefined {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoClient?.hostUri;

  if (!hostUri) {
    return undefined;
  }

  const host = hostUri.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") {
    return undefined;
  }

  return `http://${host}:8000`;
}

const API_BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  (Platform.OS === "web" ? "http://127.0.0.1:8000" : resolveLanBaseUrlFromExpoHost());
const REQUEST_TIMEOUT_MS = 8000;
const RETRY_COUNT = 2;

if (__DEV__) {
  console.log("[AgroNova][API] Base URL:", API_BASE_URL);
}

class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Istek zaman asimina ugradi.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      "API base URL bulunamadi. `EXPO_PUBLIC_API_BASE_URL` tanimlayin veya Expo'yu `--lan` ile baslatin.",
    );
  }

  let attempt = 0;

  while (attempt <= RETRY_COUNT) {
    try {
      const token = await loadAuthToken();
      const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers || {}),
        },
        ...init,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new ApiError(text || `HTTP ${response.status}`, response.status);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new ApiError(
          `Ag baglantisi kurulamadi. API adresi: ${API_BASE_URL}. Telefon ile bilgisayar ayni agda degilse veya backend/ngrok kapaliysa bu hata gorulur.`,
        );
      }

      if (attempt === RETRY_COUNT) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      attempt += 1;
    }
  }

  throw new ApiError("Beklenmeyen API hatasi");
}

export const apiClient = {
  login(payload: LoginRequest) {
    return requestJson<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  register(payload: RegisterRequest) {
    return requestJson<LoginResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getUsers() {
    return requestJson<UsersResponse>("/api/v1/users");
  },

  getAIStatus() {
    return requestJson<AIStatusResponse>("/api/v1/ai/status");
  },

  getParcels(villageId: string) {
    return requestJson<ParcelListResponse>(`/api/v1/villages/${villageId}/parcels`);
  },

  getFieldLayout(villageId: string) {
    return requestJson<FieldLayoutResponse>(`/api/v2/villages/${villageId}/field-layout`);
  },

  putFieldLayout(villageId: string, position: FieldLayoutPosition) {
    return requestJson<FieldLayoutResponse>(`/api/v2/villages/${villageId}/field-layout`, {
      method: "PUT",
      body: JSON.stringify({ field_layout_position: position }),
    });
  },

  getNeighbors(parcelId: string, season: string) {
    return requestJson<NeighborsResponse>(
      `/api/v2/parcels/${parcelId}/neighbors?season=${encodeURIComponent(season)}`,
    );
  },

  scoreDecision(payload: ScoreRequest) {
    return requestJson<DecisionResponse>("/api/v1/decision/score", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getDecision(parcelId: string, season: string) {
    return requestJson<DecisionResponse>(
      `/api/v1/parcels/${parcelId}/decision?season=${encodeURIComponent(season)}`,
    );
  },

  subdivideParcel(parcelId: string, payload: ParcelSubdivideRequest) {
    return requestJson<ParcelSubdivideResponse>(`/api/v1/parcels/${parcelId}/subdivide`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  subdivideField(fieldBlock: "A" | "B", payload: ParcelSubdivideRequest) {
    return requestJson<FieldSubdivideResponse>(`/api/v1/fields/${fieldBlock}/subdivide`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getSubparcels(parcelId: string) {
    return requestJson<ParcelListResponse>(`/api/v1/parcels/${parcelId}/subparcels`);
  },

  updateSubparcelCrop(parcelId: string, plannedCrop: string) {
    return requestJson<ParcelItem>(`/api/v1/subparcels/${parcelId}/crop`, {
      method: "PUT",
      body: JSON.stringify({ planned_crop: plannedCrop }),
    });
  },

  updateParcelName(parcelId: string, payload: ParcelNameUpdateRequest) {
    return requestJson<ParcelItem>(`/api/v1/parcels/${parcelId}/name`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  undoParcelSplit(parcelId: string) {
    return requestJson<ParcelMutationResponse>(`/api/v1/parcels/${parcelId}/undo`, {
      method: "POST",
    });
  },

  deleteParcel(parcelId: string) {
    return requestJson<ParcelMutationResponse>(`/api/v1/parcels/${parcelId}`, {
      method: "DELETE",
    });
  },

  getParcelRiskSummary(parcelId: string, season: string) {
    return requestJson<RiskSummaryResponse>(
      `/api/v1/parcels/${parcelId}/risk-summary?season=${encodeURIComponent(season)}`,
    );
  },

  recommendScenario(payload: ScenarioRecommendRequest) {
    return requestJson<ScenarioRecommendResponse>("/api/v1/scenario/recommend", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  createScenario(payload: ScenarioCreateRequest) {
    return requestJson<ScenarioItem>("/api/v1/scenarios", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getScenarios(villageId?: string) {
    const suffix = villageId ? `?village_id=${encodeURIComponent(villageId)}` : "";
    return requestJson<ScenarioListResponse>(`/api/v1/scenarios${suffix}`);
  },

  getScenario(scenarioId: string) {
    return requestJson<ScenarioItem>(`/api/v1/scenarios/${scenarioId}`);
  },

  createHarvestPlan(payload: HarvestPlanRequest) {
    return requestJson<HarvestPlan>("/api/v1/harvest-plans", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getHarvestPlans() {
    return requestJson<HarvestPlanListResponse>("/api/v1/harvest-plans");
  },

  updateHarvestPlan(planId: string, payload: HarvestPlanRequest) {
    return requestJson<HarvestPlan>(`/api/v1/harvest-plans/${planId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteHarvestPlan(planId: string) {
    return requestJson<{ status: string }>(`/api/v1/harvest-plans/${planId}`, {
      method: "DELETE",
    });
  },
};

import Constants from "expo-constants";

import { loadAuthToken } from "./cache";
import type {
  DecisionResponse,
  FieldLayoutPosition,
  FieldLayoutResponse,
  LoginRequest,
  LoginResponse,
  NeighborsResponse,
  ParcelListResponse,
  RegisterRequest,
  ScoreRequest,
  UsersResponse,
} from "../types/api";

const API_BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  "http://192.168.1.38:8000";
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
};

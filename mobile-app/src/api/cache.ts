import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DecisionResponse } from "../types/api";

const tokenKey = "auth:token";

const decisionKey = (parcelId: string, season: string) => `decision:${parcelId}:${season}`;

export async function saveAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(tokenKey, token);
}

export async function loadAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(tokenKey);
}

export async function saveDecisionCache(data: DecisionResponse): Promise<void> {
  await AsyncStorage.setItem(decisionKey(data.parcel_id, data.season), JSON.stringify(data));
}

export async function loadDecisionCache(parcelId: string, season: string): Promise<DecisionResponse | null> {
  const raw = await AsyncStorage.getItem(decisionKey(parcelId, season));
  return raw ? (JSON.parse(raw) as DecisionResponse) : null;
}

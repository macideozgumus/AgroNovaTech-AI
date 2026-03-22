import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DecisionResponse } from "../types/api";

const tokenKey = "auth:token";
const profileKey = "auth:profile";

const decisionKey = (parcelId: string, season: string) => `decision:${parcelId}:${season}`;

export async function saveAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(tokenKey, token);
}

export async function loadAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(tokenKey);
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.multiRemove([tokenKey, profileKey]);
}

export async function saveAuthProfile(profile: { username: string; province: string; district: string; village: string }): Promise<void> {
  await AsyncStorage.setItem(profileKey, JSON.stringify(profile));
}

export async function loadAuthProfile(): Promise<{ username: string; province: string; district: string; village: string } | null> {
  const raw = await AsyncStorage.getItem(profileKey);
  return raw ? (JSON.parse(raw) as { username: string; province: string; district: string; village: string }) : null;
}

export async function saveDecisionCache(data: DecisionResponse): Promise<void> {
  await AsyncStorage.setItem(decisionKey(data.parcel_id, data.season), JSON.stringify(data));
}

export async function loadDecisionCache(parcelId: string, season: string): Promise<DecisionResponse | null> {
  const raw = await AsyncStorage.getItem(decisionKey(parcelId, season));
  return raw ? (JSON.parse(raw) as DecisionResponse) : null;
}

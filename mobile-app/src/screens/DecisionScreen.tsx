import React, { useEffect, useState } from "react";
import { ActivityIndicator, Button, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { apiClient } from "../api/client";
import { loadDecisionCache, saveDecisionCache } from "../api/cache";
import { RootStackParamList } from "../navigation/AppNavigator";
import type { DecisionResponse } from "../types/api";

type Props = NativeStackScreenProps<RootStackParamList, "Decision">;

export function DecisionScreen({ route }: Props) {
  const { parcelId, season } = route.params;
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [decision, setDecision] = useState<DecisionResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const primeFromCacheAndServer = async () => {
      const cached = await loadDecisionCache(parcelId, season);
      if (mounted && cached) {
        setDecision(cached);
      }

      try {
        const current = await apiClient.getDecision(parcelId, season);
        if (mounted) {
          setDecision(current);
        }
        await saveDecisionCache(current);
      } catch {
        // no previous decision in server yet; cache already handled
      }
    };

    primeFromCacheAndServer();

    return () => {
      mounted = false;
    };
  }, [parcelId, season]);

  const fetchDecision = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const result = await apiClient.scoreDecision({
        village_id: "v1",
        season,
        parcel_id: parcelId,
        ml_score: 62.5,
        ml_confidence: 0.7,
      });
      setDecision(result);
      await saveDecisionCache(result);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Parsel: {parcelId.toUpperCase()}</Text>
      <Text style={styles.subtitle}>Sezon: {season}</Text>
      <Button title="Karar Hesapla" onPress={fetchDecision} />

      <View style={styles.resultBox}>
        {loading && <ActivityIndicator />}
        {!loading && errorText && <Text style={styles.error}>{errorText}</Text>}
        {!loading && !errorText && !decision && <Text>Henuz karar yok.</Text>}
        {!loading && decision && (
          <>
            <Text>
              Risk: {decision.risk_score} ({decision.risk_level})
            </Text>
            <Text>Kaynak: {decision.decision_source}</Text>
            <Text>Model: {decision.model_version}</Text>
            <Text>Confidence: {decision.confidence ?? "null"}</Text>
            <Text>Reason: {decision.reason_codes.join(", ") || "-"}</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12, backgroundColor: "#f2f5f1" },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#556" },
  error: { color: "#b00020" },
  resultBox: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e1d6",
    padding: 12,
    minHeight: 120,
    gap: 6,
  },
});

import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../api/client";
import { loadDecisionCache, saveDecisionCache } from "../api/cache";
import { ReasonList, sortReasonCodes } from "../components/reasons";
import { PrimaryButton, RiskBadge, ScreenShell, SectionCard, colors } from "../components/ui";
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
        // decision yoksa ekran bos state ile devam eder
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
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <ScreenShell contentStyle={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.overline}>PARSEL ANALIZI</Text>
              <Text style={styles.title}>{parcelId.toUpperCase()}</Text>
              <Text style={styles.subtitle}>Sezon: {season}</Text>
            </View>
            <RiskBadge level={decision?.risk_level ?? "UNKNOWN"} />
          </View>

          <SectionCard style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={styles.summaryLabel}>Risk skoru</Text>
                <Text style={styles.summaryValue}>{decision ? decision.risk_score : "--"}</Text>
              </View>
              <View style={styles.summaryMeta}>
                <Text style={styles.metaLabel}>Model</Text>
                <Text style={styles.metaValue}>{decision?.model_version ?? "rules_v2"}</Text>
                <Text style={styles.metaLabel}>Kaynak</Text>
                <Text style={styles.metaValue}>{decision?.decision_source ?? "bekleniyor"}</Text>
              </View>
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteIcon}>!</Text>
              <Text style={styles.noteText}>
                Hesaplanan karar parcelle ayni sezonda saklanir. Istersen yeniden hesaplayip son durumu guncelleyebilirsin.
              </Text>
            </View>
          </SectionCard>

          <PrimaryButton title={loading ? "Karar uretiliyor..." : "Karar Hesapla"} disabled={loading} onPress={fetchDecision} />

          <SectionCard style={styles.resultCard}>
            {loading && <ActivityIndicator color={colors.accent} />}
            {!loading && errorText && <Text style={styles.error}>{errorText}</Text>}
            {!loading && !errorText && !decision && <Text style={styles.empty}>Henuz karar yok.</Text>}
            {!loading && decision && (
              <>
                <View style={styles.infoGrid}>
                  <View style={styles.infoTile}>
                    <Text style={styles.tileLabel}>Confidence</Text>
                    <Text style={styles.tileValue}>
                      {decision.confidence === null ? "Yok" : `${Math.round(decision.confidence * 100)}%`}
                    </Text>
                  </View>
                  <View style={styles.infoTile}>
                    <Text style={styles.tileLabel}>Risk seviyesi</Text>
                    <Text style={styles.tileValue}>{decision.risk_level}</Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Risk nedenleri</Text>
                <ReasonList reasonCodes={sortReasonCodes(decision.reason_codes)} />
              </>
            )}
          </SectionCard>
        </ScrollView>
      </ScreenShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.appBg },
  content: { gap: 18 },
  scrollContent: { gap: 18, paddingBottom: 28 },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  overline: {
    color: "#927863",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  title: {
    color: "#f8efe3",
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    color: "#baa79b",
    fontSize: 15,
  },
  summaryCard: {
    backgroundColor: "#1a1c2a",
    borderColor: "#323653",
    gap: 18,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    color: "#98a0ba",
    fontSize: 15,
  },
  summaryValue: {
    marginTop: 8,
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "900",
  },
  summaryMeta: {
    alignItems: "flex-end",
    gap: 4,
  },
  metaLabel: {
    color: "#857c97",
    fontSize: 12,
    fontWeight: "700",
  },
  metaValue: {
    color: "#f3ebdf",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#2a2327",
    borderRadius: 18,
    padding: 14,
  },
  noteIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.accent,
    color: "#fff",
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 34,
    fontWeight: "800",
    fontSize: 18,
  },
  noteText: {
    flex: 1,
    color: "#e6d4c3",
    fontSize: 14,
    lineHeight: 21,
  },
  resultCard: {
    gap: 16,
  },
  error: {
    color: "#ffac9d",
    fontSize: 15,
  },
  empty: {
    color: "#b7a296",
    fontSize: 15,
  },
  infoGrid: {
    flexDirection: "row",
    gap: 12,
  },
  infoTile: {
    flex: 1,
    backgroundColor: "#35261d",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#493227",
    padding: 14,
    gap: 8,
  },
  tileLabel: {
    color: "#a8968a",
    fontSize: 13,
    fontWeight: "700",
  },
  tileValue: {
    color: "#fff7eb",
    fontSize: 22,
    fontWeight: "800",
  },
  sectionTitle: {
    color: "#fff6eb",
    fontSize: 18,
    fontWeight: "800",
  },
});

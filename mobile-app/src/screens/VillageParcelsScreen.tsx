import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../api/client";
import { ParcelVisualCard, RiskBadge, ScreenShell, SectionCard, colors } from "../components/ui";
import { RootStackParamList } from "../navigation/AppNavigator";
import type { DecisionResponse, ParcelItem, RiskLevel } from "../types/api";

type Props = NativeStackScreenProps<RootStackParamList, "VillageParcels">;

const DEFAULT_SEASON = "2026_Spring";

type DecisionMap = Record<string, DecisionResponse | undefined>;

export function VillageParcelsScreen({ navigation }: Props) {
  const [parcels, setParcels] = useState<ParcelItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "CRITICAL" | "RISKY" | "OK">("ALL");

  useEffect(() => {
    let mounted = true;

    const ensureDecision = async (parcel: ParcelItem) => {
      try {
        return await apiClient.getDecision(parcel.parcel_id, DEFAULT_SEASON);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Decision not found")) {
          return apiClient.scoreDecision({
            village_id: "v1",
            season: DEFAULT_SEASON,
            parcel_id: parcel.parcel_id,
            ml_score: 62.5,
            ml_confidence: 0.7,
          });
        }
        throw error;
      }
    };

    const loadParcelsAndDecisions = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getParcels("v1");
        const decisionEntries = await Promise.all(
          data.parcels.map(async (parcel) => [parcel.parcel_id, await ensureDecision(parcel)] as const),
        );

        if (mounted) {
          setParcels(data.parcels);
          setDecisions(Object.fromEntries(decisionEntries));
          setErrorText(null);
        }
      } catch (error) {
        if (mounted) {
          setErrorText(error instanceof Error ? error.message : "Parseller yuklenemedi");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadParcelsAndDecisions();
    return () => {
      mounted = false;
    };
  }, []);

  const decisionLevel = (parcelId: string): RiskLevel | "UNKNOWN" => decisions[parcelId]?.risk_level ?? "UNKNOWN";

  const filteredParcels = useMemo(
    () =>
      parcels.filter((parcel) => {
        const level = decisionLevel(parcel.parcel_id);
        const matchesFilter = activeFilter === "ALL" ? true : level === activeFilter;
        const normalized = query.trim().toLowerCase();
        const matchesQuery =
          normalized.length === 0 ||
          parcel.parcel_id.toLowerCase().includes(normalized) ||
          parcel.planned_crop.toLowerCase().includes(normalized);
        return matchesFilter && matchesQuery;
      }),
    [activeFilter, parcels, query, decisions],
  );

  const summary = useMemo(
    () => ({
      all: parcels.length,
      critical: parcels.filter((parcel) => decisionLevel(parcel.parcel_id) === "CRITICAL").length,
      risky: parcels.filter((parcel) => decisionLevel(parcel.parcel_id) === "RISKY").length,
      ok: parcels.filter((parcel) => decisionLevel(parcel.parcel_id) === "OK").length,
    }),
    [parcels, decisions],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <ScreenShell contentStyle={styles.screenContent}>
        <View style={styles.headerRow}>
          <Text style={styles.headerIcon}>≡</Text>
          <Text style={styles.title}>Koy Genel Bakis</Text>
          <Text style={styles.closeIcon}>x</Text>
        </View>

        <SectionCard style={styles.searchCard}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Parsel ara..."
            placeholderTextColor="#9f8b7f"
            style={styles.searchInput}
          />

          <View style={styles.filterRow}>
            {[
              { key: "ALL", label: `Tumu (${summary.all})` },
              { key: "CRITICAL", label: `Kritik (${summary.critical})` },
              { key: "RISKY", label: `Riskli (${summary.risky})` },
              { key: "OK", label: `Guvenli (${summary.ok})` },
            ].map((item) => (
              <Pressable
                key={item.key}
                onPress={() => setActiveFilter(item.key as "ALL" | "CRITICAL" | "RISKY" | "OK")}
                style={[styles.filterChip, activeFilter === item.key && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, activeFilter === item.key && styles.filterTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </SectionCard>

        <SectionCard style={styles.healthCard}>
          <View style={styles.healthTop}>
            <View>
              <Text style={styles.healthLabel}>Genel Koy Sagligi</Text>
              <Text style={styles.healthValue}>{summary.critical > 0 ? "Durum: Izlenmeli" : "Durum: Iyi"}</Text>
            </View>
            <View style={styles.weatherBadge}>
              <Text style={styles.weatherIcon}>*</Text>
              <Text style={styles.weatherValue}>24°C</Text>
            </View>
          </View>
          <View style={styles.healthNote}>
            <Text style={styles.healthNoteIcon}>i</Text>
            <Text style={styles.healthNoteText}>
              Parsel kartlari gercek backend kararina gore boyanir. Karar yoksa sistem ilk yuklemede otomatik hesaplar.
            </Text>
          </View>
        </SectionCard>

        {loading && <ActivityIndicator color={colors.accent} />}
        {!!errorText && <Text style={styles.error}>{errorText}</Text>}

        {!loading && !errorText && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.grid}>
              {filteredParcels.map((item) => (
                <ParcelVisualCard
                  key={item.parcel_id}
                  parcel={item}
                  riskLevel={decisionLevel(item.parcel_id)}
                  subtitle={`Blok ${item.field_block} • ${item.planned_crop}`}
                  onPress={() => navigation.navigate("Decision", { parcelId: item.parcel_id, season: DEFAULT_SEASON })}
                />
              ))}
            </View>
            <View style={styles.legendRow}>
              <RiskBadge level="CRITICAL" />
              <RiskBadge level="RISKY" />
              <RiskBadge level="OK" />
            </View>
          </ScrollView>
        )}
      </ScreenShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.appBg },
  screenContent: { gap: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  headerIcon: {
    color: "#fff3e8",
    fontSize: 28,
    fontWeight: "700",
    width: 34,
  },
  title: {
    flex: 1,
    color: "#fff7ee",
    fontSize: 26,
    fontWeight: "900",
    marginLeft: 6,
  },
  closeIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    textAlign: "center",
    textAlignVertical: "center",
    backgroundColor: "#35241b",
    color: "#fff8f1",
    fontSize: 28,
    lineHeight: 54,
  },
  searchCard: {
    gap: 14,
  },
  searchInput: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#3a281f",
    paddingHorizontal: 18,
    color: "#f3ede7",
    fontSize: 17,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  filterChipActive: {
    borderBottomColor: colors.accent,
  },
  filterText: {
    color: "#c2b0a5",
    fontSize: 16,
    fontWeight: "700",
  },
  filterTextActive: {
    color: colors.accent,
  },
  healthCard: {
    backgroundColor: "#17192a",
    borderColor: "#383b58",
    gap: 18,
  },
  healthTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  healthLabel: {
    color: "#9ca3bd",
    fontSize: 16,
  },
  healthValue: {
    marginTop: 8,
    color: colors.ok,
    fontSize: 28,
    fontWeight: "900",
  },
  weatherBadge: {
    alignItems: "center",
    gap: 4,
  },
  weatherIcon: {
    color: "#ffd03f",
    fontSize: 28,
    fontWeight: "900",
  },
  weatherValue: {
    color: "#fff7f0",
    fontSize: 24,
    fontWeight: "800",
  },
  healthNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    backgroundColor: "#2a2327",
    padding: 14,
  },
  healthNoteIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.accent,
    color: "#fff",
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 34,
  },
  healthNoteText: {
    flex: 1,
    color: "#ece1d4",
    fontSize: 15,
    lineHeight: 22,
  },
  error: { color: "#ff9f90" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  legendRow: {
    marginTop: 8,
    marginBottom: 20,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
});

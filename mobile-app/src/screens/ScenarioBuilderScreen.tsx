import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { apiClient } from "../api/client";
import { addSavedScenario, getSavedScenarios } from "../scenario/store";
import { RootStackParamList } from "../navigation/AppNavigator";
import type { DecisionResponse, ParcelItem, RiskLevel } from "../types/api";
import { cropVisuals, getFriendlyParcelName, getFriendlyParcelSubtitle, riskTone, type CropKey } from "../utils/farmUi";

type Props = NativeStackScreenProps<RootStackParamList, "ScenarioBuilder">;

type DecisionMap = Record<string, DecisionResponse | undefined>;
type ScenarioParcelState = Record<string, CropKey>;

const DEFAULT_SEASON = "2026_Spring";
const cropOptions: CropKey[] = ["corn", "sunflower", "wheat", "barley"];
const palette = {
  red: "#E0675C",
};

function scoreScenario(
  parcel: ParcelItem,
  crop: CropKey,
  baseline: RiskLevel | "UNKNOWN",
  selections: ScenarioParcelState,
  parcels: ParcelItem[],
) {
  let score = crop === "corn" ? 62 : crop === "sunflower" ? 50 : crop === "barley" ? 44 : 38;
  const explanation: string[] = [];

  if (baseline === "CRITICAL") {
    score += 12;
    explanation.push("Bu parsel mevcut veride zaten yüksek riskli görünüyor.");
  } else if (baseline === "RISKY") {
    score += 7;
    explanation.push("Parselin mevcut kararı izleme gerektiriyor.");
  }

  if (parcel.planned_crop !== crop) {
    score -= 6;
    explanation.push("Mevcut üründen farklı seçim, nöbetleşe ekim avantajı sağlayabilir.");
  } else {
    explanation.push("Mevcut ürün tercihi korunuyor.");
  }

  const currentIndex = parcels.findIndex((item) => item.parcel_id === parcel.parcel_id);
  const adjacent = [parcels[currentIndex - 1], parcels[currentIndex + 1]].filter(Boolean) as ParcelItem[];
  const sameCropNeighbors = adjacent.filter((item) => selections[item.parcel_id] === crop).length;
  if (sameCropNeighbors > 0) {
    score += sameCropNeighbors * 8;
    explanation.push("Komşu parsellerde aynı ürün arttığı için hastalık ve baskı riski yükseliyor.");
  } else {
    score -= 3;
    explanation.push("Komşu çeşitliliği bu senaryoda daha dengeli.");
  }

  if (crop === "wheat" || crop === "barley") {
    score -= 3;
    explanation.push("Serin dönem ürünleri mevcut koşullarda daha stabil sonuç verebilir.");
  }

  const clamped = Math.max(20, Math.min(92, score));
  const riskLevel: RiskLevel =
    clamped >= 70 ? "CRITICAL" : clamped >= 50 ? "RISKY" : "OK";

  if (riskLevel === "CRITICAL") {
    explanation.push("Bu kombinasyon kısa vadeli deneme için uygun olabilir ama köy geneline açmadan önce yeniden düşünülmeli.");
  } else if (riskLevel === "RISKY") {
    explanation.push("Bu seçenek denenebilir; sulama, komşu etkisi ve zamanlama birlikte izlenmeli.");
  } else {
    explanation.push("Bu senaryo daha dengeli bir dağılım sağlıyor ve araştırma için güçlü aday.");
  }

  return { score: Math.round(clamped), riskLevel, explanation };
}

export function ScenarioBuilderScreen({ navigation, route }: Props) {
  const focusParcelId = route.params?.focusParcelId ?? null;
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [parcels, setParcels] = useState<ParcelItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [selections, setSelections] = useState<ScenarioParcelState>({});
  const [savedScenarios, setSavedScenarios] = useState(getSavedScenarios());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const ensureDecision = async (parcel: ParcelItem) => {
      try {
        return await apiClient.getDecision(parcel.parcel_id, DEFAULT_SEASON);
      } catch {
        return undefined;
      }
    };

    const load = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getParcels("v1");
        const myParcels = data.parcels.slice(0, Math.ceil(data.parcels.length / 2));
        const decisionEntries = await Promise.all(
          myParcels.map(async (parcel) => [parcel.parcel_id, await ensureDecision(parcel)] as const),
        );

        if (!mounted) {
          return;
        }

        setParcels(myParcels);
        setDecisions(Object.fromEntries(decisionEntries));
        setSelections(
          Object.fromEntries(
            myParcels.map((parcel) => [parcel.parcel_id, parcel.planned_crop as CropKey]),
          ),
        );
      } catch (error) {
        if (mounted) {
          setErrorText(error instanceof Error ? error.message : "Senaryo verisi yüklenemedi.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const scenarioRows = useMemo(
    () =>
      parcels.map((parcel) => {
        const crop = selections[parcel.parcel_id] ?? (parcel.planned_crop as CropKey);
        const baseline = decisions[parcel.parcel_id]?.risk_level ?? "UNKNOWN";
        return {
          parcel,
          crop,
          ...scoreScenario(parcel, crop, baseline, selections, parcels),
        };
      }),
    [decisions, parcels, selections],
  );

  const scenarioSummary = useMemo(() => {
    if (scenarioRows.length === 0) {
      return "Araştırma senaryosu için parseller yükleniyor.";
    }

    const critical = scenarioRows.filter((row) => row.riskLevel === "CRITICAL").length;
    const risky = scenarioRows.filter((row) => row.riskLevel === "RISKY").length;
    if (critical === 0 && risky <= 1) {
      return "Bu senaryo daha dengeli görünüyor. Çiftçi için paylaşılabilir bir aday.";
    }
    if (critical <= 1) {
      return "Bu senaryo araştırmaya değer. Birkaç parsel için ek kontrol gerekebilir.";
    }
    return "Bu senaryoda riskli parsel sayısı artıyor. Köy geneline açmadan önce yeniden düzenlemek iyi olur.";
  }, [scenarioRows]);

  const saveScenario = () => {
    if (scenarioRows.length === 0) {
      return;
    }

    const name = scenarioName.trim() || `${savedScenarios.length + 1}. Senaryo`;
    addSavedScenario({
      id: `${Date.now()}`,
      name,
      createdAt: new Date().toLocaleString("tr-TR"),
      parcels: scenarioRows.map((row) => ({
        parcelId: row.parcel.parcel_id,
        crop: row.crop,
        riskLevel: row.riskLevel,
        score: row.score,
        explanation: row.explanation,
      })),
      summary: scenarioSummary,
    });
    setSavedScenarios(getSavedScenarios());
    setNotice(`${name} kaydedildi. Daha sonra köy geneline açmadan önce tekrar inceleyebilirsin.`);
    if (!scenarioName.trim()) {
      setScenarioName("");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Text style={styles.iconButtonText}>←</Text>
          </Pressable>
          <Text style={styles.pageTitle}>Senaryo Oluşturucu</Text>
          <View style={styles.closeGhost}>
            <Text style={styles.closeGhostText}>✕</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Araştırma Alanı</Text>
            <Text style={styles.heroTitle}>Tarlalarında farklı olasılıkları karşılaştır</Text>
            <Text style={styles.heroText}>
              Aynı arazide farklı ürün kombinasyonları deneyip olası risk durumlarını açıklamalarıyla birlikte görebilirsin.
              Sonra uygun gördüğünü kaydedip daha sonra tekrar inceleyebilirsin.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Senaryo Adı</Text>
            <TextInput
              style={styles.input}
              value={scenarioName}
              onChangeText={setScenarioName}
              placeholder="Örn. İlkbahar deneme senaryosu"
              placeholderTextColor="#8A978A"
            />
            <Text style={styles.sectionHint}>
              {focusParcelId ? `${getFriendlyParcelName(focusParcelId)} odaklı bir senaryo üzerinde çalışıyorsun.` : "Bu ekran mevcut tarlaların üzerinde alternatifler denemen için hazırlandı."}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Parsel Olasılıkları</Text>
              <View style={styles.sectionPill}>
                <Text style={styles.sectionPillText}>{scenarioRows.length} parsel</Text>
              </View>
            </View>

            {loading ? <Text style={styles.sectionHint}>Parseller yükleniyor...</Text> : null}
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            {scenarioRows.map((row) => {
              const tone = riskTone(row.riskLevel);
              return (
                <View
                  key={row.parcel.parcel_id}
                  style={[styles.parcelCard, focusParcelId === row.parcel.parcel_id && styles.parcelCardFocused]}
                >
                  <View style={styles.parcelHeader}>
                    <View>
                      <Text style={styles.parcelTitle}>{getFriendlyParcelName(row.parcel.parcel_id)}</Text>
                      <Text style={styles.parcelSubtitle}>{getFriendlyParcelSubtitle(row.parcel.parcel_id)}</Text>
                    </View>
                    <View style={[styles.riskBadge, { backgroundColor: tone.badgeBg }]}>
                      <Text style={[styles.riskBadgeText, { color: tone.badgeFg }]}>{tone.text}</Text>
                    </View>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropRow}>
                    {cropOptions.map((crop) => (
                      <Pressable
                        key={`${row.parcel.parcel_id}-${crop}`}
                        style={[styles.cropChip, selections[row.parcel.parcel_id] === crop && styles.cropChipActive]}
                        onPress={() =>
                          setSelections((current) => ({
                            ...current,
                            [row.parcel.parcel_id]: crop,
                          }))
                        }
                      >
                        <Text style={[styles.cropChipText, selections[row.parcel.parcel_id] === crop && styles.cropChipTextActive]}>
                          {cropVisuals[crop].label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreValue}>Risk skoru: {row.score}</Text>
                    <Text style={styles.scoreCrop}>Seçim: {cropVisuals[row.crop].label}</Text>
                  </View>

                  <View style={styles.explanationBox}>
                    {row.explanation.map((item, index) => (
                      <Text key={`${row.parcel.parcel_id}-${index}`} style={styles.explanationText}>
                        • {item}
                      </Text>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Araştırma Özeti</Text>
            <Text style={styles.summaryText}>{scenarioSummary}</Text>
            <Pressable style={styles.saveButton} onPress={saveScenario}>
              <Text style={styles.saveButtonText}>Senaryoyu Kaydet</Text>
            </Pressable>
            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Kaydedilen Senaryolar</Text>
            {savedScenarios.length === 0 ? (
              <Text style={styles.sectionHint}>Henüz kayıt yok. Uygun gördüğün kombinasyonu burada saklayabilirsin.</Text>
            ) : (
              savedScenarios.map((scenario) => (
                <View key={scenario.id} style={styles.savedCard}>
                  <Text style={styles.savedTitle}>{scenario.name}</Text>
                  <Text style={styles.savedMeta}>{scenario.createdAt}</Text>
                  <Text style={styles.savedSummary}>{scenario.summary}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EEF2E7" },
  page: { flex: 1, backgroundColor: "#EEF2E7" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#FCFCF9",
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  iconButtonText: { color: "#2E6D2E", fontSize: 28, fontWeight: "700" },
  pageTitle: { flex: 1, color: "#162234", fontSize: 21, fontWeight: "900", textAlign: "center", marginHorizontal: 10 },
  closeGhost: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDF3E6",
  },
  closeGhostText: { color: "#587157", fontSize: 18, fontWeight: "700" },
  content: { padding: 18, gap: 18, paddingBottom: 28 },
  heroCard: { backgroundColor: "#FCFCF9", borderRadius: 30, padding: 20, gap: 10 },
  heroEyebrow: { color: "#7B6246", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  heroTitle: { color: "#162234", fontSize: 24, fontWeight: "900" },
  heroText: { color: "#5D6B63", fontSize: 15, lineHeight: 22 },
  sectionCard: { backgroundColor: "#FCFCF9", borderRadius: 28, padding: 18, gap: 14 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: "#162234", fontSize: 20, fontWeight: "900" },
  sectionHint: { color: "#70806F", fontSize: 14, lineHeight: 20 },
  input: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE6D8",
    paddingHorizontal: 16,
    color: "#223127",
    fontSize: 16,
  },
  sectionPill: { borderRadius: 999, backgroundColor: "#E6F5E0", paddingHorizontal: 12, paddingVertical: 8 },
  sectionPillText: { color: "#2E6D2E", fontSize: 12, fontWeight: "900" },
  parcelCard: { borderRadius: 22, backgroundColor: "#F7F8F4", padding: 16, gap: 12 },
  parcelCardFocused: { borderWidth: 2, borderColor: "#C5DDBB" },
  parcelHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  parcelTitle: { color: "#223127", fontSize: 17, fontWeight: "900" },
  parcelSubtitle: { color: "#778478", fontSize: 13, marginTop: 4 },
  riskBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  riskBadgeText: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  cropRow: { gap: 10, paddingRight: 8 },
  cropChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEE4D7",
  },
  cropChipActive: { backgroundColor: "#E6F5E0", borderColor: "#C5DDBB" },
  cropChipText: { color: "#4C5C4E", fontSize: 13, fontWeight: "800" },
  cropChipTextActive: { color: "#2E6D2E" },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  scoreValue: { color: "#2E6132", fontSize: 14, fontWeight: "900" },
  scoreCrop: { color: "#7B6246", fontSize: 14, fontWeight: "800" },
  explanationBox: { borderRadius: 16, backgroundColor: "#FFFFFF", padding: 12, gap: 6 },
  explanationText: { color: "#556461", fontSize: 13, lineHeight: 19 },
  summaryText: { color: "#556461", fontSize: 14, lineHeight: 22 },
  saveButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#BFD9B8",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: { color: "#35522E", fontSize: 15, fontWeight: "900" },
  noticeText: { color: "#2E6D2E", fontSize: 13, fontWeight: "800", lineHeight: 20 },
  savedCard: { borderRadius: 18, backgroundColor: "#F7F8F4", padding: 14, gap: 6 },
  savedTitle: { color: "#223127", fontSize: 16, fontWeight: "900" },
  savedMeta: { color: "#7A8679", fontSize: 12, fontWeight: "700" },
  savedSummary: { color: "#556461", fontSize: 14, lineHeight: 20 },
  errorText: { color: palette.red, fontSize: 14, fontWeight: "700" },
});

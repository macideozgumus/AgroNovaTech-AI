import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { apiClient } from "../api/client";
import { RootStackParamList } from "../navigation/AppNavigator";
import type { CropKey, DecisionResponse, ParcelItem, RiskLevel, ScenarioItem, ScenarioPlan, ScenarioPlanParcel } from "../types/api";
import { cropVisuals, getCropImageSource, getFriendlyParcelName, getFriendlyParcelSubtitle, riskTone } from "../utils/farmUi";

type Props = NativeStackScreenProps<RootStackParamList, "ScenarioBuilder">;
type SelectionMap = Record<string, CropKey | null>;
type DecisionMap = Record<string, DecisionResponse | undefined>;
type ScoredMap = Record<string, ScenarioPlanParcel | undefined>;
type Row = {
  parcel: ParcelItem;
  crop: CropKey | null;
  score: number;
  riskLevel: RiskLevel | "UNKNOWN";
  explanation: string[];
};

const VILLAGE_ID = "v1";
const SEASON = "2026_Spring";
const cropOptions: CropKey[] = ["corn", "sunflower", "wheat", "barley"];

function toSelectionMap(items: { parcel_id: string; crop: CropKey }[]) {
  return Object.fromEntries(items.map((item) => [item.parcel_id, item.crop])) as Record<string, CropKey>;
}

function toScoredMap(items: ScenarioPlanParcel[]) {
  return Object.fromEntries(items.map((item) => [item.parcel_id, item])) as ScoredMap;
}

function fallbackExplanation(parcel: ParcelItem, crop: CropKey | null, decision?: DecisionResponse) {
  if (!crop) {
    return ["Bu parsel şu an boş.", "Kesin skor için backend planlarından birini uygula veya senaryoyu kaydet."];
  }
  const lines = [`Seçilen ürün: ${cropVisuals[crop].label}.`];
  lines.push(crop === parcel.planned_crop ? "Mevcut ürün korunuyor." : "Ürün değişti; kesin skor kayıt sırasında backend tarafından hesaplanacak.");
  lines.push(
    decision?.risk_level === "CRITICAL"
      ? "Taban karar kritik."
      : decision?.risk_level === "RISKY"
        ? "Taban karar izleme gerektiriyor."
        : decision?.risk_level === "OK"
          ? "Taban karar dengeli."
          : "Bu parsel için henüz kayıtlı backend kararı yok.",
  );
  return lines;
}

export function ScenarioBuilderScreen({ navigation, route }: Props) {
  const scenarioId = route.params?.scenarioId;
  const focusParcelId = route.params?.focusParcelId ?? null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [parcels, setParcels] = useState<ParcelItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [plans, setPlans] = useState<ScenarioPlan[]>([]);
  const [savedScenarios, setSavedScenarios] = useState<ScenarioItem[]>([]);
  const [graphInfo, setGraphInfo] = useState({ nodes: 0, edges: 0 });
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(focusParcelId);
  const [selections, setSelections] = useState<SelectionMap>({});
  const [scored, setScored] = useState<ScoredMap>({});

  useEffect(() => {
    let mounted = true;

    const loadDecision = async (parcelId: string) => {
      try {
        return await apiClient.getDecision(parcelId, SEASON);
      } catch {
        return undefined;
      }
    };

    const load = async () => {
      try {
        setLoading(true);
        setErrorText(null);
        const [parcelData, recommendData, savedData] = await Promise.all([
          apiClient.getParcels(VILLAGE_ID),
          apiClient.recommendScenario({ village_id: VILLAGE_ID, season: SEASON }),
          apiClient.getScenarios(VILLAGE_ID),
        ]);

        const myParcels = parcelData.parcels.slice(0, Math.ceil(parcelData.parcels.length / 2));
        const decisionPairs = await Promise.all(myParcels.map(async (parcel) => [parcel.parcel_id, await loadDecision(parcel.parcel_id)] as const));
        const loadedScenario = scenarioId ? await apiClient.getScenario(scenarioId) : undefined;

        if (!mounted) {
          return;
        }

        setParcels(myParcels);
        setDecisions(Object.fromEntries(decisionPairs));
        setPlans(recommendData.plans);
        setSavedScenarios(savedData.scenarios);
        setGraphInfo({ nodes: recommendData.graph_node_count, edges: recommendData.graph_edge_count });

        if (loadedScenario) {
          setScenarioName(loadedScenario.name);
          setSelections(
            Object.fromEntries(
              myParcels.map((parcel) => [parcel.parcel_id, loadedScenario.parcels.find((item) => item.parcel_id === parcel.parcel_id)?.crop ?? null]),
            ),
          );
          setScored(toScoredMap(loadedScenario.parcels));
          setSelectedPlanId(loadedScenario.plan_type === "custom" ? null : loadedScenario.plan_type);
          setNotice(`"${loadedScenario.name}" backend üzerinden yüklendi.`);
        } else if (recommendData.plans[0]) {
          setSelections(toSelectionMap(recommendData.plans[0].selections));
          setScored(toScoredMap(recommendData.plans[0].selections));
          setSelectedPlanId(recommendData.plans[0].id);
          setNotice(`${recommendData.plans[0].title} backend optimizer tarafından hazırlandı.`);
        } else {
          setSelections(Object.fromEntries(myParcels.map((parcel) => [parcel.parcel_id, null])));
        }

        setSelectedParcelId(focusParcelId ?? loadedScenario?.parcels[0]?.parcel_id ?? myParcels[0]?.parcel_id ?? null);
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
  }, [focusParcelId, scenarioId]);

  const rows = useMemo<Row[]>(
    () =>
      parcels.map((parcel) => ({
        parcel,
        crop: selections[parcel.parcel_id] ?? null,
        score: scored[parcel.parcel_id]?.risk_score ?? decisions[parcel.parcel_id]?.risk_score ?? 0,
        riskLevel: scored[parcel.parcel_id]?.risk_level ?? decisions[parcel.parcel_id]?.risk_level ?? "UNKNOWN",
        explanation: scored[parcel.parcel_id]?.explanation ?? fallbackExplanation(parcel, selections[parcel.parcel_id] ?? null, decisions[parcel.parcel_id]),
      })),
    [decisions, parcels, scored, selections],
  );

  const selectedRow = useMemo(() => rows.find((item) => item.parcel.parcel_id === selectedParcelId) ?? rows[0], [rows, selectedParcelId]);

  const summary = useMemo(() => {
    if (rows.length === 0) {
      return "Araştırma senaryosu yükleniyor.";
    }
    const filled = rows.filter((row) => row.crop !== null);
    if (filled.length === 0) {
      return "Tüm parseller boş. İstersen backend planlarından birini uygula.";
    }
    const critical = rows.filter((row) => row.riskLevel === "CRITICAL").length;
    const risky = rows.filter((row) => row.riskLevel === "RISKY").length;
    if (critical === 0 && risky <= 1) {
      return "Bu senaryo dengeli görünüyor.";
    }
    if (critical <= 1) {
      return "Bu senaryo uygulanabilir, birkaç parsel için saha takibi gerekebilir.";
    }
    return "Bu senaryoda kritik baskı yüksek. Alternatif planlara bakmak iyi olur.";
  }, [rows]);

  const applyPlan = (plan: ScenarioPlan) => {
    setSelections(toSelectionMap(plan.selections));
    setScored(toScoredMap(plan.selections));
    setSelectedPlanId(plan.id);
    setSelectedParcelId(parcels[0]?.parcel_id ?? null);
    setNotice(`${plan.title} backend recommendation cevabı ile uygulandı.`);
  };

  const updateCrop = (parcelId: string, crop: CropKey | null) => {
    setSelections((current) => ({ ...current, [parcelId]: crop }));
    setScored((current) => ({ ...current, [parcelId]: undefined }));
    setSelectedPlanId(null);
  };

  const clearScenario = () => {
    Alert.alert("Senaryoyu Temizle", "Sadece araştırma seçimin temizlenecek.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Temizle",
        style: "destructive",
        onPress: () => {
          setSelections(Object.fromEntries(parcels.map((parcel) => [parcel.parcel_id, null])));
          setScored({});
          setSelectedPlanId(null);
          setScenarioName("");
          setNotice("Senaryo temizlendi.");
        },
      },
    ]);
  };

  const saveScenario = async () => {
    const filled = rows.filter((row) => row.crop !== null);
    if (filled.length === 0) {
      setNotice("Kaydetmeden önce en az bir parsel seçmelisin.");
      return;
    }
    try {
      setSaving(true);
      const saved = await apiClient.createScenario({
        name: scenarioName.trim() || `${savedScenarios.length + 1}. Senaryo`,
        village_id: VILLAGE_ID,
        season: SEASON,
        plan_type: selectedPlanId ?? "custom",
        parcels: filled.map((row) => ({ parcel_id: row.parcel.parcel_id, crop: row.crop as CropKey })),
      });
      const savedList = await apiClient.getScenarios(VILLAGE_ID);
      setSavedScenarios(savedList.scenarios);
      setScenarioName(saved.name);
      setScored(toScoredMap(saved.parcels));
      setNotice(`${saved.name} backend üzerinde kaydedildi.`);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Senaryo kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Text style={styles.iconButtonText}>←</Text>
          </Pressable>
          <Text style={styles.pageTitle}>Senaryo Oluşturucu</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>Araştırma Alanı</Text>
          <Text style={styles.title}>AI Destekli Araştırma Planları</Text>
          <Text style={styles.body}>Graph modeli {graphInfo.nodes} düğüm ve {graphInfo.edges} komşuluk kenarı üstünde recommendation üretiyor.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.titleSmall}>Plan Kartları</Text>
            <Text style={styles.badge}>Backend Canlı</Text>
          </View>
          {plans.map((plan) => (
            <View key={plan.id} style={[styles.planCard, selectedPlanId === plan.id && styles.planCardActive]}>
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Text style={styles.body}>{plan.summary}</Text>
                </View>
                <Text style={styles.planBadge}>{plan.badge}</Text>
              </View>
              <Text style={styles.emphasis}>{plan.emphasis}</Text>
              <Text style={styles.metric}>Dengeli {plan.balanced_count} | Riskli {plan.risky_count} | Kritik {plan.critical_count}</Text>
              {plan.reason_list.map((item, index) => (
                <Text key={`${plan.id}-${index}`} style={styles.reason}>• {item}</Text>
              ))}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {plan.selections.map((selection) => (
                  <View key={`${plan.id}-${selection.parcel_id}`} style={styles.chip}>
                    <Image source={getCropImageSource(selection.crop)} style={styles.chipIcon} />
                    <Text style={styles.chipText}>{cropVisuals[selection.crop].label}</Text>
                  </View>
                ))}
              </ScrollView>
              <Pressable style={styles.primaryButton} onPress={() => applyPlan(plan)}>
                <Text style={styles.primaryButtonText}>Bu Planı Uygula</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.titleSmall}>Senaryo Adı</Text>
          <TextInput
            style={styles.input}
            value={scenarioName}
            onChangeText={setScenarioName}
            placeholder="Örn. İlkbahar deneme senaryosu"
            placeholderTextColor="#8A978A"
          />
          <Text style={styles.body}>{focusParcelId ? `${getFriendlyParcelName(focusParcelId)} odaklı çalışıyorsun.` : "İstersen plan seç, istersen ürünleri tek tek değiştir."}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.titleSmall}>Parsel Panelleri</Text>
            <Text style={styles.badge}>{rows.length} parsel</Text>
          </View>
          {loading ? <Text style={styles.body}>Parseller yükleniyor...</Text> : null}
          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.panelRow}>
            {rows.map((row) => {
              const tone = riskTone(row.riskLevel);
              return (
                <Pressable key={row.parcel.parcel_id} style={[styles.panel, selectedParcelId === row.parcel.parcel_id && styles.panelActive]} onPress={() => setSelectedParcelId(row.parcel.parcel_id)}>
                  {row.crop ? <Image source={getCropImageSource(row.crop)} style={styles.panelIcon} /> : <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>+</Text></View>}
                  <Text style={styles.planTitle}>{getFriendlyParcelName(row.parcel.parcel_id)}</Text>
                  <Text style={styles.body}>{getFriendlyParcelSubtitle(row.parcel.parcel_id)}</Text>
                  <Text style={[styles.inlineBadge, { color: tone.badgeFg }]}>{tone.text}</Text>
                  <Text style={styles.metric}>{row.crop ? cropVisuals[row.crop].label : "Boş Parsel"}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedRow ? (
            <View style={styles.detailCard}>
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.eyebrow}>Parsel Detayı</Text>
                  <Text style={styles.titleSmall}>{getFriendlyParcelName(selectedRow.parcel.parcel_id)}</Text>
                  <Text style={styles.body}>{getFriendlyParcelSubtitle(selectedRow.parcel.parcel_id)}</Text>
                </View>
                <Text style={styles.badge}>{riskTone(selectedRow.riskLevel).text}</Text>
              </View>
              <Text style={styles.metric}>Risk skoru: {selectedRow.score || "-"}</Text>
              <Text style={styles.body}>Mevcut plan: {cropVisuals[selectedRow.parcel.planned_crop]?.label ?? "-"}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Pressable style={[styles.chip, selections[selectedRow.parcel.parcel_id] === null && styles.chipActive]} onPress={() => updateCrop(selectedRow.parcel.parcel_id, null)}>
                  <Text style={styles.chipText}>Boş Parsel</Text>
                </Pressable>
                {cropOptions.map((crop) => (
                  <Pressable key={`${selectedRow.parcel.parcel_id}-${crop}`} style={[styles.chip, selections[selectedRow.parcel.parcel_id] === crop && styles.chipActive]} onPress={() => updateCrop(selectedRow.parcel.parcel_id, crop)}>
                    <Image source={getCropImageSource(crop)} style={styles.chipIcon} />
                    <Text style={styles.chipText}>{cropVisuals[crop].label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {selectedRow.explanation.map((item, index) => (
                <Text key={`${selectedRow.parcel.parcel_id}-${index}`} style={styles.reason}>• {item}</Text>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.titleSmall}>Araştırma Özeti</Text>
            <Pressable style={styles.secondaryButton} onPress={clearScenario}>
              <Text style={styles.secondaryButtonText}>Tümünü Sil</Text>
            </Pressable>
          </View>
          <Text style={styles.body}>{summary}</Text>
          <Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={saveScenario} disabled={saving}>
            <Text style={styles.primaryButtonText}>{saving ? "Kaydediliyor..." : "Senaryoyu Kaydet"}</Text>
          </Pressable>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.titleSmall}>Kaydedilen Senaryolar</Text>
          {savedScenarios.length === 0 ? <Text style={styles.body}>Henüz kayıt yok.</Text> : savedScenarios.map((scenario) => (
            <View key={scenario.id} style={styles.savedCard}>
              <Text style={styles.planTitle}>{scenario.name}</Text>
              <Text style={styles.body}>{scenario.created_at}</Text>
              <Text style={styles.body}>{scenario.summary}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EEF2E7" },
  page: { padding: 18, gap: 16, paddingBottom: 28, backgroundColor: "#EEF2E7" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconButton: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF" },
  iconButtonText: { color: "#2E6D2E", fontSize: 28, fontWeight: "700" },
  pageTitle: { flex: 1, color: "#162234", fontSize: 22, fontWeight: "900", textAlign: "center", marginRight: 52 },
  card: { backgroundColor: "#FCFCF9", borderRadius: 28, padding: 18, gap: 12 },
  detailCard: { backgroundColor: "#F6F8F2", borderRadius: 22, padding: 16, gap: 10 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  flex: { flex: 1 },
  eyebrow: { color: "#7B6246", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#162234", fontSize: 24, fontWeight: "900" },
  titleSmall: { color: "#162234", fontSize: 20, fontWeight: "900", flex: 1 },
  body: { color: "#5D6B63", fontSize: 14, lineHeight: 20 },
  badge: { color: "#2E6D2E", fontSize: 12, fontWeight: "900", backgroundColor: "#E6F5E0", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  planCard: { backgroundColor: "#F7F8F4", borderRadius: 22, padding: 16, gap: 10, borderWidth: 1, borderColor: "#DEE4D7" },
  planCardActive: { backgroundColor: "#EAF3E3", borderColor: "#BFD6B1" },
  planTitle: { color: "#223127", fontSize: 16, fontWeight: "900" },
  planBadge: { color: "#587157", fontSize: 11, fontWeight: "900", textTransform: "uppercase", backgroundColor: "#EDF3E6", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  emphasis: { color: "#7B6246", fontSize: 13, fontWeight: "800" },
  metric: { color: "#35522E", fontSize: 14, fontWeight: "800" },
  reason: { color: "#556461", fontSize: 13, lineHeight: 18 },
  input: { minHeight: 54, borderRadius: 18, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#DFE6D8", paddingHorizontal: 16, color: "#223127", fontSize: 16 },
  panelRow: { gap: 12, paddingRight: 8 },
  panel: { width: 150, borderRadius: 20, backgroundColor: "#F4F6EF", borderWidth: 1, borderColor: "#DEE4D7", padding: 14, gap: 8 },
  panelActive: { backgroundColor: "#EAF3E3", borderColor: "#BFD6B1" },
  panelIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#FFF", resizeMode: "contain" },
  emptyIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D7DED0", borderStyle: "dashed" },
  emptyIconText: { color: "#758473", fontSize: 22, fontWeight: "700" },
  inlineBadge: { fontSize: 12, fontWeight: "900" },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: "#FFF", paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#DEE4D7" },
  chipActive: { backgroundColor: "#E6F5E0", borderColor: "#C5DDBB" },
  chipIcon: { width: 20, height: 20, borderRadius: 6, backgroundColor: "#F5F7F2", resizeMode: "contain" },
  chipText: { color: "#4C5C4E", fontSize: 12, fontWeight: "800" },
  primaryButton: { minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#D9EACC" },
  primaryButtonText: { color: "#35522E", fontSize: 14, fontWeight: "900" },
  secondaryButton: { minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FDE2DD" },
  secondaryButtonText: { color: "#B6463A", fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.7 },
  notice: { color: "#2E6D2E", fontSize: 13, fontWeight: "800", lineHeight: 20 },
  savedCard: { borderRadius: 18, backgroundColor: "#F7F8F4", padding: 14, gap: 6 },
  errorText: { color: "#E0675C", fontSize: 14, fontWeight: "700" },
});

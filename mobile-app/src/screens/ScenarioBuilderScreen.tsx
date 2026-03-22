import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
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
import { RootStackParamList } from "../navigation/AppNavigator";
import { addSavedScenario, getSavedScenarioById, getSavedScenarios } from "../scenario/store";
import type { DecisionResponse, ParcelItem, RiskLevel } from "../types/api";
import {
  cropVisuals,
  getCropImageSource,
  getFriendlyParcelName,
  getFriendlyParcelSubtitle,
  riskTone,
  type CropKey,
} from "../utils/farmUi";

type Props = NativeStackScreenProps<RootStackParamList, "ScenarioBuilder">;

type DecisionMap = Record<string, DecisionResponse | undefined>;
type ScenarioCropSelection = CropKey | null;
type ScenarioParcelState = Record<string, ScenarioCropSelection>;
type ResearchPlan = {
  id: string;
  title: string;
  badge: string;
  summary: string;
  emphasis: string;
  selections: ScenarioParcelState;
};

const DEFAULT_SEASON = "2026_Spring";
const cropOptions: CropKey[] = ["corn", "sunflower", "wheat", "barley"];
const palette = {
  red: "#E0675C",
};

function getScenarioCropLabel(crop: ScenarioCropSelection) {
  return crop ? cropVisuals[crop].label : "Boş Parsel";
}

function scoreScenario(
  parcel: ParcelItem,
  crop: ScenarioCropSelection,
  baseline: RiskLevel | "UNKNOWN",
  selections: ScenarioParcelState,
  parcels: ParcelItem[],
) {
  if (!crop) {
    return {
      score: 0,
      riskLevel: "UNKNOWN" as const,
      explanation: [
        "Bu parselde ürün seçimi kaldırıldı.",
        "Şu an mevcut senaryoyu siliyorsunuz, tarlanın tamamını değil.",
        "Boş parsel üstüne yeni ürün seçerek bu parsel için senaryoyu yeniden kurabilirsiniz.",
      ],
    };
  }

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
  const riskLevel: RiskLevel = clamped >= 70 ? "CRITICAL" : clamped >= 50 ? "RISKY" : "OK";

  if (riskLevel === "CRITICAL") {
    explanation.push("Bu kombinasyon kısa vadeli deneme için uygun olabilir ama köy geneline açmadan önce yeniden düşünülmeli.");
  } else if (riskLevel === "RISKY") {
    explanation.push("Bu seçenek denenebilir; sulama, komşu etkisi ve zamanlama birlikte izlenmeli.");
  } else {
    explanation.push("Bu senaryo daha dengeli bir dağılım sağlıyor ve araştırma için güçlü aday.");
  }

  return { score: Math.round(clamped), riskLevel, explanation };
}

function getRecommendedCropForStrategy(
  strategy: "balanced" | "low_risk" | "yield_balance",
  parcel: ParcelItem,
  index: number,
  baseline: RiskLevel | "UNKNOWN",
): CropKey {
  if (strategy === "low_risk") {
    if (baseline === "CRITICAL") {
      return "wheat";
    }
    if (baseline === "RISKY") {
      return index % 2 === 0 ? "barley" : "sunflower";
    }
    return index % 2 === 0 ? "sunflower" : "wheat";
  }

  if (strategy === "yield_balance") {
    if (baseline === "CRITICAL") {
      return "sunflower";
    }
    if (index % 3 === 0) {
      return "corn";
    }
    if (index % 3 === 1) {
      return "sunflower";
    }
    return "wheat";
  }

  if (baseline === "CRITICAL") {
    return "barley";
  }
  if (baseline === "RISKY") {
    return index % 2 === 0 ? "sunflower" : "wheat";
  }
  return index % 4 === 0 ? "corn" : index % 4 === 1 ? "sunflower" : index % 4 === 2 ? "wheat" : "barley";
}

export function ScenarioBuilderScreen({ navigation, route }: Props) {
  const focusParcelId = route.params?.focusParcelId ?? null;
  const scenarioId = route.params?.scenarioId ?? null;
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [parcels, setParcels] = useState<ParcelItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [selections, setSelections] = useState<ScenarioParcelState>({});
  const [savedScenarios, setSavedScenarios] = useState(getSavedScenarios());
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(focusParcelId);
  const [selectedResearchPlanId, setSelectedResearchPlanId] = useState<string | null>(null);

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
        const savedScenario = scenarioId ? getSavedScenarioById(scenarioId) : undefined;
        const savedSelectionMap = savedScenario
          ? Object.fromEntries(savedScenario.parcels.map((parcel) => [parcel.parcelId, parcel.crop]))
          : {};

        setSelections(
          Object.fromEntries(
            myParcels.map((parcel) => [parcel.parcel_id, savedSelectionMap[parcel.parcel_id] ?? null]),
          ),
        );
        setSelectedParcelId(
          (current) =>
            current ??
            focusParcelId ??
            savedScenario?.parcels.find((parcel) => parcel.crop !== null)?.parcelId ??
            myParcels[0]?.parcel_id ??
            null,
        );
        if (savedScenario) {
          setScenarioName(savedScenario.name);
          setNotice(`Kaydedilen "${savedScenario.name}" senaryosu yüklendi.`);
        }
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

  const scenarioRows = useMemo(
    () =>
      parcels.map((parcel) => {
        const crop = selections[parcel.parcel_id] ?? null;
        const baseline = decisions[parcel.parcel_id]?.risk_level ?? "UNKNOWN";
        return {
          parcel,
          crop,
          ...scoreScenario(parcel, crop, baseline, selections, parcels),
        };
      }),
    [decisions, parcels, selections],
  );

  const researchPlans = useMemo<ResearchPlan[]>(
    () =>
      [
        {
          id: "balanced",
          title: "En Dengeli Plan",
          badge: "Graph + ML",
          summary: "Komşu etkisini azaltan ve ürün dağılımını dengeleyen araştırma planı.",
          emphasis: "Rotasyon ve komşu çeşitliliği öncelikli",
        },
        {
          id: "low_risk",
          title: "En Düşük Riskli Plan",
          badge: "Rules First",
          summary: "Kritik alanları daha güvenli ürünlere çekerek temkinli başlangıç sunar.",
          emphasis: "Riskli parselleri yumuşatan güvenli kurgu",
        },
        {
          id: "yield_balance",
          title: "Verim / Risk Dengeli",
          badge: "Hybrid Ready",
          summary: "Verim potansiyelini korurken sınır baskısını azaltan dengeli öneri.",
          emphasis: "Mısır potansiyeli ile kontrollü dağılım",
        },
      ].map((plan, index) => ({
        ...plan,
        selections: Object.fromEntries(
          parcels.map((parcel, parcelIndex) => [
            parcel.parcel_id,
            getRecommendedCropForStrategy(
              plan.id as "balanced" | "low_risk" | "yield_balance",
              parcel,
              parcelIndex + index,
              decisions[parcel.parcel_id]?.risk_level ?? "UNKNOWN",
            ),
          ]),
        ),
      })),
    [decisions, parcels],
  );

  const researchPlanCards = useMemo(
    () =>
      researchPlans.map((plan) => {
        const rows = parcels.map((parcel) => {
          const crop = plan.selections[parcel.parcel_id] ?? null;
          const baseline = decisions[parcel.parcel_id]?.risk_level ?? "UNKNOWN";
          return scoreScenario(parcel, crop, baseline, plan.selections, parcels);
        });
        return {
          ...plan,
          critical: rows.filter((row) => row.riskLevel === "CRITICAL").length,
          risky: rows.filter((row) => row.riskLevel === "RISKY").length,
          ok: rows.filter((row) => row.riskLevel === "OK").length,
        };
      }),
    [decisions, parcels, researchPlans],
  );

  const selectedRow = useMemo(() => {
    if (scenarioRows.length === 0) {
      return undefined;
    }

    return scenarioRows.find((row) => row.parcel.parcel_id === selectedParcelId) ?? scenarioRows[0];
  }, [scenarioRows, selectedParcelId]);

  const scenarioSummary = useMemo(() => {
    if (scenarioRows.length === 0) {
      return "Araştırma senaryosu için parseller yükleniyor.";
    }

    const emptyCount = scenarioRows.filter((row) => row.crop === null).length;
    if (emptyCount === scenarioRows.length) {
      return "Tüm parseller boşaltıldı. Şimdi boş parseller üstüne yeni ürün senaryosu kurabilirsiniz.";
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

  const clearScenario = () => {
    Alert.alert(
      "Senaryoyu Temizle",
      "Şu an mevcut senaryoyu siliyorsunuz, tarlanın tamamını değil. Tüm parseller boşalacak ve boş parsel üstüne yeni senaryo kuracaksınız.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Tümünü Sil",
          style: "destructive",
          onPress: () => {
            setSelections(Object.fromEntries(parcels.map((parcel) => [parcel.parcel_id, null])));
            setSelectedParcelId(parcels[0]?.parcel_id ?? null);
            setSelectedResearchPlanId(null);
            setScenarioName("");
            setNotice("Senaryo temizlendi. Tüm parseller boş başlangıç durumuna döndü.");
          },
        },
      ],
    );
  };

  const applyResearchPlan = (plan: ResearchPlan) => {
    setSelections(plan.selections);
    setSelectedResearchPlanId(plan.id);
    setSelectedParcelId(parcels[0]?.parcel_id ?? null);
    setNotice(`${plan.title} parsellerine uygulandi. ML/AI baglandiginda bu alan gercek optimizer ile beslenecek.`);
  };

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
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Araştırma Alanı</Text>
            <Text style={styles.heroTitle}>Tarlalarında farklı olasılıkları karşılaştır</Text>
            <Text style={styles.heroText}>
              Ekran ilk açıldığında 8 parsel boş gelir. Kullanıcı ürünleri tek tek kendi seçer; istersen tümünü silip
              yeniden aynı boş başlangıç durumuna dönebilirsin.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>AI Destekli Araştırma Planları</Text>
              <View style={styles.sectionPill}>
                <Text style={styles.sectionPillText}>UI Hazır</Text>
              </View>
            </View>
            <Text style={styles.sectionHint}>
              Bu alan şimdilik UI akışı olarak hazırlandı. Gerçek ML/AI ve graph tabanlı optimizer daha sonra aynı kartlara veri sağlayacak.
            </Text>
            <View style={styles.researchPlanStack}>
              {researchPlanCards.map((plan) => (
                <View
                  key={plan.id}
                  style={[
                    styles.researchPlanCard,
                    selectedResearchPlanId === plan.id && styles.researchPlanCardActive,
                  ]}
                >
                  <View style={styles.researchPlanHeader}>
                    <View style={styles.researchPlanCopy}>
                      <Text style={styles.researchPlanTitle}>{plan.title}</Text>
                      <Text style={styles.researchPlanSummary}>{plan.summary}</Text>
                    </View>
                    <View style={styles.researchPlanBadge}>
                      <Text style={styles.researchPlanBadgeText}>{plan.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.researchPlanEmphasis}>{plan.emphasis}</Text>
                  <View style={styles.researchMetricsRow}>
                    <View style={styles.researchMetricChip}>
                      <Text style={styles.researchMetricValue}>{plan.ok}</Text>
                      <Text style={styles.researchMetricLabel}>Dengeli</Text>
                    </View>
                    <View style={styles.researchMetricChip}>
                      <Text style={styles.researchMetricValue}>{plan.risky}</Text>
                      <Text style={styles.researchMetricLabel}>Riskli</Text>
                    </View>
                    <View style={styles.researchMetricChip}>
                      <Text style={styles.researchMetricValue}>{plan.critical}</Text>
                      <Text style={styles.researchMetricLabel}>Kritik</Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.researchPreviewRow}>
                    {parcels.map((parcel) => {
                      const crop = plan.selections[parcel.parcel_id];
                      if (!crop) {
                        return null;
                      }

                      return (
                        <View key={`${plan.id}-${parcel.parcel_id}`} style={styles.researchPreviewChip}>
                          <Image source={getCropImageSource(crop)} style={styles.researchPreviewIcon} />
                          <Text style={styles.researchPreviewText}>{cropVisuals[crop].label}</Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                  <Pressable style={styles.researchApplyButton} onPress={() => applyResearchPlan(plan)}>
                    <Text style={styles.researchApplyButtonText}>Bu Planı Uygula</Text>
                  </Pressable>
                </View>
              ))}
            </View>
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
              {focusParcelId
                ? `${getFriendlyParcelName(focusParcelId)} odaklı bir senaryo üzerinde çalışıyorsun.`
                : "Bu ekran boş parseller üstünde yeni bir senaryo kurman için hazırlandı."}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Parsel Panelleri</Text>
              <View style={styles.sectionPill}>
                <Text style={styles.sectionPillText}>{scenarioRows.length} parsel</Text>
              </View>
            </View>

            {loading ? <Text style={styles.sectionHint}>Parseller yükleniyor...</Text> : null}
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.parcelPanelRow}>
              {scenarioRows.map((row) => {
                const isActive = selectedRow?.parcel.parcel_id === row.parcel.parcel_id;
                const tone = riskTone(row.riskLevel);

                return (
                  <Pressable
                    key={row.parcel.parcel_id}
                    style={[
                      styles.parcelPanel,
                      isActive && styles.parcelPanelActive,
                      focusParcelId === row.parcel.parcel_id && styles.parcelCardFocused,
                    ]}
                    onPress={() => setSelectedParcelId(row.parcel.parcel_id)}
                  >
                    {row.crop ? (
                      <Image source={getCropImageSource(row.crop)} style={styles.parcelPanelIcon} />
                    ) : (
                      <View style={styles.emptyPanelIcon}>
                        <Text style={styles.emptyPanelIconText}>+</Text>
                      </View>
                    )}
                    <Text style={styles.parcelPanelTitle}>{getFriendlyParcelName(row.parcel.parcel_id)}</Text>
                    <Text style={styles.parcelPanelSubtitle}>{getFriendlyParcelSubtitle(row.parcel.parcel_id)}</Text>
                    <View style={[styles.parcelPanelBadge, { backgroundColor: tone.badgeBg }]}>
                      <Text style={[styles.parcelPanelBadgeText, { color: tone.badgeFg }]}>{tone.text}</Text>
                    </View>
                    <View style={styles.inlineCropRow}>
                      {row.crop ? <Image source={getCropImageSource(row.crop)} style={styles.inlineCropIcon} /> : null}
                      <Text style={styles.parcelPanelChoice}>{getScenarioCropLabel(row.crop)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedRow ? (
              <View style={styles.detailCard}>
                <View style={styles.detailHero}>
                  <View style={styles.detailHeroText}>
                    <Text style={styles.detailEyebrow}>Parsel Detayı</Text>
                    <Text style={styles.parcelTitle}>{getFriendlyParcelName(selectedRow.parcel.parcel_id)}</Text>
                    <Text style={styles.parcelSubtitle}>{getFriendlyParcelSubtitle(selectedRow.parcel.parcel_id)}</Text>
                  </View>
                  <View style={[styles.riskBadge, { backgroundColor: riskTone(selectedRow.riskLevel).badgeBg }]}>
                    <Text style={[styles.riskBadgeText, { color: riskTone(selectedRow.riskLevel).badgeFg }]}>
                      {riskTone(selectedRow.riskLevel).text}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Blok</Text>
                    <Text style={styles.infoValue}>{selectedRow.parcel.field_block}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Mevcut plan</Text>
                    <View style={styles.infoValueRow}>
                      <Image
                        source={getCropImageSource(selectedRow.parcel.planned_crop as CropKey)}
                        style={styles.infoValueIcon}
                      />
                      <Text style={styles.infoValue}>{cropVisuals[selectedRow.parcel.planned_crop]?.label ?? "-"}</Text>
                    </View>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Senaryo seçimi</Text>
                    <Text style={styles.infoValue}>{getScenarioCropLabel(selectedRow.crop)}</Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Parsel Bilgileri</Text>
                  <Text style={styles.detailText}>
                    Kullanıcı bu ekranda yalnızca seçilen parselin bilgilerini görür. İlk durumda mevcut tarla görünümü
                    korunur. İstersen ürünü kaldırıp boş parsel üstünden yeni senaryo kurabilirsin.
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Ürün Seçimi</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropRow}>
                    <Pressable
                      style={[styles.cropChip, selections[selectedRow.parcel.parcel_id] === null && styles.cropChipActive]}
                      onPress={() =>
                        setSelections((current) => ({
                          ...current,
                          [selectedRow.parcel.parcel_id]: null,
                        }))
                      }
                    >
                      <View style={styles.cropChipEmptyIcon}>
                        <Text style={styles.cropChipEmptyIconText}>+</Text>
                      </View>
                      <Text
                        style={[
                          styles.cropChipText,
                          selections[selectedRow.parcel.parcel_id] === null && styles.cropChipTextActive,
                        ]}
                      >
                        Boş Parsel
                      </Text>
                    </Pressable>
                    {cropOptions.map((crop) => (
                      <Pressable
                        key={`${selectedRow.parcel.parcel_id}-${crop}`}
                        style={[
                          styles.cropChip,
                          selections[selectedRow.parcel.parcel_id] === crop && styles.cropChipActive,
                        ]}
                        onPress={() =>
                          setSelections((current) => ({
                            ...current,
                            [selectedRow.parcel.parcel_id]: crop,
                          }))
                        }
                      >
                        <Image source={getCropImageSource(crop)} style={styles.cropChipIcon} />
                        <Text
                          style={[
                            styles.cropChipText,
                            selections[selectedRow.parcel.parcel_id] === crop && styles.cropChipTextActive,
                          ]}
                        >
                          {cropVisuals[crop].label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.scoreRow}>
                  <Text style={styles.scoreValue}>Risk skoru: {selectedRow.score}</Text>
                  <View style={styles.inlineCropRow}>
                    {selectedRow.crop ? <Image source={getCropImageSource(selectedRow.crop)} style={styles.inlineCropIcon} /> : null}
                    <Text style={styles.scoreCrop}>Seçim: {getScenarioCropLabel(selectedRow.crop)}</Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Açıklamalar</Text>
                  <View style={styles.explanationBox}>
                    {selectedRow.explanation.map((item, index) => (
                      <Text key={`${selectedRow.parcel.parcel_id}-${index}`} style={styles.explanationText}>
                        • {item}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Araştırma Özeti</Text>
              <Pressable style={styles.clearButton} onPress={clearScenario}>
                <Text style={styles.clearButtonText}>Tümünü Sil</Text>
              </Pressable>
            </View>
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
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  sectionTitle: { color: "#162234", fontSize: 20, fontWeight: "900", flexShrink: 1 },
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
  researchPlanStack: { gap: 12 },
  researchPlanCard: {
    borderRadius: 22,
    backgroundColor: "#F7F8F4",
    borderWidth: 1,
    borderColor: "#DEE4D7",
    padding: 16,
    gap: 12,
  },
  researchPlanCardActive: {
    backgroundColor: "#EAF3E3",
    borderColor: "#BFD6B1",
  },
  researchPlanHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  researchPlanCopy: { flex: 1, gap: 4 },
  researchPlanTitle: { color: "#223127", fontSize: 17, fontWeight: "900" },
  researchPlanSummary: { color: "#5D6B63", fontSize: 14, lineHeight: 20 },
  researchPlanBadge: { borderRadius: 999, backgroundColor: "#EDF3E6", paddingHorizontal: 12, paddingVertical: 8 },
  researchPlanBadgeText: { color: "#587157", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  researchPlanEmphasis: { color: "#7B6246", fontSize: 13, fontWeight: "800" },
  researchMetricsRow: { flexDirection: "row", gap: 10 },
  researchMetricChip: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 4,
    alignItems: "center",
  },
  researchMetricValue: { color: "#223127", fontSize: 18, fontWeight: "900" },
  researchMetricLabel: { color: "#778478", fontSize: 12, fontWeight: "700" },
  researchPreviewRow: { gap: 8, paddingRight: 8 },
  researchPreviewChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  researchPreviewIcon: { width: 20, height: 20, borderRadius: 6, backgroundColor: "#F5F7F2", resizeMode: "contain" },
  researchPreviewText: { color: "#4C5C4E", fontSize: 12, fontWeight: "800" },
  researchApplyButton: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#D9EACC",
    alignItems: "center",
    justifyContent: "center",
  },
  researchApplyButtonText: { color: "#35522E", fontSize: 14, fontWeight: "900" },
  clearButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDE2DD",
  },
  clearButtonText: { color: "#B6463A", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  parcelPanelRow: { gap: 12, paddingRight: 8 },
  parcelPanel: {
    width: 148,
    borderRadius: 22,
    backgroundColor: "#F4F6EF",
    borderWidth: 1,
    borderColor: "#DEE4D7",
    padding: 14,
    gap: 8,
  },
  parcelPanelIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    resizeMode: "contain",
  },
  emptyPanelIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D7DED0",
    borderStyle: "dashed",
  },
  emptyPanelIconText: { color: "#758473", fontSize: 24, fontWeight: "700" },
  parcelPanelActive: {
    backgroundColor: "#EAF3E3",
    borderColor: "#BFD6B1",
  },
  parcelPanelTitle: { color: "#223127", fontSize: 16, fontWeight: "900" },
  parcelPanelSubtitle: { color: "#778478", fontSize: 13, fontWeight: "600" },
  parcelPanelBadge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  parcelPanelBadgeText: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  parcelPanelChoice: { color: "#7B6246", fontSize: 13, fontWeight: "800" },
  parcelCardFocused: { borderWidth: 2, borderColor: "#C5DDBB" },
  detailCard: {
    borderRadius: 24,
    backgroundColor: "#F7F8F4",
    padding: 16,
    gap: 14,
  },
  detailHero: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  detailHeroText: { flex: 1, gap: 2 },
  detailEyebrow: { color: "#7B6246", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  parcelTitle: { color: "#223127", fontSize: 20, fontWeight: "900" },
  parcelSubtitle: { color: "#778478", fontSize: 13, marginTop: 4 },
  riskBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  riskBadgeText: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  infoGrid: { flexDirection: "row", gap: 10 },
  infoCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 6,
  },
  infoLabel: { color: "#7A8679", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  infoValueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoValueIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: "#F5F7F2" },
  infoValue: { color: "#223127", fontSize: 15, fontWeight: "900" },
  detailSection: { gap: 8 },
  detailSectionTitle: { color: "#223127", fontSize: 15, fontWeight: "900" },
  detailText: { color: "#556461", fontSize: 14, lineHeight: 21 },
  cropRow: { gap: 10, paddingRight: 8 },
  cropChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEE4D7",
  },
  cropChipActive: { backgroundColor: "#E6F5E0", borderColor: "#C5DDBB" },
  cropChipIcon: { width: 22, height: 22, borderRadius: 8, backgroundColor: "#F6F8F3", resizeMode: "contain" },
  cropChipEmptyIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: "#F6F8F3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D7DED0",
    borderStyle: "dashed",
  },
  cropChipEmptyIconText: { color: "#758473", fontSize: 14, fontWeight: "700" },
  cropChipText: { color: "#4C5C4E", fontSize: 13, fontWeight: "800" },
  cropChipTextActive: { color: "#2E6D2E" },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  inlineCropRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  inlineCropIcon: { width: 20, height: 20, borderRadius: 6, backgroundColor: "#F5F7F2", resizeMode: "contain" },
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




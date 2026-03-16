import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../api/client";
import { LeafletParcelMap } from "../components/LeafletParcelMap";
import { RootStackParamList } from "../navigation/AppNavigator";
import { getSavedScenarios, type SavedScenario } from "../scenario/store";
import type { DecisionResponse, ParcelItem, RiskLevel } from "../types/api";
import {
  cropVisuals,
  getCropImageSource,
  getCropIconUri,
  getFriendlyParcelName,
  getFriendlyParcelSubtitle,
  getParcelArea,
  riskTone,
  type CropKey,
} from "../utils/farmUi";

type Props = NativeStackScreenProps<RootStackParamList, "VillageParcels">;

const palette = {
  page: "#F3F1E8",
  card: "#FFFDF8",
  line: "#D9D3C3",
  text: "#223127",
  muted: "#6F7C72",
  softGreen: "#DCEFD8",
  green: "#5B8C5A",
  softBrown: "#E8DCC8",
  brown: "#8C6745",
  red: "#E0675C",
  yellow: "#E5B84C",
  safe: "#7FAF6A",
  gray: "#A4AAA1",
};
type DashboardMode = "MY_FIELDS" | "VILLAGE" | "HARVEST" | "SCENARIOS";
type OwnershipFilter = "ALL" | "MINE" | "NEIGHBOR";
type DecisionMap = Record<string, DecisionResponse | undefined>;
type ScenarioCard = {
  id: string;
  crop: CropKey;
  title: string;
  report: string;
};

const DEFAULT_SEASON = "2026_Spring";

const cropOptions: { key: CropKey; label: string }[] = [
  { key: "corn", label: "Mısır" },
  { key: "sunflower", label: "Ayçiçeği" },
  { key: "wheat", label: "Buğday" },
  { key: "barley", label: "Arpa" },
];

const modeMeta: Record<DashboardMode, { eyebrow: string; title: string }> = {
  MY_FIELDS: { eyebrow: "AgroNova", title: "Ana Sayfa" },
  VILLAGE: { eyebrow: "Köy Analizi", title: "Köy Geneli" },
  SCENARIOS: { eyebrow: "Senaryo Merkezi", title: "Kaydedilen Senaryolar" },
  HARVEST: { eyebrow: "Takvim", title: "Hasat Planı" },
};

export function VillageParcelsScreen({ navigation }: Props) {
  const [parcels, setParcels] = useState<ParcelItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<DashboardMode>("MY_FIELDS");
  const [query, setQuery] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("ALL");
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [scenarioCrop, setScenarioCrop] = useState<CropKey>("corn");
  const [scenarioCards] = useState<Record<string, ScenarioCard[]>>({});
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);

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

    const load = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getParcels("v1");
        const decisionEntries = await Promise.all(
          data.parcels.map(async (parcel) => [parcel.parcel_id, await ensureDecision(parcel)] as const),
        );

        if (mounted) {
          setParcels(data.parcels);
          setDecisions(Object.fromEntries(decisionEntries));
          setSelectedParcelId(data.parcels[0]?.parcel_id ?? null);
          setErrorText(null);
        }
      } catch (error) {
        if (mounted) {
          setErrorText(error instanceof Error ? error.message : "Parseller yüklenemedi.");
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

  useFocusEffect(
    useCallback(() => {
      setSavedScenarios(getSavedScenarios());
    }, []),
  );

  const decisionLevel = useCallback(
    (parcelId: string): RiskLevel | "UNKNOWN" => decisions[parcelId]?.risk_level ?? "UNKNOWN",
    [decisions],
  );

  const parcelsWithOwnership = useMemo(
    () =>
      parcels.map((parcel, index) => ({
        parcel,
        isMine: index < Math.ceil(parcels.length / 2),
      })),
    [parcels],
  );

  const filteredParcels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return parcelsWithOwnership.filter(({ parcel, isMine }) => {
      const ownershipMatch =
        ownershipFilter === "ALL" ||
        (ownershipFilter === "MINE" && isMine) ||
        (ownershipFilter === "NEIGHBOR" && !isMine);
      const cropLabel = (cropVisuals[parcel.planned_crop]?.label ?? parcel.planned_crop).toLowerCase();
      const textMatch =
        normalized.length === 0 ||
        getFriendlyParcelName(parcel.parcel_id).toLowerCase().includes(normalized) ||
        getFriendlyParcelSubtitle(parcel.parcel_id).toLowerCase().includes(normalized) ||
        cropLabel.includes(normalized);
      return ownershipMatch && textMatch;
    });
  }, [ownershipFilter, parcelsWithOwnership, query]);

  const selectedEntry = useMemo(
    () =>
      filteredParcels.find((item) => item.parcel.parcel_id === selectedParcelId) ??
      parcelsWithOwnership.find((item) => item.parcel.parcel_id === selectedParcelId) ??
      filteredParcels[0] ??
      parcelsWithOwnership[0] ??
      null,
    [filteredParcels, parcelsWithOwnership, selectedParcelId],
  );

  useEffect(() => {
    if (selectedEntry && selectedEntry.parcel.parcel_id !== selectedParcelId) {
      setSelectedParcelId(selectedEntry.parcel.parcel_id);
    }
  }, [selectedEntry, selectedParcelId]);

  const selectedParcel = selectedEntry?.parcel ?? null;
  const selectedIsMine = selectedEntry?.isMine ?? false;
  const selectedLevel = selectedParcel ? decisionLevel(selectedParcel.parcel_id) : "UNKNOWN";
  const selectedTone = riskTone(selectedLevel);
  const selectedCropKey = (selectedParcel?.planned_crop ?? "wheat") as CropKey;
  const selectedVisual = cropVisuals[selectedCropKey] ?? cropVisuals.wheat;
  const selectedScenarios = selectedParcel ? scenarioCards[selectedParcel.parcel_id] ?? [] : [];

  const summary = useMemo(
    () => ({
      mine: parcelsWithOwnership.filter((item) => item.isMine).length,
      neighbor: parcelsWithOwnership.filter((item) => !item.isMine).length,
      critical: parcels.filter((parcel) => decisionLevel(parcel.parcel_id) === "CRITICAL").length,
    }),
    [decisionLevel, parcels, parcelsWithOwnership],
  );

  const myParcels = filteredParcels.filter((item) => item.isMine);
  const neighborParcels = filteredParcels.filter((item) => !item.isMine);
  const moisture = Math.max(52, 72 - summary.critical * 4);
  const airQuality = Math.max(11, 18 - summary.critical * 2);
  const waterLevel = Math.max(61, 84 - summary.neighbor);
  const weatherLabel = summary.critical > 1 ? "Kontrollü" : "Güneşli";
  const weatherNote =
    summary.critical > 1
      ? "Bugün riskli alanları gözden geçirmek ve senaryo üretmek için uygun."
      : "Bugün hava çiftçilik planlaması ve arazi kontrolü için ideal.";
  const villageStatus = summary.critical === 0 ? "Mükemmel" : summary.critical < 3 ? "Dengeli" : "İzlenmeli";
  const openScenarioBuilder = () =>
    navigation.navigate("ScenarioBuilder", { focusParcelId: selectedParcel?.parcel_id ?? undefined });

  const renderSavedScenarios = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Kaydedilen Senaryolar</Text>
      <Text style={styles.sectionSubtitle}>
        Senaryo oluşturucuda kaydettiğin kombinasyonlara buradan tekrar ulaşıp inceleyebilirsin.
      </Text>

      {savedScenarios.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Henüz kayıtlı senaryo yok</Text>
          <Text style={styles.emptyStateText}>
            Önce bir araştırma senaryosu oluştur ve kaydet. Sonra bu panelden tüm kayıtlarına geri dönebilirsin.
          </Text>
          <Pressable style={styles.primaryButton} onPress={openScenarioBuilder}>
            <Text style={styles.primaryButtonText}>Senaryo Oluştur</Text>
          </Pressable>
        </View>
      ) : (
        savedScenarios.map((scenario) => (
          <Pressable
            key={scenario.id}
            style={styles.savedScenarioCard}
            onPress={() => navigation.navigate("ScenarioBuilder", { focusParcelId: scenario.parcels[0]?.parcelId })}
          >
            <View style={styles.savedScenarioHeader}>
              <Text style={styles.savedScenarioTitle}>{scenario.name}</Text>
              <Text style={styles.savedScenarioMeta}>{scenario.createdAt}</Text>
            </View>
            <Text style={styles.savedScenarioSummary}>{scenario.summary}</Text>
            <Text style={styles.savedScenarioCount}>{scenario.parcels.length} parsel senaryosu</Text>
          </Pressable>
        ))
      )}
    </View>
  );

  const renderProfessionalHome = () => (
    <>
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeIdentity}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarGlyph}>🌿</Text>
          </View>
          <View style={styles.welcomeCopy}>
            <Text style={styles.welcomeTitle}>Hoş Geldiniz!</Text>
            <Text style={styles.welcomeLocation}>Sakarya, TR</Text>
          </View>
        </View>
        <View style={styles.notificationButton}>
          <Text style={styles.notificationButtonText}>◔</Text>
        </View>
      </View>

      <View style={styles.weatherCard}>
        <View style={styles.weatherCopy}>
          <Text style={styles.weatherTitle}>24°C {weatherLabel}</Text>
          <Text style={styles.weatherNote}>{weatherNote}</Text>
        </View>
        <View style={styles.weatherIconWrap}>
          <Text style={styles.weatherIcon}>☀</Text>
        </View>
      </View>

      <View style={styles.healthCard}>
        <View style={styles.healthHeader}>
          <Text style={styles.healthTitle}>Köy Sağlığı</Text>
          <View style={styles.healthBadge}>
            <Text style={styles.healthBadgeText}>Durum: {villageStatus}</Text>
          </View>
        </View>
        <View style={styles.healthMetrics}>
          <View style={styles.healthMetric}>
            <Text style={styles.healthMetricLabel}>Toprak Nem</Text>
            <Text style={styles.healthMetricValue}>%{moisture}</Text>
          </View>
          <View style={styles.healthDivider} />
          <View style={styles.healthMetric}>
            <Text style={styles.healthMetricLabel}>Hava Kalitesi</Text>
            <Text style={styles.healthMetricValue}>AQI {airQuality}</Text>
          </View>
          <View style={styles.healthDivider} />
          <View style={styles.healthMetric}>
            <Text style={styles.healthMetricLabel}>Su Seviyesi</Text>
            <Text style={styles.healthMetricValue}>%{waterLevel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.heroShell}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleWrap}>
            <Text style={styles.heroEyebrow}>Arazi Haritası</Text>
            <Text style={styles.heroTitle}>Parsel detaylarını incele</Text>
          </View>
          <View style={styles.mapIconBadge}>
            <Text style={styles.mapIconBadgeText}>▣</Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Parsel veya blok ara..."
            placeholderTextColor="#7E887D"
            style={styles.searchInput}
          />
        </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {[
              { key: "ALL" as const, label: "Tüm Parseller" },
              { key: "MINE" as const, label: "Tarlalarım" },
              { key: "NEIGHBOR" as const, label: "Komşu Tarlalar" },
            ].map((item) => (
              <Pressable
                key={item.key}
                style={[styles.filterChip, ownershipFilter === item.key && styles.filterChipActive]}
                onPress={() => setOwnershipFilter(item.key)}
            >
              <Text style={[styles.filterChipText, ownershipFilter === item.key && styles.filterChipTextActive]}>
                {item.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.scenarioInlineButton}
              onPress={openScenarioBuilder}
            >
              <View style={styles.scenarioInlinePlus}>
                <Text style={styles.scenarioInlinePlusText}>+</Text>
              </View>
              <Text style={styles.scenarioInlineText}>Senaryo Oluştur</Text>
            </Pressable>
          </ScrollView>

        <View style={styles.mapCard}>
          <View style={styles.mapWrap}>
            <LeafletParcelMap
              items={filteredParcels.map((item) => ({
                parcel: item.parcel,
                riskLevel: decisionLevel(item.parcel.parcel_id),
                isMine: item.isMine,
                cropKey: item.parcel.planned_crop as CropKey,
              }))}
              selectedParcelId={selectedParcel?.parcel_id}
              onParcelPress={setSelectedParcelId}
            />
          </View>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.mapLegendChip}>
            <View style={styles.legendDotHealthy} />
            <Text style={styles.mapLegendChipText}>Sağlıklı</Text>
          </View>
          <View style={styles.mapLegendChip}>
            <View style={styles.legendDotRisky} />
            <Text style={styles.mapLegendChipText}>Riskli</Text>
          </View>
          <View style={styles.mapLegendChip}>
            <View style={styles.legendDotCritical} />
            <Text style={styles.mapLegendChipText}>Kritik</Text>
          </View>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={styles.legendSwatchMine} />
            <Text style={styles.legendText}>Benim tarlam</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendSwatchNeighbor} />
            <Text style={styles.legendText}>Komşu parsel</Text>
          </View>
        </View>
      </View>

      <View style={styles.selectionCard}>
        {loading ? <ActivityIndicator color={palette.green} /> : null}
        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        {selectedParcel ? (
          <>
            <View style={styles.selectionHeader}>
              <View style={styles.selectionLead}>
                <View style={styles.selectionIconCircle}>
                  <Image
                    source={getCropImageSource(selectedCropKey, selectedLevel === "CRITICAL" ? "wilted" : "normal")}
                    style={styles.selectionLeadIcon}
                  />
                </View>
                <View style={styles.selectionCopy}>
                  <Text style={styles.selectionTitle}>{getFriendlyParcelName(selectedParcel.parcel_id)}</Text>
                  <Text style={styles.selectionSubtitle}>
                    {selectedVisual.label} Tarlası • {getParcelArea(selectedParcel.parcel_id)}
                  </Text>
                </View>
              </View>
              <View style={[styles.riskBadge, { backgroundColor: selectedTone.badgeBg }]}>
                <Text style={[styles.riskBadgeText, { color: selectedTone.badgeFg }]}>{selectedTone.text}</Text>
              </View>
            </View>

            <View style={styles.selectionStatsRow}>
              <View style={styles.selectionMetricCard}>
                <Text style={styles.selectionMetricLabel}>Nem</Text>
                <Text style={styles.selectionMetricValue}>%{Math.max(48, moisture - 3)}</Text>
              </View>
              <View style={styles.selectionMetricCard}>
                <Text style={styles.selectionMetricLabel}>Sıcaklık</Text>
                <Text style={styles.selectionMetricValue}>24°C</Text>
              </View>
              <View style={styles.selectionMetricCard}>
                <Text style={styles.selectionMetricLabel}>Hasat</Text>
                <Text style={styles.selectionMetricValue}>{10 + summary.mine} G.</Text>
              </View>
            </View>

            <View style={styles.selectionBodyCard}>
              <View style={[styles.ownershipMarker, selectedIsMine ? styles.ownershipMine : styles.ownershipNeighbor]}>
                <Text style={[styles.ownershipMarkerText, selectedIsMine ? styles.ownershipMineText : styles.ownershipNeighborText]}>
                  {selectedIsMine ? "Benim alanım" : "Komşu alan"}
                </Text>
              </View>
              <Text style={styles.recommendationText}>
                {selectedLevel === "CRITICAL"
                  ? "Bu parselde risk yüksek. Karar öncesi komşu etkisini ve alternatif ürünü kontrol et."
                  : selectedLevel === "RISKY"
                    ? "Parsel gözlem istiyor. Karar vermeden önce bir senaryo oluşturmak faydalı olur."
                    : "Parsel dengeli görünüyor. Şimdi detay ya da senaryo karşılaştırmasına geçebilirsin."}
              </Text>
            </View>

            <View style={styles.primaryActionsRow}>
              <Pressable
                style={styles.primaryButton}
                onPress={() =>
                  navigation.navigate("Decision", {
                    parcelId: selectedParcel.parcel_id,
                    season: DEFAULT_SEASON,
                  })
                }
              >
                <Text style={styles.primaryButtonText}>Parsel Detayı</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={openScenarioBuilder}>
                <Text style={styles.secondaryButtonText}>Araştırma Senaryosu</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Kolektif Planlar</Text>
        <Text style={styles.sectionSubtitle}>Senaryo ekranında farklı ürün kombinasyonları oluştur, risk açıklamalarını incele ve kaydet.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropPickerRow}>
          {cropOptions.map((option) => (
            <Pressable
              key={option.key}
              style={[styles.cropOptionCard, scenarioCrop === option.key && styles.cropOptionCardActive]}
              onPress={() => setScenarioCrop(option.key)}
            >
              <Image source={getCropImageSource(option.key)} style={styles.cropOptionImage} />
              <Text style={styles.cropOptionLabel}>{option.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {selectedScenarios.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Senaryo ekranından başlayabilirsin</Text>
            <Text style={styles.emptyStateText}>Yukarıdaki butonla araştırma ekranını açıp parseller üstünde farklı olasılıkları deneyebilirsin.</Text>
          </View>
        ) : (
          selectedScenarios.map((scenario) => (
            <View key={scenario.id} style={styles.scenarioCard}>
              <Text style={styles.scenarioTitle}>{scenario.title}</Text>
              <Text style={styles.scenarioCrop}>{cropVisuals[scenario.crop].label}</Text>
              <Text style={styles.scenarioReport}>{scenario.report}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Hızlı Özet</Text>
        <View style={styles.summaryRows}>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Tarlalarım</Text>
            <Text style={styles.summaryValue}>{myParcels.length}</Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Komşu tarlalar</Text>
            <Text style={styles.summaryValue}>{neighborParcels.length}</Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Seçili parsel</Text>
            <Text style={styles.summaryValue}>{selectedParcel ? getFriendlyParcelName(selectedParcel.parcel_id) : "-"}</Text>
          </View>
        </View>
      </View>
    </>
  );

  const renderPlaceholder = (title: string, body: string) => (
    <View style={styles.placeholderCard}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderText}>{body}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => setDrawerOpen(true)}>
            <Text style={styles.headerButtonText}>≡</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>{modeMeta[mode].eyebrow}</Text>
            <Text style={styles.headerTitle}>{modeMeta[mode].title}</Text>
          </View>
          <View style={styles.headerGhost}>
            <Text style={styles.headerGhostText}>✕</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {mode === "MY_FIELDS"
            ? renderProfessionalHome()
            : mode === "VILLAGE"
              ? renderPlaceholder(
                  "Köy geneli ikinci adım",
                  "Bu ekranı bir sonraki turda aynı profesyonel tasarım diliyle, toplu harita ve istatistik mantığıyla kuracağız.",
                )
              : mode === "SCENARIOS"
                ? renderSavedScenarios()
              : renderPlaceholder(
                  "Hasat planı ikinci adım",
                  "Ana sayfayı profesyonel seviyeye aldıktan sonra hasat planını aynı görsel sistemle ilerleteceğim.",
                )}
        </ScrollView>
      </View>

      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)}>
          <Pressable style={styles.drawerPanel} onPress={() => undefined}>
            <Text style={styles.drawerTitle}>Paneller</Text>
            {[
              { key: "MY_FIELDS" as const, label: "Kendi Tarlam" },
              { key: "VILLAGE" as const, label: "Köy Geneli" },
              { key: "SCENARIOS" as const, label: "Kaydedilen Senaryolar" },
              { key: "HARVEST" as const, label: "Hasat Planı" },
            ].map((item) => (
              <Pressable
                key={item.key}
                style={[styles.drawerItem, mode === item.key && styles.drawerItemActive]}
                onPress={() => {
                  setMode(item.key);
                  setDrawerOpen(false);
                }}
              >
                <Text style={[styles.drawerItemText, mode === item.key && styles.drawerItemTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EEF2E7" },
  page: { flex: 1, backgroundColor: "#EEF2E7" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#F8FAF4",
  },
  headerButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  headerButtonText: { color: "#263227", fontSize: 28, fontWeight: "700" },
  headerCopy: { flex: 1 },
  headerEyebrow: { color: "#7A6546", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.9 },
  headerTitle: { color: "#162234", fontSize: 23, fontWeight: "900", marginTop: 2 },
  headerGhost: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDF3E6",
  },
  headerGhostText: { color: "#587157", fontSize: 18, fontWeight: "700" },
  content: { paddingHorizontal: 18, paddingTop: 18, gap: 18, paddingBottom: 32 },
  welcomeCard: {
    borderRadius: 30,
    backgroundColor: "#FCFCF9",
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  welcomeIdentity: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6DCCF",
  },
  avatarGlyph: { fontSize: 28 },
  welcomeCopy: { gap: 3 },
  welcomeTitle: { color: "#162234", fontSize: 20, fontWeight: "900" },
  welcomeLocation: { color: "#6B8B61", fontSize: 14, fontWeight: "700" },
  notificationButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationButtonText: { color: "#56657A", fontSize: 20, fontWeight: "700" },
  weatherCard: {
    borderRadius: 34,
    backgroundColor: "#EEF4EA",
    paddingHorizontal: 24,
    paddingVertical: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DCE6D3",
  },
  weatherCopy: { flex: 1, paddingRight: 16, gap: 8 },
  weatherTitle: { color: "#345B31", fontSize: 24, fontWeight: "900" },
  weatherNote: { color: "#5E6D67", fontSize: 15, lineHeight: 22 },
  weatherIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "rgba(255, 232, 160, 0.26)",
    alignItems: "center",
    justifyContent: "center",
  },
  weatherIcon: { fontSize: 42, color: "#E2B618" },
  healthCard: {
    borderRadius: 34,
    backgroundColor: "#FCFCF9",
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 18,
  },
  healthHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  healthTitle: { color: "#162234", fontSize: 22, fontWeight: "900" },
  healthBadge: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#DFF7D9",
  },
  healthBadgeText: { color: "#378449", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  healthMetrics: { flexDirection: "row", alignItems: "stretch" },
  healthMetric: { flex: 1, alignItems: "center", gap: 10 },
  healthMetricLabel: { color: "#8A95A4", fontSize: 13, fontWeight: "600" },
  healthMetricValue: { color: "#2E6132", fontSize: 18, fontWeight: "900" },
  healthDivider: { width: 1, backgroundColor: "#E4E8DF", marginHorizontal: 4 },
  heroShell: {
    borderRadius: 34,
    backgroundColor: "#FCFCF9",
    padding: 18,
    gap: 16,
  },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  heroTitleWrap: { flex: 1 },
  heroEyebrow: { color: "#7B6246", fontSize: 12, fontWeight: "800" },
  heroTitle: { color: "#162234", fontSize: 20, fontWeight: "900", marginTop: 6 },
  mapIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E8F0E1",
    alignItems: "center",
    justifyContent: "center",
  },
  mapIconBadgeText: { color: "#466842", fontSize: 20, fontWeight: "800" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
  },
  searchIcon: { color: "#62728A", fontSize: 22, marginRight: 10 },
  searchInput: { flex: 1, color: "#1F2C21", fontSize: 17 },
  filterRow: { gap: 10, paddingRight: 8 },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E9E2",
  },
  filterChipActive: { backgroundColor: "#E6F5E0", borderColor: "#C5DDBB" },
  filterChipText: { color: "#334136", fontSize: 14, fontWeight: "800" },
  filterChipTextActive: { color: "#2E6D2E" },
  scenarioInlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#EFE5D7",
    borderWidth: 1,
    borderColor: "#E1D5C4",
  },
  scenarioInlinePlus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#7B6246",
    alignItems: "center",
    justifyContent: "center",
  },
  scenarioInlinePlusText: {
    color: "#FFFDF8",
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "900",
  },
  scenarioInlineText: {
    color: "#7B6246",
    fontSize: 14,
    fontWeight: "900",
  },
  mapCard: {
    borderRadius: 28,
    backgroundColor: "#F3F6EE",
    padding: 10,
  },
  mapWrap: {
    minHeight: 290,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#D9E2D3",
  },
  mapLegendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  mapLegendChipText: { color: "#263227", fontSize: 13, fontWeight: "800" },
  legendDotHealthy: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#4FD66F" },
  legendDotRisky: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#FFD53D" },
  legendDotCritical: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#FF7070" },
  legendRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  legendSwatchMine: { width: 16, height: 16, borderRadius: 6, backgroundColor: "#83B56F", borderWidth: 2, borderColor: "#2F7D44" },
  legendSwatchNeighbor: { width: 16, height: 16, borderRadius: 6, backgroundColor: "#D7D0C4", borderWidth: 2, borderColor: "#8F7A62" },
  legendText: { color: "#556553", fontSize: 13, fontWeight: "800" },
  selectionCard: {
    marginTop: 0,
    marginHorizontal: 0,
    backgroundColor: "#FFFDF8",
    borderRadius: 34,
    padding: 20,
    gap: 16,
  },
  selectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  selectionLead: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  selectionIconCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#EEF4E8", alignItems: "center", justifyContent: "center" },
  selectionLeadIcon: { width: 48, height: 48 },
  selectionCopy: { flex: 1 },
  selectionTitle: { color: "#162234", fontSize: 18, fontWeight: "900" },
  selectionSubtitle: { color: "#7B8895", fontSize: 14, marginTop: 4 },
  riskBadge: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  riskBadgeText: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  selectionStatsRow: { flexDirection: "row", gap: 10 },
  selectionMetricCard: { flex: 1, borderRadius: 22, backgroundColor: "#F7F8F4", paddingHorizontal: 14, paddingVertical: 16, gap: 6 },
  selectionMetricLabel: { color: "#93A0AD", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  selectionMetricValue: { color: "#2E6132", fontSize: 18, fontWeight: "900" },
  selectionBodyCard: { borderRadius: 22, backgroundColor: "#F2F5EE", padding: 16, gap: 12 },
  ownershipMarker: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  ownershipMine: { backgroundColor: "#E5F4E0" },
  ownershipNeighbor: { backgroundColor: "#F4ECE0" },
  ownershipMarkerText: { fontSize: 12, fontWeight: "900" },
  ownershipMineText: { color: "#3E6F38" },
  ownershipNeighborText: { color: "#7B6246" },
  recommendationText: { color: "#556461", fontSize: 14, lineHeight: 21 },
  primaryActionsRow: { flexDirection: "row", gap: 12 },
  primaryButton: { flex: 1, minHeight: 56, borderRadius: 20, backgroundColor: "#BFD9B8", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#35522E", fontSize: 15, fontWeight: "900" },
  secondaryButton: { flex: 1, minHeight: 56, borderRadius: 20, backgroundColor: "#EFE5D7", alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#7B6246", fontSize: 15, fontWeight: "900" },
  sectionCard: { backgroundColor: "#FCFCF9", borderRadius: 30, padding: 20, gap: 16 },
  sectionTitle: { color: "#162234", fontSize: 22, fontWeight: "900" },
  sectionSubtitle: { color: "#6B7A67", fontSize: 14, lineHeight: 20 },
  cropPickerRow: { gap: 12 },
  cropOptionCard: { width: 120, borderRadius: 24, backgroundColor: "#F7F4EC", borderWidth: 1, borderColor: "#DDD8CC", padding: 12, gap: 10 },
  cropOptionCardActive: { backgroundColor: "#EBF6E8", borderColor: "#B7D2B0" },
  cropOptionImage: { width: "100%", height: 72, borderRadius: 18, backgroundColor: "#FFFFFF" },
  cropOptionLabel: { color: "#283627", fontSize: 13, fontWeight: "800", textAlign: "center" },
  emptyState: { borderRadius: 22, backgroundColor: "#F3F4EF", padding: 18, gap: 8 },
  emptyStateTitle: { color: "#2A382A", fontSize: 17, fontWeight: "800" },
  emptyStateText: { color: "#6B7A67", fontSize: 14, lineHeight: 21 },
  scenarioCard: { borderRadius: 22, backgroundColor: "#FFFEFB", borderWidth: 1, borderColor: "#E7E1D6", padding: 16, gap: 8 },
  scenarioTitle: { color: "#243224", fontSize: 18, fontWeight: "800" },
  scenarioCrop: { color: "#7B6246", fontSize: 13, fontWeight: "700" },
  scenarioReport: { color: "#5F6D61", fontSize: 14, lineHeight: 21 },
  savedScenarioCard: { borderRadius: 22, backgroundColor: "#FFFEFB", borderWidth: 1, borderColor: "#E7E1D6", padding: 16, gap: 10 },
  savedScenarioHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  savedScenarioTitle: { color: "#243224", fontSize: 18, fontWeight: "900", flex: 1 },
  savedScenarioMeta: { color: "#7B8895", fontSize: 12, fontWeight: "700" },
  savedScenarioSummary: { color: "#5F6D61", fontSize: 14, lineHeight: 21 },
  savedScenarioCount: { color: "#7B6246", fontSize: 13, fontWeight: "800" },
  summaryRows: { gap: 10 },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#F4F5F0",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  summaryLabel: { color: "#667565", fontSize: 14, fontWeight: "700" },
  summaryValue: { color: "#233123", fontSize: 15, fontWeight: "900" },
  placeholderCard: { minHeight: 260, borderRadius: 30, backgroundColor: "#F9FAF6", padding: 24, justifyContent: "center", gap: 10 },
  placeholderTitle: { color: "#1C2B1D", fontSize: 22, fontWeight: "900" },
  placeholderText: { color: "#6B7A67", fontSize: 15, lineHeight: 22 },
  errorText: { color: palette.red, fontSize: 14, fontWeight: "700" },
  drawerBackdrop: { flex: 1, backgroundColor: "rgba(16, 25, 17, 0.26)", justifyContent: "flex-start" },
  drawerPanel: {
    width: "72%",
    backgroundColor: "#FFFEFB",
    paddingTop: 74,
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 14,
    minHeight: "100%",
  },
  drawerTitle: { color: "#1C2B1D", fontSize: 22, fontWeight: "900", marginBottom: 8 },
  drawerItem: { borderRadius: 18, backgroundColor: "#F1F3ED", paddingHorizontal: 16, paddingVertical: 16 },
  drawerItemActive: { backgroundColor: "#DCEFD8" },
  drawerItemText: { color: "#263227", fontSize: 16, fontWeight: "800" },
  drawerItemTextActive: { color: "#375436" },
});




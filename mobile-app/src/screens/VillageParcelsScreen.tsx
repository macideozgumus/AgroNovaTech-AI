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
import { clearAuthSession, loadAuthProfile } from "../api/cache";
import { LeafletParcelMap } from "../components/LeafletParcelMap";
import { sortReasonCodes } from "../components/reasons";
import { RootStackParamList } from "../navigation/AppNavigator";
import type { DecisionResponse, HarvestPlan as ApiHarvestPlan, ParcelItem, RiskLevel, ScenarioItem, UserSummary } from "../types/api";
import {
  cropVisuals,
  getCropImageSource,
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
type DashboardMode = "MY_FIELDS" | "VILLAGE" | "HARVEST" | "SCENARIOS" | "SUMMARY" | "GUIDE" | "NEIGHBORS";
type OwnershipFilter = "ALL" | "MINE" | "NEIGHBOR";
type DecisionMap = Record<string, DecisionResponse | undefined>;
type ScenarioCard = {
  id: string;
  crop: CropKey;
  title: string;
  report: string;
};
type ParcelDraft = {
  cropKey: CropKey;
  neighborEnabled: boolean;
};
type VillageGroupKey = "MINE" | "NEIGHBOR";
type HarvestAlertTone = "urgent" | "soon" | "ready";
type HarvestPlanView = {
  id: string;
  title: string;
  parcelId: string;
  cropKey: CropKey;
  date: string;
  note: string;
  reminder: string;
  tone: HarvestAlertTone;
};

const harvestMonthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const harvestWeekDays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatHarvestDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getDate()} ${harvestMonthNames[date.getMonth()]} ${date.getFullYear()}`;
};

const formatHarvestMonthYear = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return `${harvestMonthNames[date.getMonth()]} ${date.getFullYear()}`;
};

const getHarvestRelativeLabel = (value: string) => {
  const today = new Date("2026-03-22T00:00:00");
  const target = new Date(`${value}T00:00:00`);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff <= 0) {
    return "Bugün";
  }
  if (diff === 1) {
    return "Yarın";
  }
  return `${diff} gün sonra`;
};

const getHarvestTone = (relativeLabel: string): HarvestAlertTone =>
  relativeLabel === "Bugün" || relativeLabel === "Yarın"
    ? "urgent"
    : relativeLabel.includes("gün")
      ? "soon"
      : "ready";

const toHarvestPlanView = (plan: ApiHarvestPlan, parcels: ParcelItem[]): HarvestPlanView => {
  const parcel = parcels.find((item) => item.parcel_id === plan.parcel_id);
  const cropKey = (parcel?.planned_crop ?? "wheat") as CropKey;
  const reminder = getHarvestRelativeLabel(plan.planned_date);
  return {
    id: plan.id,
    title: plan.title,
    parcelId: plan.parcel_id,
    cropKey,
    date: plan.planned_date,
    note: plan.notes,
    reminder,
    tone: getHarvestTone(reminder),
  };
};

const DEFAULT_SEASON = "2026_Spring";

const cropOptions: { key: CropKey; label: string }[] = [
  { key: "corn", label: "Mısır" },
  { key: "sunflower", label: "Ayçiçeği" },
  { key: "wheat", label: "Buğday" },
  { key: "barley", label: "Arpa" },
];

const cropGuideContent: Record<CropKey, { title: string; summary: string; bullets: string[] }> = {
  corn: {
    title: "Mısır Genel Bilgileri",
    summary: "Mısır yüksek enerji isteyen bir ürün. Su ve komşu baskısı birlikte değerlendirilmelidir.",
    bullets: [
      "Sıcak dönemde verim potansiyeli yüksektir.",
      "Yoğun tek ürün deseninde hastalık baskısı artabilir.",
      "Sulama ve besleme planı güçlü olmalıdır.",
    ],
  },
  sunflower: {
    title: "Ayçiçeği Genel Bilgileri",
    summary: "Ayçiçeği daha dengeli rotasyon planlarında güçlü bir alternatiftir.",
    bullets: [
      "Yağlık üretim için iyi bir tercihtir.",
      "Komşu ürün çeşitliliğine katkı sağlar.",
      "Toprak ve iklim dengesi uygunsa stabil sonuç verir.",
    ],
  },
  wheat: {
    title: "Buğday Genel Bilgileri",
    summary: "Buğday serin dönem planlarında daha istikrarlı ve düşük riskli görünür.",
    bullets: [
      "Erken planlama ile güçlü verim sağlar.",
      "Köy genelinde dengeli dağılıma destek olur.",
      "Komşu baskısı mısıra göre daha kontrollüdür.",
    ],
  },
  barley: {
    title: "Arpa Genel Bilgileri",
    summary: "Arpa hızlı çevrimli ve serin dönem koşullarına uygun bir alternatif üründür.",
    bullets: [
      "Riskli parsellerde yükü hafifletebilir.",
      "Rotasyon senaryolarında faydalı olabilir.",
      "Toprak kullanım dengesini korumaya yardımcı olur.",
    ],
  },
};

const modeMeta: Record<DashboardMode, { eyebrow: string; title: string }> = {
  MY_FIELDS: { eyebrow: "AgroNova", title: "Ana Sayfa" },
  VILLAGE: { eyebrow: "Köy Analizi", title: "Köy Geneli" },
  SCENARIOS: { eyebrow: "Senaryo Merkezi", title: "Kaydedilen Senaryolar" },
  HARVEST: { eyebrow: "Takvim", title: "Hasat Planı" },
  SUMMARY: { eyebrow: "Hızlı Bakış", title: "Hızlı Özet" },
  GUIDE: { eyebrow: "Destek", title: "Kullanım Kılavuzu" },
  NEIGHBORS: { eyebrow: "Topluluk", title: "Komşu Kullanıcılar" },
};

const reasonCopyMap: Record<string, { title: string; detail: string }> = {
  INTER_BLOCK_BORDER_CONFLICT: {
    title: "Sınır tarla baskısı var",
    detail: "Komşu blokta uyumsuz ürün etkisi görüldüğü için bu parsel sınır baskısı altında kalıyor.",
  },
  INTRA_BLOCK_CONFLICT: {
    title: "Yakın parseller birbiriyle çakışıyor",
    detail: "Aynı blok içindeki ürün dağılımı komşu parseller arasında baskı oluşturuyor.",
  },
  HIGH_DENSITY_CLUSTERING: {
    title: "Aynı ürün fazla yoğunlaştı",
    detail: "Benzer ürünlerin kümelenmesi hastalık, verim ve komşuluk riskini artırıyor.",
  },
  VILLAGE_DISTRIBUTION_PRESSURE: {
    title: "Köy genelinde dağılım dengesiz",
    detail: "Bu ürün tercihi köy genelindeki dengeyi zorladığı için dikkatli planlama gerekiyor.",
  },
};

const riskStatusCopy: Record<RiskLevel | "UNKNOWN", { title: string; detail: string }> = {
  OK: {
    title: "Sağlıklı görünüyor",
    detail: "Bu parselde belirgin bir çakışma görünmüyor. Mevcut ürün ve komşuluk ilişkisi dengeli ilerliyor.",
  },
  RISKY: {
    title: "İzlenmesi gerekiyor",
    detail: "Bu parselde orta seviyede baskı var. Ürün tercihi ve komşu ilişkisi birlikte gözden geçirilmeli.",
  },
  CRITICAL: {
    title: "Kritik uyarı var",
    detail: "Bu parselde yüksek risk oluşmuş durumda. Karar vermeden önce alternatif ürün veya komşu etkisi mutlaka kontrol edilmeli.",
  },
  UNKNOWN: {
    title: "Henüz karar üretilmedi",
    detail: "Bu parsel için güncel risk değerlendirmesi henüz hazır değil.",
  },
};

const getReasonExplanation = (code: string) =>
  reasonCopyMap[code] ?? {
    title: "Ek kontrol öneriliyor",
    detail: "Bu parsel için ek bir değerlendirme nedeni oluştu. Senaryo karşılaştırmasıyla kontrol et.",
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
  const [villageMapFit, setVillageMapFit] = useState<"all" | "mine">("all");
  const [scenarioCrop, setScenarioCrop] = useState<CropKey>("corn");
  const [scenarioCards] = useState<Record<string, ScenarioCard[]>>({});
  const [savedScenarios, setSavedScenarios] = useState<ScenarioItem[]>([]);
  const [healthDetailOpen, setHealthDetailOpen] = useState(false);
  const [parcelDrafts, setParcelDrafts] = useState<Record<string, ParcelDraft>>({});
  const [parcelDetailOpen, setParcelDetailOpen] = useState(false);
  const [cropGuideOpen, setCropGuideOpen] = useState(false);
  const [cropGuideCrop, setCropGuideCrop] = useState<CropKey>("corn");
  const [villageGroupSheetOpen, setVillageGroupSheetOpen] = useState(false);
  const [selectedVillageGroup, setSelectedVillageGroup] = useState<VillageGroupKey>("MINE");
  const [selectedNeighborUserName, setSelectedNeighborUserName] = useState<string | null>(null);
  const [authProfile, setAuthProfile] = useState<{ username: string; province: string; district: string; village: string } | null>(null);
  const [communityUsers, setCommunityUsers] = useState<UserSummary[]>([]);
  const [harvestPlanModalOpen, setHarvestPlanModalOpen] = useState(false);
  const [harvestDraftTitle, setHarvestDraftTitle] = useState("Yeni hasat operasyonu");
  const [harvestDraftDate, setHarvestDraftDate] = useState("2026-03-26");
  const [harvestDraftNote, setHarvestDraftNote] = useState("Ekip ve makine hazırlığını bir gün önce tamamla.");
  const [selectedHarvestDate, setSelectedHarvestDate] = useState("2026-03-24");
  const [harvestPlans, setHarvestPlans] = useState<HarvestPlanView[]>([]);

  const buildCropOverrides = useCallback(
    (drafts: Record<string, ParcelDraft>) =>
      Object.fromEntries(
        parcels.map((parcel) => [
          parcel.parcel_id,
          (drafts[parcel.parcel_id]?.cropKey ?? (parcel.planned_crop as CropKey)) as CropKey,
        ]),
      ),
    [parcels],
  );

  const recomputeDraftDecisions = useCallback(
    async (drafts: Record<string, ParcelDraft>) => {
      if (parcels.length === 0) {
        return;
      }

      const cropOverrides = buildCropOverrides(drafts);
      const entries = await Promise.all(
        parcels.map(async (parcel) => [
          parcel.parcel_id,
          await apiClient.scoreDecision({
            village_id: "v1",
            season: DEFAULT_SEASON,
            parcel_id: parcel.parcel_id,
            crop_overrides: cropOverrides,
          }),
        ] as const),
      );
      setDecisions(Object.fromEntries(entries));
    },
    [buildCropOverrides, parcels],
  );

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
          setParcelDrafts(
            Object.fromEntries(
              data.parcels.map((parcel) => [
                parcel.parcel_id,
                { cropKey: parcel.planned_crop as CropKey, neighborEnabled: true },
              ]),
            ),
          );
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

  useEffect(() => {
    let mounted = true;

    const loadSessionData = async () => {
      try {
        const [profile, usersResponse] = await Promise.all([loadAuthProfile(), apiClient.getUsers()]);
        if (mounted) {
          setAuthProfile(profile);
          setCommunityUsers(usersResponse.users);
        }
      } catch {
        const profile = await loadAuthProfile();
        if (mounted) {
          setAuthProfile(profile);
        }
      }
    };

    loadSessionData();
    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refreshRemoteData = async () => {
        try {
          const [scenarioResponse, harvestResponse] = await Promise.all([
            apiClient.getScenarios("v1"),
            apiClient.getHarvestPlans(),
          ]);
          if (!active) {
            return;
          }
          setSavedScenarios(scenarioResponse.scenarios);
          setHarvestPlans(harvestResponse.harvest_plans.map((item) => toHarvestPlanView(item, parcels)));
        } catch {
          if (active) {
            setSavedScenarios([]);
          }
        }
      };

      refreshRemoteData();
      return () => {
        active = false;
      };
    }, [parcels]),
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
  const selectedDecision = selectedParcel ? decisions[selectedParcel.parcel_id] : undefined;
  const selectedReasons = sortReasonCodes(selectedDecision?.reason_codes ?? []);
  const selectedStatusCopy = riskStatusCopy[selectedLevel];
  const selectedCropKey = selectedParcel
    ? parcelDrafts[selectedParcel.parcel_id]?.cropKey ?? (selectedParcel.planned_crop as CropKey)
    : "wheat";
  const selectedNeighborEnabled = selectedParcel
    ? parcelDrafts[selectedParcel.parcel_id]?.neighborEnabled ?? true
    : true;
  const selectedVisual = cropVisuals[selectedCropKey] ?? cropVisuals.wheat;
  const selectedScenarios = selectedParcel ? scenarioCards[selectedParcel.parcel_id] ?? [] : [];
  const activeCropGuide = cropGuideContent[cropGuideCrop];

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
  const villageGroupParcels = selectedVillageGroup === "MINE"
    ? parcelsWithOwnership.filter((item) => item.isMine)
    : parcelsWithOwnership.filter((item) => !item.isMine);
  const moisture = Math.max(52, 72 - summary.critical * 4);
  const airQuality = Math.max(11, 18 - summary.critical * 2);
  const waterLevel = Math.max(61, 84 - summary.neighbor);
  const weatherLabel = summary.critical > 1 ? "Kontrollü" : "Güneşli";
  const weatherNote =
    summary.critical > 1
      ? "Bugün riskli alanları gözden geçirmek ve senaryo üretmek için uygun."
      : "Bugün hava çiftçilik planlaması ve arazi kontrolü için ideal.";
  const villageStatus = summary.critical === 0 ? "Mükemmel" : summary.critical < 3 ? "Dengeli" : "İzlenmeli";
  const villageHealthTitle = "Sakarya / Bilinçli Çiftçi Köyü Sağlığı";
  const airQualitySummary =
    airQuality <= 20
      ? "Hava temiz ve açık. Bugün tarlada çalışma, gözlem ve ilaçlama planı için rahat bir gün."
      : airQuality <= 35
        ? "Hava genel olarak iyi. Açık alanda çalışmak için uygun, hassas parsellerde kısa kontrol önerilir."
        : "Hava değişken görünüyor. Uzun süreli saha çalışmasında koruyucu planlama yapılmalı.";
  const airQualityDisplay = `${airQuality} / 100`;
  const waterLevelSummary =
    "Bu değer şu an gerçek sensör verisinden gelmiyor. Demo ekranda komşu parsel yoğunluğuna göre türetilmiş örnek bir su erişim göstergesi olarak gösteriliyor.";
  const waterLevelFormula = "Su seviyesi = max(61, 84 - komşu parsel sayısı)";
  const annualHarvestRows = [
    { crop: "Mısır", cropKey: "corn" as CropKey, amount: "128 ton", share: "%31" },
    { crop: "Ayçiçeği", cropKey: "sunflower" as CropKey, amount: "94 ton", share: "%23" },
    { crop: "Buğday", cropKey: "wheat" as CropKey, amount: "116 ton", share: "%28" },
    { crop: "Arpa", cropKey: "barley" as CropKey, amount: "73 ton", share: "%18" },
  ];
  const monthlyVillageRows = [
    { month: "Ocak 2026", note: "Toprak dinlenme ve bakım dönemi", value: "Sulama hazırlığı %68" },
    { month: "Şubat 2026", note: "Girdi planı güncellendi", value: "Tohum tedariki 42 paket" },
    { month: "Mart 2026", note: "İlkbahar ekim takvimi başladı", value: "Aktif parsel 11 / 16" },
    { month: "Nisan 2026", note: "Komşu etki analizi yoğunlaşıyor", value: "Riskli parsel 3 adet" },
  ];
  const healthSources = [
    "AgroNova demo köy kayıtları ve parsel plan verileri",
    "Karar motorunda üretilen risk özeti ve sezonluk dağılım çıktıları",
    "Örnek hava ve su ölçümleri: demo gösterim amaçlı kurgulanmış referans veri",
  ];
  const openMyFields = () => {
    setMode("MY_FIELDS");
    setOwnershipFilter("MINE");
    setVillageMapFit("mine");
    const firstMine = parcelsWithOwnership.find((item) => item.isMine)?.parcel.parcel_id ?? selectedParcelId;
    setSelectedParcelId(firstMine);
  };
  const openNeighborFields = () => {
    setMode("MY_FIELDS");
    setOwnershipFilter("NEIGHBOR");
    setVillageMapFit("all");
    const firstNeighbor = parcelsWithOwnership.find((item) => !item.isMine)?.parcel.parcel_id ?? selectedParcelId;
    setSelectedParcelId(firstNeighbor);
  };
  const openVillageOverview = () => {
    setMode("VILLAGE");
    setOwnershipFilter("ALL");
    setVillageMapFit("all");
  };
  const openCriticalParcels = () => {
    setMode("VILLAGE");
    setOwnershipFilter("ALL");
    setVillageMapFit("all");
  };
  const openParcelDetail = (parcelId: string) => {
    setSelectedParcelId(parcelId);
    setParcelDetailOpen(true);
  };
  const openVillageGroupSheet = (group: VillageGroupKey) => {
    setSelectedVillageGroup(group);
    if (group !== "NEIGHBOR") {
      setSelectedNeighborUserName(null);
    }
    setVillageGroupSheetOpen(true);
  };
  const openNeighborUserVillageView = (userName: string) => {
    openVillageOverview();
    setSelectedNeighborUserName(userName);
    openVillageGroupSheet("NEIGHBOR");
  };
  const openScenarioBuilder = () =>
    navigation.navigate("ScenarioBuilder", { focusParcelId: selectedParcel?.parcel_id ?? undefined });
  const logout = async () => {
    await clearAuthSession();
    navigation.replace("Login");
  };
  const openHarvestComposer = () => {
    const defaultParcelId = selectedParcel?.parcel_id ?? parcels[0]?.parcel_id ?? "a_p1";
    const defaultCrop = (parcelDrafts[defaultParcelId]?.cropKey ?? parcels.find((item) => item.parcel_id === defaultParcelId)?.planned_crop ?? "wheat") as CropKey;
    setHarvestDraftTitle(`${cropVisuals[defaultCrop]?.label ?? "Ürün"} hasat planı`);
    setHarvestDraftDate(selectedHarvestDate);
    setHarvestDraftNote("Makine, ekip ve depo hazırlığını aynı karttan takip et.");
    setSelectedParcelId(defaultParcelId);
    setHarvestPlanModalOpen(true);
  };
  const saveHarvestPlan = async () => {
    const parcelId = selectedParcel?.parcel_id ?? parcels[0]?.parcel_id;
    if (!parcelId) {
      return;
    }

    try {
      const created = await apiClient.createHarvestPlan({
        title: harvestDraftTitle.trim() || "Hasat planı",
        parcel_id: parcelId,
        planned_date: harvestDraftDate,
        notes: harvestDraftNote.trim() || "Ek not girilmedi.",
        status: "planned",
      });
      setHarvestPlans((current) => [toHarvestPlanView(created, parcels), ...current]);
      setSelectedHarvestDate(harvestDraftDate);
      setHarvestPlanModalOpen(false);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Hasat planı kaydedilemedi.");
    }
  };

  const removeHarvestPlan = async (planId: string) => {
    try {
      await apiClient.deleteHarvestPlan(planId);
      setHarvestPlans((current) => current.filter((item) => item.id !== planId));
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Hasat planı silinemedi.");
    }
  };

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
            onPress={() =>
              navigation.navigate("ScenarioBuilder", {
                focusParcelId: scenario.parcels[0]?.parcel_id,
                scenarioId: scenario.id,
              })
            }
          >
            <View style={styles.savedScenarioHeader}>
              <Text style={styles.savedScenarioTitle}>{scenario.name}</Text>
              <Text style={styles.savedScenarioMeta}>{scenario.created_at}</Text>
            </View>
            <Text style={styles.savedScenarioSummary}>{scenario.summary}</Text>
            <Text style={styles.savedScenarioCount}>{scenario.parcels.length} parsel senaryosu</Text>
          </Pressable>
        ))
      )}
    </View>
  );

  const renderQuickSummary = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Hızlı Özet</Text>
      <Text style={styles.sectionSubtitle}>Köy ve parsel akışının özetini tek panelde hızlıca görebilirsin.</Text>
      <View style={styles.summaryRows}>
        <Pressable style={styles.summaryLine} onPress={openMyFields}>
          <Text style={styles.summaryLabel}>Tarlalarım</Text>
          <Text style={styles.summaryValue}>{myParcels.length}</Text>
        </Pressable>
        <Pressable style={styles.summaryLine} onPress={openNeighborFields}>
          <Text style={styles.summaryLabel}>Komşu tarlalar</Text>
          <Text style={styles.summaryValue}>{neighborParcels.length}</Text>
        </Pressable>
        <Pressable style={styles.summaryLine} onPress={openCriticalParcels}>
          <Text style={styles.summaryLabel}>Kritik parseller</Text>
          <Text style={styles.summaryValue}>{summary.critical}</Text>
        </Pressable>
      </View>
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
            <Text style={styles.welcomeTitle}>{authProfile?.username ?? "Hoş Geldiniz!"}</Text>
            <Text style={styles.welcomeLocation}>
              {authProfile ? `${authProfile.province} / ${authProfile.district} / ${authProfile.village}` : "Sakarya / Serdivan / Kazimpasa Koyu"}
            </Text>
          </View>
        </View>
        <Pressable style={styles.notificationButton} onPress={logout}>
          <Text style={styles.notificationButtonText}>Çıkış</Text>
        </Pressable>
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

      <Pressable style={styles.healthCard} onPress={() => setHealthDetailOpen(true)}>
        <View style={styles.healthHeader}>
          <Text style={styles.healthTitle}>Köy Sağlığı</Text>
          <View style={styles.healthBadge}>
            <Text style={styles.healthBadgeText}>Durum: {villageStatus}</Text>
          </View>
        </View>
        <Text style={styles.healthSubtitle}>{villageHealthTitle}</Text>
        <View style={styles.healthMetrics}>
          <View style={styles.healthMetric}>
            <Text style={styles.healthMetricLabel}>Toprak Nem</Text>
            <Text style={styles.healthMetricValue}>%{moisture}</Text>
          </View>
          <View style={styles.healthDivider} />
          <View style={styles.healthMetric}>
            <Text style={styles.healthMetricLabel}>Hava Kalitesi</Text>
            <Text style={styles.healthMetricValue}>{airQualityDisplay}</Text>
            <Text style={styles.healthMetricCaption}>Bugün saha çalışması için {airQuality <= 20 ? "oldukça uygun" : "genel olarak uygun"}</Text>
          </View>
          <View style={styles.healthDivider} />
          <View style={styles.healthMetric}>
            <Text style={styles.healthMetricLabel}>Su Seviyesi</Text>
            <Text style={styles.healthMetricValue}>%{waterLevel}</Text>
            <Text style={styles.healthMetricCaption}>Sulama hattı ve depo doluluğu birlikte değerlendirildi</Text>
          </View>
        </View>
        <Text style={styles.healthHint}>Detaylı köy verisini görmek için bu karta dokun.</Text>
      </Pressable>

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
              { key: "MINE" as const, label: "Kendi Tarlam", onPress: openMyFields },
              { key: "NEIGHBOR" as const, label: "Komşu Tarlalar", onPress: openNeighborFields },
            ].map((item) => (
              <Pressable
                key={item.key}
                style={[styles.filterChip, mode === "MY_FIELDS" && ownershipFilter === item.key && styles.filterChipActive]}
                onPress={item.onPress}
            >
              <Text style={[styles.filterChipText, mode === "MY_FIELDS" && ownershipFilter === item.key && styles.filterChipTextActive]}>
                {item.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.filterChip, mode === "VILLAGE" && styles.filterChipActive]}
              onPress={openVillageOverview}
            >
              <Text style={[styles.filterChipText, mode === "VILLAGE" && styles.filterChipTextActive]}>Köy Geneli</Text>
            </Pressable>
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
                cropKey: parcelDrafts[item.parcel.parcel_id]?.cropKey ?? (item.parcel.planned_crop as CropKey),
              }))}
              selectedParcelId={selectedParcel?.parcel_id}
              onParcelPress={openParcelDetail}
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

            <View style={styles.reasonPanel}>
              <Text style={styles.reasonPanelTitle}>Neden Bu Durumda?</Text>
              <Text style={styles.reasonPanelLead}>{selectedStatusCopy.title}</Text>
              <Text style={styles.reasonPanelSummary}>{selectedStatusCopy.detail}</Text>
              {selectedReasons.length > 0 ? (
                <View style={styles.reasonList}>
                  {selectedReasons.map((code) => {
                    const reason = getReasonExplanation(code);
                    return (
                      <View key={code} style={styles.reasonItem}>
                        <View style={[styles.reasonBullet, { backgroundColor: selectedTone.badgeFg }]} />
                        <View style={styles.reasonCopy}>
                          <Text style={styles.reasonItemTitle}>{reason.title}</Text>
                          <Text style={styles.reasonItemDetail}>{reason.detail}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.reasonEmpty}>
                  Bu parsel için ek risk kodu oluşmadı. Mevcut dağılım ve komşuluk ilişkisi şu an dengeli görünüyor.
                </Text>
              )}
            </View>

            <View style={styles.primaryActionsRow}>
              <Pressable style={styles.primaryButton} onPress={() => openParcelDetail(selectedParcel.parcel_id)}>
                <Text style={styles.primaryButtonText}>Parsel Detayı</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Kolektif Planlar</Text>
          <Pressable style={styles.secondaryButtonCompact} onPress={openScenarioBuilder}>
            <Text style={styles.secondaryButtonCompactText}>Araştırma Senaryosu</Text>
          </Pressable>
        </View>
        <Text style={styles.sectionSubtitle}>Senaryo ekranında farklı ürün kombinasyonları oluştur, risk açıklamalarını incele ve kaydet.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropPickerRow}>
          {cropOptions.map((option) => (
            <Pressable
              key={option.key}
              style={[styles.cropOptionCard, scenarioCrop === option.key && styles.cropOptionCardActive]}
              onPress={() => {
                setScenarioCrop(option.key);
                setCropGuideCrop(option.key);
                setCropGuideOpen(true);
              }}
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
              <View style={styles.scenarioCropRow}>
                <Image source={getCropImageSource(scenario.crop)} style={styles.scenarioCropIcon} />
                <Text style={styles.scenarioCrop}>{cropVisuals[scenario.crop].label}</Text>
              </View>
              <Text style={styles.scenarioReport}>{scenario.report}</Text>
            </View>
          ))
        )}
      </View>
    </>
  );

  const renderVillageOverview = () => (
    <>
      <View style={styles.sectionCard}>
        <View style={styles.villageHeaderRow}>
          <View style={styles.villageHeaderCopy}>
            <Text style={styles.sectionTitle}>Köy Geneli Haritası</Text>
            <Text style={styles.sectionSubtitle}>
              Köy sınırı mavi çizgiyle belirtilir. Tüm parseller risk rengine göre gösterilir; benim tarlalarım yeşil tonla ayrışır.
            </Text>
          </View>
          <Pressable
            style={styles.villageMineButton}
            onPress={() => setVillageMapFit("mine")}
          >
            <Text style={styles.villageMineButtonText}>Benim Tarlam</Text>
          </Pressable>
        </View>

        <View style={styles.villageMapShell}>
          <LeafletParcelMap
            items={parcelsWithOwnership.map((item) => ({
              parcel: item.parcel,
              riskLevel: decisionLevel(item.parcel.parcel_id),
              isMine: item.isMine,
              cropKey: parcelDrafts[item.parcel.parcel_id]?.cropKey ?? (item.parcel.planned_crop as CropKey),
            }))}
            selectedParcelId={selectedParcel?.parcel_id}
            onParcelPress={(id) => {
              if (id === "__group_mine__") {
                openVillageGroupSheet("MINE");
                return;
              }

              if (id === "__group_neighbor__") {
                openVillageGroupSheet("NEIGHBOR");
                return;
              }

              openParcelDetail(id);
            }}
            showVillageBoundary
            preferredFit={villageMapFit}
          />
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={styles.legendBoundary} />
            <Text style={styles.legendText}>Köy sınırı</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendSwatchMine} />
            <Text style={styles.legendText}>Benim tarlam</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendSwatchNeighbor} />
            <Text style={styles.legendText}>Diğer parseller</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Parsel Bazlı Risk Listesi</Text>
        <Text style={styles.sectionSubtitle}>Aşağıdaki listeden bir parsele dokunarak detay ekranına geçebilirsin.</Text>
        <View style={styles.summaryRows}>
          {parcelsWithOwnership.map((item) => {
            const tone = riskTone(decisionLevel(item.parcel.parcel_id));
            return (
              <Pressable
                key={item.parcel.parcel_id}
                style={styles.villageParcelRow}
                onPress={() => openParcelDetail(item.parcel.parcel_id)}
              >
                <View style={styles.villageParcelLead}>
                  <Image source={getCropImageSource(item.parcel.planned_crop as CropKey)} style={styles.villageParcelIcon} />
                  <View>
                    <Text style={styles.villageParcelTitle}>{getFriendlyParcelName(item.parcel.parcel_id)}</Text>
                    <Text style={styles.villageParcelSubtitle}>
                      {item.isMine ? "Benim tarlam" : "Köy parseli"} • {getFriendlyParcelSubtitle(item.parcel.parcel_id)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.riskBadge, { backgroundColor: tone.badgeBg }]}>
                  <Text style={[styles.riskBadgeText, { color: tone.badgeFg }]}>{tone.text}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );

  const renderUsageGuide = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Kullanım Kılavuzu</Text>
      <Text style={styles.sectionSubtitle}>Uygulamadaki temel akışları bu panelden hızlıca görebilirsin.</Text>
      <View style={styles.summaryRows}>
        {[
          "1. Kendi tarlam veya komşu tarlalar görünümünü seç.",
          "2. Bir parsele dokunup aşağıdan açılan parsel seçim ekranını kullan.",
          "3. Ürün tipini ve komşu etkileşimini değiştir.",
          "4. Kolektif Planlar kısmından ürün rehberi ve araştırma senaryosuna geç.",
          "5. Kaydedilen senaryoları daha sonra tekrar açıp incele.",
        ].map((item) => (
          <View key={item} style={styles.guideRow}>
            <Text style={styles.guideRowText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderNeighborUsers = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Komşu Kullanıcılar</Text>
      <Text style={styles.sectionSubtitle}>Kayitli kullanicilari ve sectikleri illeri burada gorebilirsin.</Text>
      <View style={styles.summaryRows}>
        {communityUsers.map((user) => (
          <Pressable key={user.username} style={styles.neighborUserCard} onPress={() => openNeighborUserVillageView(user.username)}>
            <View>
              <Text style={styles.neighborUserName}>{user.username}</Text>
              <Text style={styles.neighborUserMeta}>{`${user.province} / ${user.district} / ${user.village}`}</Text>
            </View>
            <View style={styles.neighborUserRight}>
              <Text style={styles.neighborUserCrop}>Kayitli Kullanici</Text>
              <Text style={styles.neighborUserStatus}>{authProfile?.username === user.username ? "Aktif Oturum" : "Topluluk"}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderHarvestPlanner = () => {
    const calendarDays = Array.from({ length: 14 }, (_, index) => {
      const date = new Date("2026-03-22T00:00:00");
      date.setDate(date.getDate() + index);
      const iso = toIsoDate(date);
      const planCount = harvestPlans.filter((item) => item.date === iso).length;
      return {
        iso,
        dayLabel: `${date.getDate()}`,
        weekLabel: harvestWeekDays[(date.getDay() + 6) % 7],
        planCount,
        active: planCount > 0,
      };
    });

    const upcomingPlans = [...harvestPlans].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    const selectedDatePlans = harvestPlans
      .filter((plan) => plan.date === selectedHarvestDate)
      .sort((a, b) => a.title.localeCompare(b.title));
    const calendarMonthLabel = formatHarvestMonthYear(selectedHarvestDate);

    return (
      <>
        <View style={styles.harvestHeroCard}>
          <View style={styles.harvestHeroTop}>
            <View style={styles.harvestHeroCopy}>
              <Text style={styles.sectionTitle}>Hasat Takvimi</Text>
              <Text style={styles.sectionSubtitle}>
                Yaklaşan hasatları ve kullanıcı girişlerini tek takvim akışında yönet.
              </Text>
            </View>
            <View style={styles.harvestHeroBadge}>
              <Text style={styles.harvestHeroBadgeText}>{harvestPlans.length} plan</Text>
            </View>
          </View>

          <Pressable style={styles.harvestPrimaryAction} onPress={openHarvestComposer}>
            <View style={styles.harvestPrimaryIcon}>
              <Text style={styles.harvestPrimaryIconText}>+</Text>
            </View>
            <View style={styles.harvestActionCopy}>
              <Text style={styles.harvestActionTitle}>Plan Oluştur</Text>
              <Text style={styles.harvestActionText}>Takvim üstünden yeni hasat operasyonu ekle</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Yaklaşan Bildirimler</Text>
          <Text style={styles.sectionSubtitle}>Hasat zamanı yaklaşıyor uyarıları burada görünür.</Text>
          <View style={styles.summaryRows}>
            {upcomingPlans.map((plan) => (
              <View
                key={plan.id}
                style={[
                  styles.harvestAlertCard,
                  plan.tone === "urgent"
                    ? styles.harvestAlertUrgent
                    : plan.tone === "soon"
                      ? styles.harvestAlertSoon
                      : styles.harvestAlertReady,
                ]}
              >
                <View style={styles.harvestAlertHeader}>
                  <Text style={styles.harvestAlertTitle}>{plan.title}</Text>
                  <Text style={styles.harvestAlertDate}>{plan.reminder}</Text>
                </View>
                <Text style={styles.harvestAlertMeta}>
                  {getFriendlyParcelName(plan.parcelId)} • {cropVisuals[plan.cropKey].label} • {formatHarvestDate(plan.date)}
                </Text>
                <Text style={styles.harvestAlertText}>{plan.note}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.harvestSectionLead}>
              <Text style={styles.sectionTitle}>Takvim Girişleri</Text>
              <Text style={styles.sectionSubtitle}>Kullanıcı takvim içine giriş yapar, uygun günlerde plan yoğunluğu görünür.</Text>
            </View>
            <Pressable style={styles.secondaryButtonCompact} onPress={openHarvestComposer}>
              <Text style={styles.secondaryButtonCompactText}>Takvime Ekle</Text>
            </Pressable>
          </View>

          <View style={styles.harvestCalendarHeader}>
            <Text style={styles.harvestCalendarMonth}>{calendarMonthLabel}</Text>
            <Text style={styles.harvestCalendarHint}>Seçili takvim dönemi</Text>
          </View>

          <View style={styles.harvestCalendarGrid}>
            {calendarDays.map((day) => (
              <Pressable
                key={day.iso}
                style={[
                  styles.harvestDayCard,
                  day.active && styles.harvestDayCardActive,
                  selectedHarvestDate === day.iso && styles.harvestDayCardSelected,
                ]}
                onPress={() => {
                  setHarvestDraftDate(day.iso);
                  setSelectedHarvestDate(day.iso);
                }}
              >
                <Text
                  style={[
                    styles.harvestWeekLabel,
                    day.active && styles.harvestWeekLabelActive,
                    selectedHarvestDate === day.iso && styles.harvestWeekLabelSelected,
                  ]}
                >
                  {day.weekLabel}
                </Text>
                <Text
                  style={[
                    styles.harvestDayLabel,
                    day.active && styles.harvestDayLabelActive,
                    selectedHarvestDate === day.iso && styles.harvestDayLabelSelected,
                  ]}
                >
                  {day.dayLabel}
                </Text>
                <Text
                  style={[
                    styles.harvestPlanCount,
                    day.active && styles.harvestPlanCountActive,
                    selectedHarvestDate === day.iso && styles.harvestPlanCountSelected,
                  ]}
                >
                  {day.planCount > 0 ? `${day.planCount} kayıt` : "boş"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Kayıtlı Hasat Planları</Text>
          <Text style={styles.sectionSubtitle}>
                {formatHarvestDate(selectedHarvestDate)} tarihine ait kayıtlar aşağıda listelenir.
          </Text>

          {selectedDatePlans.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>Bu tarih için kayıt yok</Text>
              <Text style={styles.emptyStateText}>
                Başka bir tarih seçebilir veya `Takvime Ekle` ile yeni hasat planı oluşturabilirsin.
              </Text>
            </View>
          ) : (
            selectedDatePlans.map((plan) => (
              <View key={plan.id} style={styles.harvestTimelineCard}>
                <View style={styles.harvestTimelineLead}>
                  <View style={styles.harvestTimelineIcon}>
                    <Image source={getCropImageSource(plan.cropKey)} style={styles.harvestTimelineImage} />
                  </View>
                  <View style={styles.harvestTimelineCopy}>
                    <Text style={styles.harvestTimelineTitle}>{plan.title}</Text>
                    <Text style={styles.harvestTimelineMeta}>
                      {formatHarvestDate(plan.date)} • {getFriendlyParcelName(plan.parcelId)} • {cropVisuals[plan.cropKey].label}
                    </Text>
                  </View>
                  <Pressable style={styles.harvestDeleteButton} onPress={() => removeHarvestPlan(plan.id)}>
                    <Text style={styles.harvestDeleteButtonText}>Sil</Text>
                  </Pressable>
                </View>
                <Text style={styles.harvestTimelineNote}>{plan.note}</Text>
              </View>
            ))
          )}
        </View>
      </>
    );
  };

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
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {mode === "MY_FIELDS"
            ? renderProfessionalHome()
            : mode === "VILLAGE"
              ? renderVillageOverview()
              : mode === "GUIDE"
                ? renderUsageGuide()
              : mode === "NEIGHBORS"
                ? renderNeighborUsers()
              : mode === "SCENARIOS"
                ? renderSavedScenarios()
              : mode === "SUMMARY"
                ? renderQuickSummary()
              : renderHarvestPlanner()}
        </ScrollView>
      </View>

      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)}>
          <Pressable style={styles.drawerPanel} onPress={() => undefined}>
            <Text style={styles.drawerTitle}>Paneller</Text>
            {[
              { key: "MY_FIELDS" as const, label: "Kendi Tarlam" },
              { key: "VILLAGE" as const, label: "Köy Geneli" },
              { key: "NEIGHBORS" as const, label: "Komşu Kullanıcılar" },
              { key: "GUIDE" as const, label: "Kullanım Kılavuzu" },
              { key: "SUMMARY" as const, label: "Hızlı Özet" },
              { key: "SCENARIOS" as const, label: "Kaydedilen Senaryolar" },
              { key: "HARVEST" as const, label: "Hasat Planı" },
            ].map((item) => (
              <Pressable
                key={item.key}
                style={[styles.drawerItem, mode === item.key && styles.drawerItemActive]}
                onPress={() => {
                  if (item.key === "VILLAGE") {
                    openVillageOverview();
                  } else {
                    setMode(item.key);
                  }
                  setDrawerOpen(false);
                }}
              >
                <Text style={[styles.drawerItemText, mode === item.key && styles.drawerItemTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={parcelDetailOpen} transparent animationType="slide" onRequestClose={() => setParcelDetailOpen(false)}>
        <Pressable style={styles.bottomSheetBackdrop} onPress={() => setParcelDetailOpen(false)}>
          <Pressable style={styles.bottomSheet} onPress={() => undefined}>
            {selectedParcel ? (
              <>
                <View style={styles.bottomSheetHandle} />
                <View style={styles.bottomSheetHeader}>
                  <View style={styles.bottomSheetHeaderCopy}>
                    <Text style={styles.detailEyebrow}>Parsel Seçimi</Text>
                    <Text style={styles.bottomSheetTitle}>{getFriendlyParcelName(selectedParcel.parcel_id)}</Text>
                    <Text style={styles.bottomSheetSubtitle}>
                      {getFriendlyParcelSubtitle(selectedParcel.parcel_id)} • {getParcelArea(selectedParcel.parcel_id)}
                    </Text>
                  </View>
                  <View style={[styles.riskBadge, { backgroundColor: selectedTone.badgeBg }]}>
                    <Text style={[styles.riskBadgeText, { color: selectedTone.badgeFg }]}>{selectedTone.text}</Text>
                  </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.bottomSheetContent}>
                  <View style={styles.bottomMediaCard}>
                    <View style={styles.selectionIconCircle}>
                      <Image source={getCropImageSource(selectedCropKey)} style={styles.selectionLeadIcon} />
                    </View>
                    <View style={styles.bottomMediaCopy}>
                      <Text style={styles.bottomMediaTitle}>Ekilecek Ürün Tipi</Text>
                      <Text style={styles.bottomMediaText}>
                        Kullanıcı bu parsel için ürünü doğrudan değiştirebilir. Seçim anında parsel kartına yansır.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bottomSection}>
                    <Text style={styles.bottomSectionTitle}>Ürün Seç</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropPickerRow}>
                      {cropOptions.map((option) => (
                        <Pressable
                          key={`${selectedParcel.parcel_id}-${option.key}`}
                          style={[
                            styles.cropOptionCard,
                            selectedCropKey === option.key && styles.cropOptionCardActive,
                          ]}
                          onPress={() => {
                            const nextDrafts = {
                              ...parcelDrafts,
                              [selectedParcel.parcel_id]: {
                                cropKey: option.key,
                                neighborEnabled: parcelDrafts[selectedParcel.parcel_id]?.neighborEnabled ?? true,
                              },
                            };
                            setParcelDrafts(nextDrafts);
                            void recomputeDraftDecisions(nextDrafts);
                          }}
                        >
                          <Image source={getCropImageSource(option.key)} style={styles.cropOptionImage} />
                          <Text style={styles.cropOptionLabel}>{option.label}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.bottomSection}>
                    <View style={styles.toggleCard}>
                      <View style={styles.toggleCopy}>
                        <Text style={styles.toggleTitle}>Komşu Etkileşimi</Text>
                        <Text style={styles.toggleDetail}>Komşu ürün verilerini optimizasyona dahil et</Text>
                      </View>
                      <Pressable
                        style={[styles.toggleSwitch, !selectedNeighborEnabled && styles.toggleSwitchPassive]}
                        onPress={() => {
                          const nextDrafts = {
                            ...parcelDrafts,
                            [selectedParcel.parcel_id]: {
                              cropKey: parcelDrafts[selectedParcel.parcel_id]?.cropKey ?? (selectedParcel.planned_crop as CropKey),
                              neighborEnabled: !(parcelDrafts[selectedParcel.parcel_id]?.neighborEnabled ?? true),
                            },
                          };
                          setParcelDrafts(nextDrafts);
                          void recomputeDraftDecisions(nextDrafts);
                        }}
                      >
                        <View style={[styles.toggleKnob, !selectedNeighborEnabled && styles.toggleKnobPassive]} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.bottomSection}>
                    <Text style={styles.bottomSectionTitle}>Komşu Parseller</Text>
                    <View style={styles.neighborStack}>
                      {[
                        { id: `${selectedParcel.parcel_id}-north`, label: "Kuzey komşusu", cropKey: "wheat" as CropKey, area: "0.8 ha" },
                        { id: `${selectedParcel.parcel_id}-east`, label: "Doğu komşusu", cropKey: "sunflower" as CropKey, area: "1.1 ha" },
                      ].map((neighbor) => (
                        <View key={neighbor.id} style={styles.neighborCard}>
                          <View style={styles.neighborIconWrap}>
                            <Image source={getCropImageSource(neighbor.cropKey)} style={styles.neighborIconImage} />
                          </View>
                          <View style={styles.neighborCopy}>
                            <Text style={styles.neighborTitle}>{neighbor.label}</Text>
                            <Text style={styles.neighborDetail}>Ürün: {cropVisuals[neighbor.cropKey].label}</Text>
                          </View>
                          <Text style={styles.neighborArea}>{neighbor.area}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.bottomSection}>
                    <Text style={styles.bottomSectionTitle}>Neden Bu Durumda?</Text>
                    <View style={styles.detailReasonCard}>
                      <Text style={styles.reasonPanelLead}>{selectedStatusCopy.title}</Text>
                      <Text style={styles.reasonPanelSummary}>{selectedStatusCopy.detail}</Text>
                      {selectedReasons.length > 0 ? (
                        <View style={styles.reasonList}>
                          {selectedReasons.map((code) => {
                            const reason = getReasonExplanation(code);
                            return (
                              <View key={`detail-${code}`} style={styles.reasonItem}>
                                <View style={[styles.reasonBullet, { backgroundColor: selectedTone.badgeFg }]} />
                                <View style={styles.reasonCopy}>
                                  <Text style={styles.reasonItemTitle}>{reason.title}</Text>
                                  <Text style={styles.reasonItemDetail}>{reason.detail}</Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={styles.reasonEmpty}>
                          Bu parsel için ek risk kodu oluşmadı. Mevcut plan bu aşamada dengeli görünüyor.
                        </Text>
                      )}
                    </View>
                  </View>
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={harvestPlanModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setHarvestPlanModalOpen(false)}
      >
        <Pressable style={styles.bottomSheetBackdrop} onPress={() => setHarvestPlanModalOpen(false)}>
          <Pressable style={styles.bottomSheet} onPress={() => undefined}>
            <View style={styles.bottomSheetHandle} />
            <View style={styles.bottomSheetHeader}>
              <View style={styles.bottomSheetHeaderCopy}>
                <Text style={styles.detailEyebrow}>Takvim Girdisi</Text>
                <Text style={styles.bottomSheetTitle}>Yeni Hasat Planı</Text>
                <Text style={styles.bottomSheetSubtitle}>
                  Artı butonu veya takvim günü üstünden açılır. Kullanıcı hasat akışını bu formdan girer.
                </Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.bottomSheetContent}>
              <View style={styles.bottomSection}>
                <Text style={styles.bottomSectionTitle}>Plan Adı</Text>
                <TextInput
                  value={harvestDraftTitle}
                  onChangeText={setHarvestDraftTitle}
                  placeholder="Ornek: Misir hasat operasyonu"
                  placeholderTextColor="#7E887D"
                  style={styles.harvestInput}
                />
              </View>

              <View style={styles.bottomSection}>
                <Text style={styles.bottomSectionTitle}>Tarih</Text>
                <TextInput
                  value={harvestDraftDate}
                  onChangeText={setHarvestDraftDate}
                  placeholder="YYYY-AA-GG"
                  placeholderTextColor="#7E887D"
                  style={styles.harvestInput}
                />
              </View>

              <View style={styles.bottomSection}>
                <Text style={styles.bottomSectionTitle}>Hedef Parsel</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropPickerRow}>
                  {parcels.slice(0, 6).map((parcel) => (
                    <Pressable
                      key={parcel.parcel_id}
                      style={[
                        styles.harvestParcelChip,
                        selectedParcel?.parcel_id === parcel.parcel_id && styles.harvestParcelChipActive,
                      ]}
                      onPress={() => setSelectedParcelId(parcel.parcel_id)}
                    >
                      <Text
                        style={[
                          styles.harvestParcelChipText,
                          selectedParcel?.parcel_id === parcel.parcel_id && styles.harvestParcelChipTextActive,
                        ]}
                      >
                        {getFriendlyParcelName(parcel.parcel_id)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.bottomSection}>
                <Text style={styles.bottomSectionTitle}>Not</Text>
                <TextInput
                  value={harvestDraftNote}
                  onChangeText={setHarvestDraftNote}
                  placeholder="Ekipman, depo, personel veya kontrol notu"
                  placeholderTextColor="#7E887D"
                  style={styles.harvestTextarea}
                  multiline
                />
              </View>

              <View style={styles.primaryActionsRow}>
                <Pressable style={styles.primaryButton} onPress={saveHarvestPlan}>
                  <Text style={styles.primaryButtonText}>Plani Kaydet</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={villageGroupSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setVillageGroupSheetOpen(false)}
      >
        <Pressable style={styles.bottomSheetBackdrop} onPress={() => setVillageGroupSheetOpen(false)}>
          <Pressable style={styles.bottomSheet} onPress={() => undefined}>
            <View style={styles.bottomSheetHandle} />
            <View style={styles.bottomSheetHeader}>
              <View style={styles.bottomSheetHeaderCopy}>
                <Text style={styles.detailEyebrow}>Parsel Bazlı Risk Listesi</Text>
                <Text style={styles.bottomSheetTitle}>
                  {selectedVillageGroup === "MINE" ? "Benim Tarlam" : "Diğer Parseller"}
                </Text>
                <Text style={styles.bottomSheetSubtitle}>
                  {selectedVillageGroup === "NEIGHBOR" && selectedNeighborUserName
                    ? `${selectedNeighborUserName} kullanıcısına ait parseller ve mevcut risk durumları`
                    : "Haritadaki seçili alanın içindeki parseller ve mevcut risk durumları"}
                </Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.bottomSheetContent}>
              <View style={styles.bottomSection}>
                <Text style={styles.bottomSectionTitle}>İlgili Parseller</Text>
                <View style={styles.summaryRows}>
                  {villageGroupParcels.map((item) => {
                    const tone = riskTone(decisionLevel(item.parcel.parcel_id));
                    const draftCrop = parcelDrafts[item.parcel.parcel_id]?.cropKey ?? (item.parcel.planned_crop as CropKey);
                    return (
                      <Pressable
                        key={`group-sheet-${item.parcel.parcel_id}`}
                        style={styles.villageParcelRow}
                        onPress={() => {
                          setVillageGroupSheetOpen(false);
                          openParcelDetail(item.parcel.parcel_id);
                        }}
                      >
                        <View style={styles.villageParcelLead}>
                          <Image source={getCropImageSource(draftCrop)} style={styles.villageParcelIcon} />
                          <View>
                            <Text style={styles.villageParcelTitle}>{getFriendlyParcelName(item.parcel.parcel_id)}</Text>
                            <Text style={styles.villageParcelSubtitle}>
                              {getFriendlyParcelSubtitle(item.parcel.parcel_id)} • {getParcelArea(item.parcel.parcel_id)}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.riskBadge, { backgroundColor: tone.badgeBg }]}>
                          <Text style={[styles.riskBadgeText, { color: tone.badgeFg }]}>{tone.text}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={cropGuideOpen} transparent animationType="slide" onRequestClose={() => setCropGuideOpen(false)}>
        <Pressable style={styles.bottomSheetBackdrop} onPress={() => setCropGuideOpen(false)}>
          <Pressable style={styles.bottomSheet} onPress={() => undefined}>
            <View style={styles.bottomSheetHandle} />
            <View style={styles.bottomSheetHeader}>
              <View style={styles.bottomSheetHeaderCopy}>
                <Text style={styles.detailEyebrow}>Ürün Rehberi</Text>
                <Text style={styles.bottomSheetTitle}>{activeCropGuide.title}</Text>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.bottomSheetContent}>
              <View style={styles.bottomMediaCard}>
                <View style={styles.selectionIconCircle}>
                  <Image source={getCropImageSource(cropGuideCrop)} style={styles.selectionLeadIcon} />
                </View>
                <View style={styles.bottomMediaCopy}>
                  <Text style={styles.bottomMediaTitle}>{cropVisuals[cropGuideCrop].label}</Text>
                  <Text style={styles.bottomMediaText}>{activeCropGuide.summary}</Text>
                </View>
              </View>
              <View style={styles.bottomSection}>
                <Text style={styles.bottomSectionTitle}>Genel Bilgiler</Text>
                {activeCropGuide.bullets.map((item) => (
                  <Text key={item} style={styles.guideBullet}>• {item}</Text>
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={healthDetailOpen} transparent animationType="slide" onRequestClose={() => setHealthDetailOpen(false)}>
        <View style={styles.detailBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <View style={styles.detailHeaderCopy}>
                <Text style={styles.detailEyebrow}>Köy Sağlığı Detayı</Text>
                <Text style={styles.detailTitle}>{villageHealthTitle}</Text>
              </View>
              <Pressable style={styles.detailCloseButton} onPress={() => setHealthDetailOpen(false)}>
                <Text style={styles.detailCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
              <View style={styles.detailSummaryCard}>
                <Text style={styles.detailSummaryTitle}>Bugünkü genel durum</Text>
                <Text style={styles.detailSummaryText}>
                  {villageHealthTitle} için sistem durumu şu an <Text style={styles.detailSummaryStrong}>{villageStatus.toLowerCase()}</Text>. Toprak nemi
                  ve su seviyesi dengeli. Hava tarafında kullanıcıya açık yorum: {airQualitySummary}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>2025 yıllık ürün özeti</Text>
                {annualHarvestRows.map((row) => (
                  <View key={row.crop} style={styles.detailRow}>
                    <View style={styles.detailRowLead}>
                      <Image source={getCropImageSource(row.cropKey)} style={styles.detailRowIcon} />
                      <View>
                      <Text style={styles.detailRowTitle}>{row.crop}</Text>
                      <Text style={styles.detailRowSubtext}>Toplam hasat payı {row.share}</Text>
                      </View>
                    </View>
                    <Text style={styles.detailRowValue}>{row.amount}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>2026 aylık izleme verisi</Text>
                {monthlyVillageRows.map((row) => (
                  <View key={row.month} style={styles.detailRow}>
                    <View style={styles.detailRowCopy}>
                      <Text style={styles.detailRowTitle}>{row.month}</Text>
                      <Text style={styles.detailRowSubtext}>{row.note}</Text>
                    </View>
                    <Text style={styles.detailRowValue}>{row.value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Göstergeler nasıl okunmalı?</Text>
                <View style={styles.detailRowCopy}>
                  <Text style={styles.detailRowTitle}>Hava kalitesi</Text>
                  <Text style={styles.detailRowSubtext}>
                    {airQualityDisplay} değeri, köy üstündeki havanın temizlik ve rahat çalışma durumunu özetler. Sayı küçüldükçe açık alanda çalışmak daha rahattır.
                  </Text>
                </View>
                <View style={styles.detailRowCopy}>
                  <Text style={styles.detailRowTitle}>Su seviyesi</Text>
                  <Text style={styles.detailRowSubtext}>{waterLevelSummary}</Text>
                  <Text style={styles.detailFormulaText}>Kod içindeki örnek hesap: {waterLevelFormula}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Veri kaynağı</Text>
                {healthSources.map((source) => (
                  <Text key={source} style={styles.detailSourceItem}>• {source}</Text>
                ))}
                <Text style={styles.detailSourceItem}>
                  • Su seviyesi ve hava kalitesi bu ekranda şu an demo amaçlı türetilmiş özet göstergelerdir; doğrudan meteoroloji ya da sulama sensöründen okunmamaktadır.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
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
  welcomeIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14, paddingRight: 12 },
  avatarWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6DCCF",
  },
  avatarGlyph: { fontSize: 28 },
  welcomeCopy: { flex: 1, gap: 3 },
  welcomeTitle: { color: "#162234", fontSize: 20, fontWeight: "900" },
  welcomeLocation: { color: "#6B8B61", fontSize: 14, fontWeight: "700", flexShrink: 1 },
  notificationButton: {
    width: 86,
    minHeight: 48,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notificationButtonText: { color: "#56657A", fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
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
  healthSubtitle: { color: "#6B7A67", fontSize: 14, fontWeight: "700" },
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
  healthMetricCaption: { color: "#6B7A67", fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 17 },
  healthDivider: { width: 1, backgroundColor: "#E4E8DF", marginHorizontal: 4 },
  healthHint: { color: "#6B7A67", fontSize: 13, fontWeight: "700" },
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
  legendBoundary: { width: 24, height: 16, borderRadius: 6, borderWidth: 2, borderStyle: "dashed", borderColor: "#2B7FFF" },
  legendText: { color: "#556553", fontSize: 13, fontWeight: "800" },
  villageHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 },
  villageHeaderCopy: { flex: 1 },
  villageMineButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E6F5E0",
    borderWidth: 1,
    borderColor: "#C5DDBB",
  },
  villageMineButtonText: { color: "#2E6D2E", fontSize: 13, fontWeight: "900" },
  villageMapShell: {
    minHeight: 340,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#D9E2D3",
  },
  villageParcelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    backgroundColor: "#F4F5F0",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  villageParcelLead: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  villageParcelIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF", resizeMode: "contain" },
  villageParcelTitle: { color: "#1E2D20", fontSize: 15, fontWeight: "900" },
  villageParcelSubtitle: { color: "#6B7A67", fontSize: 12, fontWeight: "700", marginTop: 3 },
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
  selectionLeadIcon: { width: 48, height: 48, resizeMode: "contain" },
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
  reasonPanel: {
    borderRadius: 24,
    backgroundColor: "#FCFCF8",
    borderWidth: 1,
    borderColor: "#E2E7D9",
    padding: 16,
    gap: 10,
  },
  reasonPanelTitle: { color: "#162234", fontSize: 17, fontWeight: "900" },
  reasonPanelLead: { color: "#244430", fontSize: 15, fontWeight: "900" },
  reasonPanelSummary: { color: "#607267", fontSize: 14, lineHeight: 21 },
  reasonList: { gap: 10, marginTop: 2 },
  reasonItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 18,
    backgroundColor: "#F3F6ED",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  reasonBullet: { width: 10, height: 10, borderRadius: 999, marginTop: 5 },
  reasonCopy: { flex: 1, gap: 3 },
  reasonItemTitle: { color: "#223127", fontSize: 14, fontWeight: "800" },
  reasonItemDetail: { color: "#67766E", fontSize: 13, lineHeight: 19 },
  reasonEmpty: { color: "#67766E", fontSize: 13, lineHeight: 20 },
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
  secondaryButtonCompact: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#EFE5D7",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonCompactText: { color: "#7B6246", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  sectionCard: { backgroundColor: "#FCFCF9", borderRadius: 30, padding: 20, gap: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  sectionTitle: { color: "#162234", fontSize: 22, fontWeight: "900" },
  sectionSubtitle: { color: "#6B7A67", fontSize: 14, lineHeight: 20 },
  cropPickerRow: { gap: 12 },
  cropOptionCard: { width: 120, borderRadius: 24, backgroundColor: "#F7F4EC", borderWidth: 1, borderColor: "#DDD8CC", padding: 12, gap: 10 },
  cropOptionCardActive: { backgroundColor: "#EBF6E8", borderColor: "#B7D2B0" },
  cropOptionImage: { width: 88, height: 72, borderRadius: 18, backgroundColor: "#FFFFFF", resizeMode: "contain", alignSelf: "center" },
  cropOptionLabel: { color: "#283627", fontSize: 13, fontWeight: "800", textAlign: "center" },
  emptyState: { borderRadius: 22, backgroundColor: "#F3F4EF", padding: 18, gap: 8 },
  emptyStateTitle: { color: "#2A382A", fontSize: 17, fontWeight: "800" },
  emptyStateText: { color: "#6B7A67", fontSize: 14, lineHeight: 21 },
  scenarioCard: { borderRadius: 22, backgroundColor: "#FFFEFB", borderWidth: 1, borderColor: "#E7E1D6", padding: 16, gap: 8 },
  scenarioTitle: { color: "#243224", fontSize: 18, fontWeight: "800" },
  scenarioCropRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  scenarioCropIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: "#F7F7F3", resizeMode: "contain" },
  scenarioCrop: { color: "#7B6246", fontSize: 13, fontWeight: "700" },
  scenarioReport: { color: "#5F6D61", fontSize: 14, lineHeight: 21 },
  savedScenarioCard: { borderRadius: 22, backgroundColor: "#FFFEFB", borderWidth: 1, borderColor: "#E7E1D6", padding: 16, gap: 10 },
  savedScenarioHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  savedScenarioTitle: { color: "#243224", fontSize: 18, fontWeight: "900", flex: 1 },
  savedScenarioMeta: { color: "#7B8895", fontSize: 12, fontWeight: "700" },
  savedScenarioSummary: { color: "#5F6D61", fontSize: 14, lineHeight: 21 },
  savedScenarioCount: { color: "#7B6246", fontSize: 13, fontWeight: "800" },
  summaryRows: { gap: 10 },
  guideRow: {
    borderRadius: 20,
    backgroundColor: "#F4F5F0",
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  guideRowText: { color: "#556461", fontSize: 14, lineHeight: 22, fontWeight: "700" },
  neighborUserCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    backgroundColor: "#F4F5F0",
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  neighborUserName: { color: "#233123", fontSize: 16, fontWeight: "900" },
  neighborUserMeta: { color: "#6B7A67", fontSize: 13, fontWeight: "700", marginTop: 4 },
  neighborUserRight: { alignItems: "flex-end", gap: 4 },
  neighborUserCrop: { color: "#7B6246", fontSize: 14, fontWeight: "800" },
  neighborUserStatus: { color: "#2E6D2E", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
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
  detailBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 28, 18, 0.42)",
    justifyContent: "flex-end",
  },
  detailSheet: {
    maxHeight: "84%",
    backgroundColor: "#FFFDF8",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  detailHeaderCopy: { flex: 1, gap: 4 },
  detailEyebrow: { color: "#7B6246", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  detailTitle: { color: "#162234", fontSize: 22, fontWeight: "900", lineHeight: 29 },
  detailCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EEF3E8",
    alignItems: "center",
    justifyContent: "center",
  },
  detailCloseText: { color: "#486044", fontSize: 16, fontWeight: "900" },
  detailContent: { gap: 16, paddingBottom: 16 },
  detailSummaryCard: {
    borderRadius: 24,
    backgroundColor: "#EEF4EA",
    borderWidth: 1,
    borderColor: "#DCE6D3",
    padding: 16,
    gap: 10,
  },
  detailSummaryTitle: { color: "#254225", fontSize: 17, fontWeight: "900" },
  detailSummaryText: { color: "#556461", fontSize: 14, lineHeight: 21 },
  detailSummaryStrong: { color: "#345B31", fontWeight: "900" },
  detailSection: {
    borderRadius: 24,
    backgroundColor: "#FCFCF9",
    borderWidth: 1,
    borderColor: "#E7E1D6",
    padding: 16,
    gap: 12,
  },
  detailSectionTitle: { color: "#162234", fontSize: 18, fontWeight: "900" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#F4F5F0",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  detailRowLead: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  detailRowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#FFFFFF", resizeMode: "contain" },
  detailRowCopy: { flex: 1 },
  detailRowTitle: { color: "#233123", fontSize: 15, fontWeight: "800" },
  detailRowSubtext: { color: "#6B7A67", fontSize: 12, fontWeight: "600", marginTop: 3 },
  detailRowValue: { color: "#2E6132", fontSize: 14, fontWeight: "900", textAlign: "right" },
  detailFormulaText: { color: "#7B6246", fontSize: 12, fontWeight: "700", marginTop: 8, lineHeight: 18 },
  detailSourceItem: { color: "#556461", fontSize: 14, lineHeight: 21 },
  toggleCard: {
    backgroundColor: "#EEF4E8",
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleCopy: { flex: 1, paddingRight: 8 },
  toggleTitle: { color: palette.text, fontSize: 18, fontWeight: "800" },
  toggleDetail: { color: palette.muted, fontSize: 15, marginTop: 4, lineHeight: 21 },
  toggleSwitch: {
    width: 62,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#8DBA7E",
    justifyContent: "center",
    paddingHorizontal: 4,
    alignItems: "flex-end",
    marginTop: 4,
    flexShrink: 0,
  },
  toggleKnob: { width: 28, height: 28, borderRadius: 999, backgroundColor: "#FFFFFF" },
  toggleSwitchPassive: { backgroundColor: "#CDD7C9", alignItems: "flex-start" },
  toggleKnobPassive: { backgroundColor: "#F7F8F4" },
  neighborStack: { gap: 12 },
  neighborCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFDF8", borderRadius: 22, padding: 16 },
  neighborIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#F7F7F3",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  neighborIconImage: { width: "100%", height: "100%", resizeMode: "contain" },
  neighborCopy: { flex: 1 },
  neighborTitle: { color: palette.text, fontSize: 17, fontWeight: "800" },
  neighborDetail: { color: palette.green, fontSize: 15, marginTop: 4 },
  neighborArea: { color: palette.muted, fontSize: 16, fontWeight: "600" },
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 28, 18, 0.32)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    maxHeight: "78%",
    backgroundColor: "#FFFDF8",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  bottomSheetHandle: {
    alignSelf: "center",
    width: 56,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#D6DDD0",
    marginBottom: 14,
  },
  bottomSheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  bottomSheetHeaderCopy: { flex: 1, gap: 4 },
  bottomSheetTitle: { color: "#162234", fontSize: 24, fontWeight: "900" },
  bottomSheetSubtitle: { color: "#6B8B61", fontSize: 14, fontWeight: "700" },
  bottomSheetContent: { gap: 16, paddingTop: 16, paddingBottom: 48 },
  bottomMediaCard: {
    borderRadius: 24,
    backgroundColor: "#F6F8F3",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  bottomMediaCopy: { flex: 1, gap: 6 },
  bottomMediaTitle: { color: "#162234", fontSize: 18, fontWeight: "900" },
  bottomMediaText: { color: "#5F6D61", fontSize: 14, lineHeight: 20 },
  bottomSection: { gap: 10 },
  bottomSectionTitle: { color: "#162234", fontSize: 18, fontWeight: "900" },
  detailReasonCard: {
    borderRadius: 22,
    backgroundColor: "#F5F7F1",
    borderWidth: 1,
    borderColor: "#E1E8D6",
    padding: 16,
    gap: 10,
  },
  harvestHeroCard: { borderRadius: 32, backgroundColor: "#FCFCF9", padding: 20, gap: 18 },
  harvestHeroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  harvestHeroCopy: { flex: 1 },
  harvestHeroBadge: {
    borderRadius: 999,
    backgroundColor: "#E5F4E0",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  harvestHeroBadgeText: { color: "#3E6F38", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  harvestPrimaryAction: {
    borderRadius: 26,
    backgroundColor: "#EEF4EA",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  harvestPrimaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#355E3B",
    alignItems: "center",
    justifyContent: "center",
  },
  harvestPrimaryIconText: { color: "#FFFFFF", fontSize: 28, lineHeight: 28, fontWeight: "700" },
  harvestActionCopy: { flex: 1, gap: 4 },
  harvestActionTitle: { color: "#1D2A1E", fontSize: 16, fontWeight: "900" },
  harvestActionText: { color: "#62705F", fontSize: 13, lineHeight: 19 },
  harvestSectionLead: { flex: 1 },
  harvestCalendarHeader: {
    borderRadius: 20,
    backgroundColor: "#F4F5F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  harvestCalendarMonth: { color: "#162234", fontSize: 18, fontWeight: "900" },
  harvestCalendarHint: { color: "#6B7A67", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  harvestAlertCard: { borderRadius: 22, padding: 16, gap: 8 },
  harvestAlertUrgent: { backgroundColor: "#FFF1EE", borderWidth: 1, borderColor: "#F3C1B8" },
  harvestAlertSoon: { backgroundColor: "#FFF8E7", borderWidth: 1, borderColor: "#EBCF88" },
  harvestAlertReady: { backgroundColor: "#EEF6E8", borderWidth: 1, borderColor: "#BED5B3" },
  harvestAlertHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  harvestAlertTitle: { color: "#223127", fontSize: 16, fontWeight: "900", flex: 1 },
  harvestAlertDate: { color: "#7B6246", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  harvestAlertMeta: { color: "#51604D", fontSize: 13, fontWeight: "700" },
  harvestAlertText: { color: "#5F6D61", fontSize: 14, lineHeight: 21 },
  harvestCalendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  harvestDayCard: {
    width: "22%",
    minWidth: 72,
    borderRadius: 22,
    backgroundColor: "#F5F6F1",
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 6,
  },
  harvestDayCardActive: { backgroundColor: "#E7F3E3", borderWidth: 1, borderColor: "#BED5B3" },
  harvestDayCardSelected: { backgroundColor: "#355E3B", borderWidth: 1, borderColor: "#355E3B" },
  harvestWeekLabel: { color: "#8B9488", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  harvestWeekLabelActive: { color: "#497148" },
  harvestWeekLabelSelected: { color: "#E3F1E1" },
  harvestDayLabel: { color: "#1E2D20", fontSize: 20, fontWeight: "900" },
  harvestDayLabelActive: { color: "#2E6D2E" },
  harvestDayLabelSelected: { color: "#FFFFFF" },
  harvestPlanCount: { color: "#8B9488", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  harvestPlanCountActive: { color: "#497148" },
  harvestPlanCountSelected: { color: "#E3F1E1" },
  harvestTimelineCard: {
    borderRadius: 24,
    backgroundColor: "#F7F8F4",
    padding: 16,
    gap: 12,
  },
  harvestTimelineLead: { flexDirection: "row", alignItems: "center", gap: 12 },
  harvestTimelineIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  harvestTimelineImage: { width: 42, height: 42, resizeMode: "contain" },
  harvestTimelineCopy: { flex: 1 },
  harvestDeleteButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#FDE2DD",
    alignItems: "center",
    justifyContent: "center",
  },
  harvestDeleteButtonText: { color: "#B6463A", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  harvestTimelineTitle: { color: "#203021", fontSize: 16, fontWeight: "900" },
  harvestTimelineMeta: { color: "#687867", fontSize: 13, fontWeight: "700", marginTop: 4 },
  harvestTimelineNote: { color: "#556461", fontSize: 14, lineHeight: 21 },
  harvestInput: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#F3F6EE",
    paddingHorizontal: 16,
    color: "#223127",
    fontSize: 15,
  },
  harvestTextarea: {
    minHeight: 110,
    borderRadius: 18,
    backgroundColor: "#F3F6EE",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#223127",
    fontSize: 15,
    textAlignVertical: "top",
  },
  harvestParcelChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#F4F5F0",
  },
  harvestParcelChipActive: { backgroundColor: "#DCEFD8" },
  harvestParcelChipText: { color: "#4E5D4C", fontSize: 13, fontWeight: "800" },
  harvestParcelChipTextActive: { color: "#375436" },
  guideBullet: { color: "#556461", fontSize: 14, lineHeight: 22 },
});



import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../api/client";
import { loadDecisionCache, saveDecisionCache } from "../api/cache";
import { ReasonList, sortReasonCodes } from "../components/reasons";
import { RootStackParamList } from "../navigation/AppNavigator";
import type { DecisionResponse } from "../types/api";
import {
  cropVisuals,
  getCropImageSource,
  getFriendlyParcelName,
  getFriendlyParcelSubtitle,
  getParcelArea,
  riskTone,
  type CropKey,
} from "../utils/farmUi";

type Props = NativeStackScreenProps<RootStackParamList, "Decision">;

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

const parcelPreviewMap =
  "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1400&q=80";

const parcelCropMap: Record<string, CropKey> = {
  a_p1: "corn",
  a_p2: "sunflower",
  a_p3: "wheat",
  a_p4: "corn",
  a_p5: "corn",
  a_p6: "barley",
  a_p7: "wheat",
  a_p8: "corn",
  b_p1: "sunflower",
  b_p2: "wheat",
  b_p3: "corn",
  b_p4: "barley",
  b_p5: "sunflower",
  b_p6: "wheat",
  b_p7: "corn",
  b_p8: "barley",
};

export function DecisionScreen({ route, navigation }: Props) {
  const { parcelId, season } = route.params;
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [decision, setDecision] = useState<DecisionResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const prime = async () => {
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
        // empty state is acceptable
      }
    };

    prime();
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

  const cropKey = parcelCropMap[parcelId] ?? "wheat";
  const cropVisual = cropVisuals[cropKey];
  const tone = riskTone(decision?.risk_level ?? "UNKNOWN");
  const mockNeighbors = useMemo(
    () => [
      { id: `${parcelId}-north`, label: "Kuzey komşusu", crop: "Buğday", cropKey: "wheat" as CropKey, area: "0.8 ha" },
      { id: `${parcelId}-east`, label: "Doğu komşusu", crop: "Ayçiçeği", cropKey: "sunflower" as CropKey, area: "1.1 ha" },
    ],
    [parcelId],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <View style={styles.page}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Text style={styles.iconButtonText}>←</Text>
          </Pressable>
          <Text style={styles.pageTitle}>Parsel Detayı ve Ürün Seçimi</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroTitle}>{getFriendlyParcelName(parcelId)}</Text>
                <Text style={styles.heroArea}>
                  {getFriendlyParcelSubtitle(parcelId)} • {getParcelArea(parcelId)}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: tone.badgeBg }]}>
                <Text style={[styles.statusPillText, { color: tone.badgeFg }]}>{tone.text}</Text>
              </View>
            </View>

            <ImageBackground source={{ uri: parcelPreviewMap }} style={styles.mapCard} imageStyle={styles.mapCardImage}>
              <View style={styles.mapMarker}>
                <Image
                  source={getCropImageSource(cropKey, decision?.risk_level === "CRITICAL" ? "wilted" : "normal")}
                  style={styles.mapMarkerImage}
                />
              </View>
            </ImageBackground>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Ekilecek Ürün Tipi</Text>
            <View style={styles.selectCard}>
              <View style={styles.selectValueRow}>
                <Image source={getCropImageSource(cropKey)} style={styles.selectValueIcon} />
                <Text style={styles.selectValue}>{cropVisual.label}</Text>
              </View>
              <Text style={styles.selectArrow}>⌄</Text>
            </View>
          </View>

          <View style={styles.toggleCard}>
            <View>
              <Text style={styles.toggleTitle}>Komşu Etkileşimi</Text>
              <Text style={styles.toggleDetail}>Komşu ürün verilerini optimizasyona dahil et</Text>
            </View>
            <View style={styles.toggleSwitch}>
              <View style={styles.toggleKnob} />
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Komşu Parseller</Text>
            <View style={styles.neighborStack}>
              {mockNeighbors.map((neighbor) => (
                <View key={neighbor.id} style={styles.neighborCard}>
                  <View style={styles.neighborIconWrap}>
                    <Image source={getCropImageSource(neighbor.cropKey)} style={styles.neighborIconImage} />
                  </View>
                  <View style={styles.neighborCopy}>
                    <Text style={styles.neighborTitle}>{neighbor.label}</Text>
                    <Text style={styles.neighborDetail}>Ürün: {neighbor.crop}</Text>
                  </View>
                  <Text style={styles.neighborArea}>{neighbor.area}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Risk Özeti</Text>
              <View style={[styles.statusPill, { backgroundColor: tone.badgeBg }]}>
                <Text style={[styles.statusPillText, { color: tone.badgeFg }]}>{tone.text}</Text>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileLabel}>Risk skoru</Text>
                <Text style={styles.summaryTileValue}>{decision?.risk_score ?? "--"}</Text>
              </View>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileLabel}>Güven</Text>
                <Text style={styles.summaryTileValue}>
                  {decision?.confidence !== null && decision?.confidence !== undefined
                    ? `${Math.round(decision.confidence * 100)}%`
                    : "--"}
                </Text>
              </View>
            </View>

            {loading ? <ActivityIndicator color={palette.green} /> : null}
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            {decision ? (
              <ReasonList reasonCodes={sortReasonCodes(decision.reason_codes)} />
            ) : (
              <Text style={styles.emptyText}>Karar hesaplandığında risk nedenleri burada gösterilecek.</Text>
            )}

            <Pressable style={styles.primaryButton} onPress={fetchDecision} disabled={loading}>
              <Text style={styles.primaryButtonText}>{loading ? "Hesaplanıyor..." : "Karar Hesapla"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.page },
  page: { flex: 1, backgroundColor: palette.page },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: palette.card,
  },
  iconButton: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: palette.card },
  iconButtonText: { color: palette.green, fontSize: 28, fontWeight: "700" },
  pageTitle: { flex: 1, color: palette.text, fontSize: 19, fontWeight: "900", textAlign: "center", marginHorizontal: 10 },
  closeGhost: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#9AA08D" },
  closeGhostText: { color: "#FFFFFF", fontSize: 28, lineHeight: 30 },
  scrollContent: { padding: 18, gap: 18, paddingBottom: 28 },
  heroCard: { backgroundColor: palette.card, borderRadius: 28, padding: 16, gap: 16 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  heroTitle: { color: palette.text, fontSize: 24, fontWeight: "900" },
  heroArea: { marginTop: 8, color: palette.green, fontSize: 18, fontWeight: "800" },
  statusPill: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  statusPillText: { fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
  mapCard: { minHeight: 220, justifyContent: "center", alignItems: "center" },
  mapCardImage: { borderRadius: 24 },
  mapMarker: {
    width: 74,
    height: 74,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapMarkerImage: { width: "100%", height: "100%" },
  sectionBlock: { gap: 10 },
  sectionLabel: { color: palette.text, fontSize: 20, fontWeight: "800" },
  selectCard: {
    minHeight: 82,
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectValueRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  selectValueIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#F7F7F3" },
  selectValue: { color: palette.text, fontSize: 20, fontWeight: "500" },
  selectArrow: { color: palette.green, fontSize: 26, fontWeight: "700" },
  toggleCard: {
    backgroundColor: "#EEF4E8",
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleTitle: { color: palette.text, fontSize: 18, fontWeight: "800" },
  toggleDetail: { color: palette.muted, fontSize: 15, marginTop: 4 },
  toggleSwitch: { width: 62, height: 36, borderRadius: 999, backgroundColor: "#8DBA7E", justifyContent: "center", paddingHorizontal: 4, alignItems: "flex-end" },
  toggleKnob: { width: 28, height: 28, borderRadius: 999, backgroundColor: "#FFFFFF" },
  neighborStack: { gap: 12 },
  neighborCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.card, borderRadius: 22, padding: 16 },
  neighborIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#F7F7F3",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  neighborIconImage: { width: "100%", height: "100%" },
  neighborCopy: { flex: 1 },
  neighborTitle: { color: palette.text, fontSize: 17, fontWeight: "800" },
  neighborDetail: { color: palette.green, fontSize: 15, marginTop: 4 },
  neighborArea: { color: palette.muted, fontSize: 16, fontWeight: "600" },
  summaryCard: { backgroundColor: palette.card, borderRadius: 28, padding: 18, gap: 16 },
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  summaryTitle: { color: palette.text, fontSize: 20, fontWeight: "900" },
  summaryGrid: { flexDirection: "row", gap: 12 },
  summaryTile: { flex: 1, borderRadius: 20, backgroundColor: "#F5F3EE", padding: 14, gap: 6 },
  summaryTileLabel: { color: palette.muted, fontSize: 13, fontWeight: "700" },
  summaryTileValue: { color: palette.text, fontSize: 24, fontWeight: "900" },
  errorText: { color: palette.red, fontSize: 14, fontWeight: "700" },
  emptyText: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  primaryButton: { minHeight: 56, borderRadius: 18, backgroundColor: "#BFD9B8", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#35522E", fontSize: 16, fontWeight: "900" },
});




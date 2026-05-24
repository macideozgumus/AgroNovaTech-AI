import React, { useMemo } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import type { ParcelItem, RiskLevel } from "../types/api";
import { getCropIconUri, getCropImageSource, getFriendlyParcelName, riskTone, type CropKey } from "../utils/farmUi";

type ParcelMapItem = {
  parcel: ParcelItem;
  riskLevel: RiskLevel | "UNKNOWN";
  isMine: boolean;
  cropKey: CropKey;
};

type Props = {
  items: ParcelMapItem[];
  selectedParcelId?: string | null;
  onParcelPress?: (parcelId: string) => void;
  showVillageBoundary?: boolean;
  showMineTag?: boolean;
  preferredFit?: "all" | "mine";
};

type ParcelFeature = {
  id: string;
  name: string;
  riskText: string;
  color: string;
  borderColor: string;
  mine: boolean;
  cropKey: CropKey;
  cropIcon: string;
  coordinates: [number, number][];
};

const center: [number, number] = [37.8422, 40.1178];

const parcelOffsets = [
  { lat: 0.0011, lng: -0.0014 },
  { lat: 0.0011, lng: 0.0002 },
  { lat: 0.0001, lng: -0.00135 },
  { lat: 0.0001, lng: 0.00025 },
  { lat: -0.001, lng: -0.0013 },
  { lat: -0.001, lng: 0.0003 },
  { lat: -0.0021, lng: -0.00125 },
  { lat: -0.0021, lng: 0.00035 },
] as const;

function buildParcelPolygon(baseLat: number, baseLng: number): [number, number][] {
  const height = 0.00078;
  const width = 0.00126;
  return [
    [baseLat, baseLng],
    [baseLat, baseLng + width],
    [baseLat - height, baseLng + width],
    [baseLat - height, baseLng],
  ];
}

function getFeatureCoordinates(item: ParcelMapItem, index: number): [number, number][] {
  if (item.parcel.geometry && item.parcel.geometry.length >= 3) {
    return item.parcel.geometry as [number, number][];
  }
  const offset = parcelOffsets[index % parcelOffsets.length];
  return buildParcelPolygon(center[0] + offset.lat, center[1] + offset.lng);
}

function buildVillageBoundary(features: ParcelFeature[]): [number, number][] | null {
  if (features.length === 0) {
    return null;
  }
  const points = features.flatMap((feature) => feature.coordinates);
  const latitudes = points.map((point) => point[0]);
  const longitudes = points.map((point) => point[1]);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latPad = Math.max((maxLat - minLat) * 0.12, 0.00018);
  const lngPad = Math.max((maxLng - minLng) * 0.12, 0.00018);
  return [
    [maxLat + latPad, minLng - lngPad],
    [maxLat + latPad, maxLng + lngPad],
    [minLat - latPad, maxLng + lngPad],
    [minLat - latPad, minLng - lngPad],
  ];
}

function buildHtml(
  features: ParcelFeature[],
  selectedParcelId?: string | null,
  showVillageBoundary?: boolean,
  _showMineTag?: boolean,
  preferredFit: "all" | "mine" = "all",
) {
  const payload = JSON.stringify(features);
  const safeSelected = selectedParcelId ?? "";
  const boundary = buildVillageBoundary(features);

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; background: #dfe6da; }
        .leaflet-container { font-family: sans-serif; }
        .parcel-label {
          background: rgba(255,255,255,0.94);
          border: 0;
          border-radius: 999px;
          color: #233127;
          font-weight: 700;
          font-size: 12px;
          padding: 3px 8px;
          max-width: 112px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow: 0 6px 16px rgba(0,0,0,0.12);
        }
        .parcel-icon {
          width: 44px;
          height: 44px;
          border-radius: 999px;
          background: rgba(255,255,255,0.96);
          padding: 3px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.18);
          border: 2px solid white;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const features = ${payload};
        const selectedId = ${JSON.stringify(safeSelected)};
        const showVillageBoundary = ${JSON.stringify(Boolean(showVillageBoundary))};
        const preferredFit = ${JSON.stringify(preferredFit)};
        const map = L.map("map", { zoomControl: false }).setView([${center[0]}, ${center[1]}], 17);

        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          attribution: "Esri"
        }).addTo(map);

        const group = L.featureGroup();

        if (showVillageBoundary && ${JSON.stringify(boundary)} !== null) {
          const villagePolygon = L.polygon(${JSON.stringify(boundary)}, {
            color: "#2B7FFF",
            weight: 3,
            fillOpacity: 0.02,
            dashArray: "10 8"
          }).addTo(map);

          group.addLayer(villagePolygon);
        }

        features.forEach((feature) => {
          const borderWeight = feature.id === selectedId ? 5 : 3;
          const fillOpacity = feature.mine ? 0.58 : 0.32;
          const polygon = L.polygon(feature.coordinates, {
            color: feature.borderColor,
            weight: borderWeight,
            fillColor: feature.color,
            fillOpacity,
            dashArray: feature.mine ? undefined : "8 6"
          }).addTo(map);

          polygon.bindTooltip(feature.name, {
            permanent: true,
            direction: "center",
            className: "parcel-label"
          });

          polygon.on("click", () => {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(feature.id);
            }
          });

          const bounds = polygon.getBounds();
          const polygonCenter = bounds.getCenter();
          const icon = L.divIcon({
            html: '<img class="parcel-icon" src="' + feature.cropIcon + '" alt="' + feature.name + '" />',
            className: "",
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          });

          L.marker(polygonCenter, { icon }).addTo(map);
          group.addLayer(polygon);
        });

        if (features.length > 0) {
          const fitFeatures = preferredFit === "mine"
            ? features.filter((feature) => feature.mine)
            : features;
          const activeFeatures = fitFeatures.length > 0 ? fitFeatures : features;
          const fitGroup = L.featureGroup(
            activeFeatures.map((feature) => L.polygon(feature.coordinates))
          );

          map.fitBounds(fitGroup.getBounds().pad(preferredFit === "mine" ? 0.55 : 0.25));
        }

        L.control.zoom({ position: "bottomright" }).addTo(map);
      </script>
    </body>
  </html>`;
}

export function LeafletParcelMap({
  items,
  selectedParcelId,
  onParcelPress,
  showVillageBoundary = false,
  showMineTag = false,
  preferredFit = "all",
}: Props) {
  const features = useMemo<ParcelFeature[]>(() => {
    return items.map((item, index) => {
      const tone = riskTone(item.riskLevel);
      return {
        id: item.parcel.parcel_id,
        name: getFriendlyParcelName(item.parcel.parcel_id, item.parcel.display_name),
        riskText: tone.text,
        color: tone.fieldFill,
        borderColor: tone.fieldBorder,
        mine: item.isMine,
        cropKey: item.cropKey,
        cropIcon:
          Platform.OS === "web"
            ? ""
            : getCropIconUri(item.cropKey, item.riskLevel === "CRITICAL" ? "wilted" : "normal"),
        coordinates: getFeatureCoordinates(item, index),
      };
    });
  }, [items, showVillageBoundary]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.webFallback}>
        <View style={styles.webFallbackOverlay} />
        {showVillageBoundary ? <View style={styles.webVillageBoundary} /> : null}
        <View style={styles.webFallbackHeader}>
          <Text style={styles.webFallbackBadge}>Uydu Onizleme</Text>
          <Text style={styles.webFallbackTitle}>Harita gorunumu web&apos;de sadeleştirilmiş önizleme ile gösteriliyor.</Text>
        </View>
        <View style={styles.webParcelGrid}>
          {features.slice(0, 6).map((feature) => (
            <Pressable
              key={feature.id}
              style={[
                styles.webParcelCard,
                feature.mine ? styles.webParcelMine : styles.webParcelNeighbor,
                selectedParcelId === feature.id && styles.webParcelSelected,
              ]}
              onPress={() => onParcelPress?.(feature.id)}
            >
              <Text style={styles.webParcelTitle}>{feature.name}</Text>
              <Image
                source={getCropImageSource(feature.cropKey, feature.riskText === "Yuksek Risk" ? "wilted" : "normal")}
                style={styles.webParcelIcon}
              />
              <Text style={styles.webParcelRisk}>{feature.riskText}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  const { WebView } = require("react-native-webview");

  return (
    <WebView
      source={{ html: buildHtml(features, selectedParcelId, showVillageBoundary, showMineTag, preferredFit) }}
      originWhitelist={["*"]}
      style={styles.webview}
      onMessage={(event: { nativeEvent: { data: string } }) => onParcelPress?.(event.nativeEvent.data)}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  webFallback: {
    minHeight: 300,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#D9D6C5",
    padding: 18,
    justifyContent: "space-between",
  },
  webFallbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(54, 71, 48, 0.08)",
  },
  webVillageBoundary: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: "#2B7FFF",
    borderStyle: "dashed",
  },
  webFallbackHeader: {
    gap: 6,
  },
  webFallbackBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    color: "#233127",
    fontWeight: "700",
    fontSize: 12,
  },
  webFallbackTitle: {
    color: "#233127",
    fontSize: 16,
    fontWeight: "700",
    maxWidth: 280,
    lineHeight: 22,
  },
  webParcelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  webParcelCard: {
    width: "47%",
    borderRadius: 24,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.85)",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(35,49,39,0.08)",
  },
  webParcelMine: {
    shadowColor: "#2F7D44",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  webParcelNeighbor: {
    shadowColor: "#8F7A62",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  webParcelSelected: {
    borderColor: "#2F7D44",
    borderWidth: 2,
  },
  webParcelTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#233127",
  },
  webParcelIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
  },
  webParcelRisk: {
    fontSize: 13,
    color: "#4E5E4B",
    fontWeight: "600",
  },
});

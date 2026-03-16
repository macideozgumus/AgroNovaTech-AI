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

function buildHtml(features: ParcelFeature[], selectedParcelId?: string | null) {
  const payload = JSON.stringify(features);
  const safeSelected = selectedParcelId ?? "";

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
          padding: 4px 10px;
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
        const map = L.map("map", { zoomControl: false }).setView([${center[0]}, ${center[1]}], 17);

        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          attribution: "Esri"
        }).addTo(map);

        const group = L.featureGroup();

        features.forEach((feature) => {
          const borderWeight = feature.id === selectedId ? 5 : 3;
          const fillOpacity = feature.mine ? 0.46 : 0.18;
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
          const center = bounds.getCenter();
          const icon = L.divIcon({
            html: '<img class="parcel-icon" src="' + feature.cropIcon + '" alt="' + feature.name + '" />',
            className: "",
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          });

          L.marker(center, { icon }).addTo(map);
          group.addLayer(polygon);
        });

        if (features.length > 0) {
          map.fitBounds(group.getBounds().pad(0.25));
        }

        L.control.zoom({ position: "bottomright" }).addTo(map);
      </script>
    </body>
  </html>`;
}

export function LeafletParcelMap({ items, selectedParcelId, onParcelPress }: Props) {
  const features = useMemo<ParcelFeature[]>(
    () =>
      items.slice(0, parcelOffsets.length).map((item, index) => {
        const tone = riskTone(item.riskLevel);
        const offset = parcelOffsets[index];
        return {
          id: item.parcel.parcel_id,
          name: getFriendlyParcelName(item.parcel.parcel_id),
          riskText: tone.text,
          color: tone.fieldFill,
          borderColor: item.isMine ? "#2F7D44" : "#8F7A62",
          mine: item.isMine,
          cropKey: item.cropKey,
          cropIcon:
            Platform.OS === "web"
              ? ""
              : getCropIconUri(item.cropKey, item.riskLevel === "CRITICAL" ? "wilted" : "normal"),
          coordinates: buildParcelPolygon(center[0] + offset.lat, center[1] + offset.lng),
        };
      }),
    [items],
  );

  if (Platform.OS === "web") {
    return (
      <View style={styles.webFallback}>
        <View style={styles.webFallbackOverlay} />
        <View style={styles.webFallbackHeader}>
          <Text style={styles.webFallbackBadge}>Uydu önizleme</Text>
          <Text style={styles.webFallbackTitle}>Harita görünümü web&#39;de sadeleştirilmiş önizleme ile gösteriliyor.</Text>
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
                source={getCropImageSource(feature.cropKey, feature.riskText === "Yüksek Risk" ? "wilted" : "normal")}
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
      source={{ html: buildHtml(features, selectedParcelId) }}
      originWhitelist={["*"]}
      style={styles.webview}
      onMessage={(event) => onParcelPress?.(event.nativeEvent.data)}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: "#dfe6da",
  },
  webFallback: {
    flex: 1,
    backgroundColor: "#D7DDD0",
    padding: 16,
    justifyContent: "space-between",
  },
  webFallbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248, 247, 241, 0.42)",
  },
  webFallbackHeader: {
    gap: 8,
  },
  webFallbackBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.88)",
    color: "#685239",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  webFallbackTitle: {
    color: "#223127",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  webParcelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  webParcelCard: {
    width: "48%",
    minHeight: 122,
    borderRadius: 24,
    padding: 14,
    justifyContent: "space-between",
    shadowColor: "#233127",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  webParcelMine: {
    backgroundColor: "rgba(136, 187, 112, 0.82)",
    borderWidth: 2,
    borderColor: "#2F7D44",
  },
  webParcelNeighbor: {
    backgroundColor: "rgba(214, 204, 188, 0.86)",
    borderWidth: 2,
    borderColor: "#8F7A62",
    borderStyle: "dashed",
  },
  webParcelSelected: {
    transform: [{ translateY: -4 }],
  },
  webParcelTitle: {
    color: "#1E2D20",
    fontSize: 14,
    fontWeight: "800",
  },
  webParcelIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  webParcelRisk: {
    color: "#304232",
    fontSize: 12,
    fontWeight: "700",
  },
});

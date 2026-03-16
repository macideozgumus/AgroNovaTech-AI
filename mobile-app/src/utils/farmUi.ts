import { Image, type ImageSourcePropType } from "react-native";

import type { RiskLevel } from "../types/api";

export const palette = {
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

export const cropVisuals: Record<
  string,
  {
    label: string;
    accent: string;
  }
> = {
  corn: {
    label: "Mısır",
    accent: "#C19245",
  },
  sunflower: {
    label: "Ayçiçeği",
    accent: "#A0A93D",
  },
  wheat: {
    label: "Buğday",
    accent: "#B68B38",
  },
  barley: {
    label: "Arpa",
    accent: "#8A7A5F",
  },
};

export type CropKey = keyof typeof cropVisuals;

const cropImageSources: Record<CropKey, { normal: ImageSourcePropType; wilted: ImageSourcePropType }> = {
  corn: {
    normal: require("../../assets/crops/corn.png"),
    wilted: require("../../assets/crops/corn-wilted.png"),
  },
  sunflower: {
    normal: require("../../assets/crops/sunflower.png"),
    wilted: require("../../assets/crops/sunflower-wilted.png"),
  },
  wheat: {
    normal: require("../../assets/crops/wheat.png"),
    wilted: require("../../assets/crops/wheat-wilted.png"),
  },
  barley: {
    normal: require("../../assets/crops/barley.png"),
    wilted: require("../../assets/crops/barley-wilted.png"),
  },
};

export function getFriendlyParcelName(parcelId: string) {
  const match = parcelId.match(/([ab])_p(\d+)/i);
  if (!match) {
    return parcelId.toUpperCase();
  }

  const order = Number(match[2]);
  return `${order}. Parsel`;
}

export function getFriendlyParcelSubtitle(parcelId: string) {
  const match = parcelId.match(/([ab])_p(\d+)/i);
  if (!match) {
    return parcelId.toUpperCase();
  }

  return `${match[1].toUpperCase()} Blok`;
}

export function getParcelArea(parcelId: string) {
  const match = parcelId.match(/p(\d+)/i);
  const order = match ? Number(match[1]) : 1;
  return `${(0.8 + order * 0.1).toFixed(1)} ha`;
}

export function riskTone(level: RiskLevel | "UNKNOWN") {
  switch (level) {
    case "CRITICAL":
      return {
        badgeBg: "#FDE2DD",
        badgeFg: "#B6463A",
        fieldFill: "#E46B61",
        fieldBorder: "#B6463A",
        text: "Yüksek Risk",
      };
    case "RISKY":
      return {
        badgeBg: "#FFF0CF",
        badgeFg: "#A56F12",
        fieldFill: "#E4B94E",
        fieldBorder: "#A56F12",
        text: "İzlenmeli",
      };
    case "OK":
      return {
        badgeBg: "#E3F1DD",
        badgeFg: "#49783E",
        fieldFill: "#83B56F",
        fieldBorder: "#49783E",
        text: "Dengeli",
      };
    default:
      return {
        badgeBg: "#ECEEE8",
        badgeFg: "#727B72",
        fieldFill: "#AAB0A7",
        fieldBorder: "#727B72",
        text: "Bekleniyor",
      };
  }
}

export function buildScenarioReport(crop: CropKey, level: RiskLevel | "UNKNOWN") {
  const cropName = cropVisuals[crop].label;

  if (level === "CRITICAL") {
    return `${cropName} için komşu baskısı yüksek. Nöbetleşe ekim ve kontrollü sulama önerilir.`;
  }

  if (level === "RISKY") {
    return `${cropName} senaryosu uygulanabilir. Ekim aralığı ve komşu ürün dengesi tekrar kontrol edilmeli.`;
  }

  return `${cropName} senaryosu dengeli görünüyor. Verim ve köy uyumu açısından paylaşmaya uygun.`;
}

export function getCropImageSource(crop: CropKey, state: "normal" | "wilted" = "normal"): ImageSourcePropType {
  return cropImageSources[crop][state];
}

export function getCropIconUri(crop: CropKey, state: "normal" | "wilted" = "normal") {
  const source = Image.resolveAssetSource(getCropImageSource(crop, state));
  return source.uri;
}

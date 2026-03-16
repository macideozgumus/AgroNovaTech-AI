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

function svgToUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getCropIconUri(crop: CropKey, state: "normal" | "wilted" = "normal") {
  const wilted = state === "wilted";

  const icons: Record<CropKey, string> = {
    corn: `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <rect width="128" height="128" rx="28" fill="white"/>
        <g transform="translate(8 6)">
          <ellipse cx="64" cy="42" rx="18" ry="32" fill="${wilted ? "#D9B85C" : "#F3C640"}" stroke="#D29B18" stroke-width="3"/>
          <g stroke="${wilted ? "#C79C5A" : "#E6AE26"}" stroke-width="2" opacity="0.6">
            <path d="M52 18v48"/><path d="M60 14v56"/><path d="M68 14v56"/><path d="M76 18v48"/>
            <path d="M47 28h34"/><path d="M46 38h36"/><path d="M46 48h36"/><path d="M48 58h32"/>
          </g>
          <path d="M44 96C20 86 16 57 31 34c8 11 16 24 19 40 2 10 0 16-6 22z" fill="${wilted ? "#72A55C" : "#3EA93B"}"/>
          <path d="M84 96c24-10 28-39 13-62-8 11-16 24-19 40-2 10 0 16 6 22z" fill="${wilted ? "#84B86A" : "#56C84F"}"/>
        </g>
      </svg>`,
    sunflower: `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <rect width="128" height="128" rx="28" fill="white"/>
        <g transform="translate(10 10)">
          <circle cx="54" cy="44" r="18" fill="#6B4A2E"/>
          ${Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const x = 54 + Math.cos(angle) * 22;
            const y = 44 + Math.sin(angle) * 22;
            return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="8" ry="16" transform="rotate(${i * 30} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${wilted ? "#D9B85C" : "#F3C640"}"/>`;
          }).join("")}
          <circle cx="54" cy="44" r="12" fill="#7A532E"/>
          <path d="M54 56v40" stroke="${wilted ? "#6F8F5B" : "#4FA24B"}" stroke-width="6" stroke-linecap="round"/>
          <path d="M54 76c-12-1-18 3-24 12 12 1 20-1 25-7z" fill="${wilted ? "#86A96F" : "#63C257"}"/>
          <path d="M54 82c12-1 18 3 24 12-12 1-20-1-25-7z" fill="${wilted ? "#78A060" : "#4EAF4E"}"/>
        </g>
      </svg>`,
    wheat: `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <rect width="128" height="128" rx="28" fill="white"/>
        <g transform="translate(16 10)" stroke-linecap="round" stroke-linejoin="round">
          <path d="M50 96V22" stroke="${wilted ? "#8D7B52" : "#B78D32"}" stroke-width="5"/>
          <path d="M50 30l-16 12M50 40l-18 12M50 50l-18 12M50 60l-16 12" stroke="${wilted ? "#C4B074" : "#E1C15F"}" stroke-width="6"/>
          <path d="M50 30l16 12M50 40l18 12M50 50l18 12M50 60l16 12" stroke="${wilted ? "#C4B074" : "#E1C15F"}" stroke-width="6"/>
          <path d="M30 100c8-12 16-18 24-18 8 0 16 6 24 18" fill="none" stroke="${wilted ? "#7FA06B" : "#64B857"}" stroke-width="6"/>
        </g>
      </svg>`,
    barley: `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <rect width="128" height="128" rx="28" fill="white"/>
        <g transform="translate(14 10)" stroke-linecap="round">
          <path d="M54 96V24" stroke="${wilted ? "#86765A" : "#9E844B"}" stroke-width="5"/>
          <path d="M54 30l-12 10M54 36l14 10M54 44l-14 10M54 50l16 10M54 58l-14 10M54 64l16 10" stroke="${wilted ? "#D0BE91" : "#E5D0A1"}" stroke-width="5"/>
          <path d="M54 28l-8-10M54 34l8-12M54 42l-8-12M54 48l8-12M54 56l-8-12M54 62l8-12" stroke="${wilted ? "#C8B58A" : "#E9D4A8"}" stroke-width="3"/>
          <path d="M34 98c8-10 14-14 20-14M74 98C66 88 60 84 54 84" fill="none" stroke="${wilted ? "#6E8D5A" : "#62B45A"}" stroke-width="6"/>
        </g>
      </svg>`,
  };

  return svgToUri(icons[crop]);
}

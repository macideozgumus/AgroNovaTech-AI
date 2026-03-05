export type RiskLevel = "OK" | "RISKY" | "CRITICAL" | "UNKNOWN";

type RiskPalette = {
  label: RiskLevel;
  marker: string;
  badgeBg: string;
  badgeFg: string;
  panelBg: string;
  panelBorder: string;
  panelTitle: string;
};

export const RISK_UI: Record<RiskLevel, RiskPalette> = {
  OK: {
    label: "OK",
    marker: "#2f9e44",
    badgeBg: "#d4f5dd",
    badgeFg: "#1b8f4c",
    panelBg: "#edf9ef",
    panelBorder: "#cbe8d1",
    panelTitle: "#1e7a35",
  },
  RISKY: {
    label: "RISKY",
    marker: "#f1c40f",
    badgeBg: "#fff4bf",
    badgeFg: "#9a6a00",
    panelBg: "#fff8e7",
    panelBorder: "#f0dfaf",
    panelTitle: "#9a6a00",
  },
  CRITICAL: {
    label: "CRITICAL",
    marker: "#c6362f",
    badgeBg: "#ffd8d8",
    badgeFg: "#b42318",
    panelBg: "#fff0f0",
    panelBorder: "#f2c7c7",
    panelTitle: "#b42318",
  },
  UNKNOWN: {
    label: "UNKNOWN",
    marker: "#7b8a8d",
    badgeBg: "#edf0f2",
    badgeFg: "#5f6b77",
    panelBg: "#f4f7f9",
    panelBorder: "#dce4ea",
    panelTitle: "#4d5a67",
  },
};

export function toRiskLevel(level?: string | null): RiskLevel {
  if (level === "OK" || level === "RISKY" || level === "CRITICAL" || level === "UNKNOWN") {
    return level;
  }
  return "UNKNOWN";
}

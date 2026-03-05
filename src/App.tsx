import { useEffect, useState } from "react";
import FarmMap from "./components/FarmMap";
import { RISK_UI, toRiskLevel } from "./ui/risk";
import { getReasonTextTr, getRecommendationTextTr, normalizeTrText } from "./utils/trText";

type Crop = { crop_id: string; crop_name: string };
type Parcel = {
  parcel_id: string;
  name: string;
  status: "UNKNOWN" | "OK" | "RISKY" | "CRITICAL";
  crop: Crop | null;
  risk_score: number | null;
  risk_level: "UNKNOWN" | "OK" | "RISKY" | "CRITICAL" | null;
  field_block?: {
    field_block_id: string;
    name: string;
  } | null;
};
type ParcelDecision = {
  parcel_id: string;
  season: string;
  risk_score: number;
  risk_level: "OK" | "RISKY" | "CRITICAL";
  reasons: { code: string; text: string }[];
  recommendations: { type: string; text: string }[];
  confidence?: number | null;
  model_version: string;
};
type FieldPosition = "top" | "right" | "bottom" | "left";
type FieldLayoutResponse = {
  village_id: string;
  field_layout_position: FieldPosition;
  valid_positions?: FieldPosition[];
};
type NeighborSummary = {
  intraBlockCount: number;
  interBlockCount: number;
  source: "api_v2_neighbors" | "decision_fallback";
};
type NeighborsResponse = {
  parcel_id: string;
  season: string;
  layout_position: FieldPosition;
  neighbors: {
    intra_block: { parcel_id: string; adjacency_type: "INTRA_BLOCK" }[];
    inter_block: { parcel_id: string; adjacency_type: "INTER_BLOCK" }[];
  };
};

const API_HOST = "http://127.0.0.1:8000";
const API_BASE_V1 = `${API_HOST}/api/v1`;
const API_BASE_V2 = `${API_HOST}/api/v2`;
const SEASON = "2026_Spring";
const VILLAGE_ID = "v1";
const FIELD_BLOCK_A_ID = "fb_a";
const FIELD_BLOCK_B_ID = "fb_b";

const getApiBase = (version: "v1" | "v2") => (version === "v2" ? API_BASE_V2 : API_BASE_V1);

async function apiGet<T>(path: string, version: "v1" | "v2" = "v1"): Promise<T> {
  const res = await fetch(`${getApiBase(version)}${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function apiSend<T>(
  path: string,
  method: "POST" | "PUT",
  body: unknown,
  version: "v1" | "v2" = "v1",
): Promise<T> {
  const res = await fetch(`${getApiBase(version)}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<T>;
}

function App() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [selectedCropId, setSelectedCropId] = useState("");
  const [decision, setDecision] = useState<ParcelDecision | null>(null);
  const [fieldLayoutPosition, setFieldLayoutPosition] = useState<FieldPosition>("right");
  const [neighborSummary, setNeighborSummary] = useState<NeighborSummary | null>(null);
  const [neighborSummaryLoading, setNeighborSummaryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedParcel = parcels.find((p) => p.parcel_id === selectedParcelId) ?? null;

  const loadParcels = async (): Promise<Parcel[]> => {
    const res = await apiGet<{ parcels: Parcel[] }>(
      `/villages/${VILLAGE_ID}/parcels?season=${SEASON}`,
    );

    setParcels(res.parcels);

    const activeParcelId =
      selectedParcelId && res.parcels.some((parcel) => parcel.parcel_id === selectedParcelId)
        ? selectedParcelId
        : (res.parcels[0]?.parcel_id ?? null);

    if (activeParcelId) {
      const activeParcel = res.parcels.find((parcel) => parcel.parcel_id === activeParcelId) ?? null;
      setSelectedParcelId(activeParcelId);
      setSelectedCropId(activeParcel?.crop?.crop_id ?? "");
    } else {
      setSelectedParcelId(null);
      setSelectedCropId("");
    }

    return res.parcels;
  };

  const loadDecision = async (parcelId: string): Promise<ParcelDecision> => {
    const res = await apiGet<ParcelDecision>(`/parcels/${parcelId}/decision?season=${SEASON}`);
    setDecision(res);
    return res;
  };

  const loadFieldLayout = async () => {
    const res = await apiGet<FieldLayoutResponse>(`/villages/${VILLAGE_ID}/field-layout`, "v2");
    setFieldLayoutPosition(res.field_layout_position);
    return res;
  };

  const loadNeighborSummary = async (parcelId: string, decisionSnapshot: ParcelDecision | null) => {
    setNeighborSummaryLoading(true);
    try {
      const res = await apiGet<NeighborsResponse>(
        `/parcels/${parcelId}/neighbors?season=${SEASON}`,
        "v2",
      );
      setNeighborSummary({
        intraBlockCount: res.neighbors.intra_block.length,
        interBlockCount: res.neighbors.inter_block.length,
        source: "api_v2_neighbors",
      });
    } catch {
      const reasons = decisionSnapshot?.reasons ?? [];
      setNeighborSummary({
        intraBlockCount: reasons.some((item) => item.code === "INTRA_BLOCK_CONFLICT") ? 1 : 0,
        interBlockCount: reasons.some((item) => item.code === "INTER_BLOCK_BORDER_CONFLICT") ? 1 : 0,
        source: "decision_fallback",
      });
    } finally {
      setNeighborSummaryLoading(false);
    }
  };

  const scoreVillage = async (manageBusy = true) => {
    if (manageBusy) {
      setBusy(true);
    }
    setError("");
    try {
      await apiSend("/decision/score", "POST", { village_id: VILLAGE_ID, season: SEASON });
      const refreshedParcels = await loadParcels();
      const activeParcelId =
        selectedParcelId && refreshedParcels.some((parcel) => parcel.parcel_id === selectedParcelId)
          ? selectedParcelId
          : (refreshedParcels[0]?.parcel_id ?? null);

      if (activeParcelId) {
        const activeDecision = await loadDecision(activeParcelId);
        await loadNeighborSummary(activeParcelId, activeDecision);
      } else {
        setDecision(null);
        setNeighborSummary(null);
      }
    } catch (e) {
      setError(normalizeTrText(e instanceof Error ? e.message : "Hesaplama hatası"));
    } finally {
      if (manageBusy) {
        setBusy(false);
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [cropRes] = await Promise.all([
          apiGet<{ crops: Crop[] }>("/crops"),
          loadFieldLayout(),
        ]);
        setCrops(cropRes.crops);
        await scoreVillage(true);
      } catch (e) {
        setError(normalizeTrText(e instanceof Error ? e.message : "Başlangıç yükleme hatası"));
      } finally {
        setLoading(false);
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedParcelId) {
      setDecision(null);
      setNeighborSummary(null);
      return;
    }
    setSelectedCropId(selectedParcel?.crop?.crop_id ?? "");
    void (async () => {
      const activeDecision = await loadDecision(selectedParcelId).catch(() => null);
      await loadNeighborSummary(selectedParcelId, activeDecision);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParcelId, parcels]);

  const updateFieldLayoutAndRecalculate = async (nextPosition: FieldPosition) => {
    if (nextPosition === fieldLayoutPosition || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiSend(
        `/villages/${VILLAGE_ID}/field-layout`,
        "PUT",
        {
          anchor_field_block_id: FIELD_BLOCK_A_ID,
          movable_field_block_id: FIELD_BLOCK_B_ID,
          position: nextPosition,
          field_layout_position: nextPosition,
        },
        "v2",
      );
      setFieldLayoutPosition(nextPosition);
      await scoreVillage(false);
    } catch (e) {
      setError(normalizeTrText(e instanceof Error ? e.message : "Tarla yerleşim güncelleme hatası"));
    } finally {
      setBusy(false);
    }
  };

  const saveCropAndRecalculate = async () => {
    if (!selectedParcelId || !selectedCropId) return;
    setBusy(true);
    setError("");
    try {
      await apiSend(`/parcels/${selectedParcelId}/crop-plan`, "PUT", {
        season: SEASON,
        crop_id: selectedCropId,
        sowing_date: "2026-03-10",
      });
      await scoreVillage(false);
    } catch (e) {
      setError(normalizeTrText(e instanceof Error ? e.message : "Kaydetme hatası"));
    } finally {
      setBusy(false);
    }
  };

  const activeRiskLevel = toRiskLevel(decision?.risk_level ?? selectedParcel?.risk_level);
  const badge = {
    bg: RISK_UI[activeRiskLevel].badgeBg,
    fg: RISK_UI[activeRiskLevel].badgeFg,
  };
  const positionLabel: Record<FieldPosition, string> = {
    top: "Üst",
    right: "Sağ",
    bottom: "Alt",
    left: "Sol",
  };
  const recommendationTone = {
    bg: RISK_UI[activeRiskLevel].panelBg,
    border: RISK_UI[activeRiskLevel].panelBorder,
    title: RISK_UI[activeRiskLevel].panelTitle,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        fontFamily: "\"Nunito Sans\", \"Segoe UI\", sans-serif",
        background: "linear-gradient(180deg, #f6f4ea 0%, #eef3e8 100%)",
      }}
    >
      <header
        style={{
          padding: "14px 22px",
          background:
            "linear-gradient(90deg, #213329 0%, #2f4d37 45%, #406545 100%)",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(223,236,221,0.24)",
          boxShadow: "0 6px 20px rgba(20, 39, 27, 0.24)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1.08rem", fontWeight: 800, letterSpacing: "0.02em" }}>
          Bilinçli Çiftçi Köyü
        </h3>
        <span style={{ fontSize: "0.8rem", opacity: 0.9, fontWeight: 700 }}>TEKNOFEST 2026 | v2 Demo</span>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 4, position: "relative", height: "100%" }}>
          <FarmMap
            parcels={parcels}
            selectedParcelId={selectedParcelId}
            onSelect={setSelectedParcelId}
            secondaryFieldPosition={fieldLayoutPosition}
            onSecondaryFieldPositionChange={(position) => void updateFieldLayoutAndRecalculate(position)}
            layoutBusy={busy}
          />
        </div>

        <div
          style={{
            flex: 1,
            minWidth: "330px",
            maxWidth: "430px",
            background: "linear-gradient(180deg, #ffffff 0%, #f8fbf6 100%)",
            borderLeft: "1px solid #d7e4d6",
            padding: "22px 20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "15px",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", color: "#24402b", letterSpacing: "0.01em" }}>Parsel Analizi</h3>

          {loading ? <div>Yükleniyor...</div> : null}
          {error ? (
            <div
              style={{
                color: "#b42318",
                background: "#fff0f0",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #f4c8c8",
              }}
            >
              {error}
            </div>
          ) : null}

          {selectedParcel ? (
            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #dbe7da",
                borderRadius: "14px",
                padding: "16px",
                boxShadow: "0 10px 20px rgba(28, 57, 36, 0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0 }}>Parsel {selectedParcel.name}</h4>
                <span
                  style={{
                    backgroundColor: badge.bg,
                    color: badge.fg,
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  {decision?.risk_level ?? selectedParcel.risk_level ?? "UNKNOWN"}
                </span>
              </div>
              <p style={{ margin: "10px 0", fontSize: "0.9rem" }}>
                <strong>Risk Skoru:</strong> %{decision?.risk_score ?? selectedParcel.risk_score ?? 0}
              </p>
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 12px",
                  backgroundColor: "#f3f8f0",
                  borderRadius: "10px",
                  border: "1px solid #d8e6d7",
                  display: "grid",
                  gap: "6px",
                  fontSize: "0.84rem",
                }}
              >
                <div>
                  <strong>Seçili Parselin Blok Adı:</strong>{" "}
                  {selectedParcel.field_block?.name ?? "Bilinmiyor"}
                </div>
                <div>
                  <strong>Aktif Tarla B Konumu:</strong> {positionLabel[fieldLayoutPosition]}
                </div>
                <div>
                  <strong>Komşuluk Tipi Özeti:</strong>{" "}
                  {neighborSummaryLoading
                    ? "Yükleniyor..."
                    : `INTRA_BLOCK: ${neighborSummary?.intraBlockCount ?? 0}, INTER_BLOCK: ${
                        neighborSummary?.interBlockCount ?? 0
                      }`}
                  {neighborSummary?.source === "decision_fallback" ? " (karar verisinden özet)" : ""}
                </div>
              </div>

              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "#f7faf5",
                  borderRadius: "10px",
                  border: "1px solid #e0ebde",
                }}
              >
                <label style={{ fontSize: "0.8rem", fontWeight: "bold", display: "block", marginBottom: "5px" }}>
                  Ekilmesi Planlanan Ürün
                </label>
                <select
                  value={selectedCropId}
                  onChange={(e) => setSelectedCropId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: "8px",
                    border: "1px solid #cdddc9",
                    background: "#fff",
                    color: "#2c3f30",
                  }}
                >
                  {crops.map((crop) => (
                    <option key={crop.crop_id} value={crop.crop_id}>
                      {crop.crop_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void saveCropAndRecalculate()}
                  disabled={busy || !selectedCropId}
                  style={{
                    marginTop: "11px",
                    width: "100%",
                    padding: "10px 12px",
                    background: "linear-gradient(90deg, #2c7840 0%, #3a9152 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    opacity: busy ? 0.7 : 1,
                    fontWeight: 800,
                  }}
                >
                  Ürün Planını Kaydet + Hesapla
                </button>
              </div>

              <div style={{ marginTop: "12px" }}>
                <h5 style={{ margin: "0 0 5px 0", fontSize: "0.85rem", color: "#7f8c8d" }}>Risk Nedenleri</h5>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem", color: "#c0392b" }}>
                  {(decision?.reasons ?? []).map((item) => (
                    <li key={`${item.code}-${item.text}`}>{getReasonTextTr(item)}</li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: "12px" }}>
                <div
                  style={{
                    marginTop: "6px",
                    background: recommendationTone.bg,
                    border: `1px solid ${recommendationTone.border}`,
                    borderRadius: "10px",
                    padding: "10px 12px",
                  }}
                >
                  <h5
                    style={{
                      margin: "0 0 6px 0",
                      fontSize: "0.85rem",
                      color: recommendationTone.title,
                    }}
                  >
                    Öneri Paneli (Dinamik)
                  </h5>
                  <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem", color: "#2f5a35" }}>
                    {(decision?.recommendations ?? []).map((item, idx) => (
                      <li key={`${item.type}-${idx}`}>{getRecommendationTextTr(item)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div>Parsel seçiniz.</div>
          )}

          <button
            type="button"
            onClick={() => void scoreVillage()}
            disabled={busy}
            style={{
              marginTop: "auto",
              padding: "12px",
              background: "linear-gradient(90deg, #315f9f 0%, #3d74be 100%)",
              color: "white",
              border: "none",
              borderRadius: "9px",
              fontWeight: 800,
              cursor: "pointer",
              opacity: busy ? 0.7 : 1,
              boxShadow: "0 8px 14px rgba(45, 96, 166, 0.24)",
            }}
          >
            {busy ? "Hesaplanıyor..." : "Yeniden Hesapla"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;

import { useEffect, useState } from "react";
import FarmMap from "./components/FarmMap";

type Crop = { crop_id: string; crop_name: string };
type Parcel = {
  parcel_id: string;
  name: string;
  status: "UNKNOWN" | "OK" | "RISKY" | "CRITICAL";
  crop: Crop | null;
  risk_score: number | null;
  risk_level: "UNKNOWN" | "OK" | "RISKY" | "CRITICAL" | null;
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

const API_BASE = "http://127.0.0.1:8000/api/v1";
const SEASON = "2026_Spring";
const VILLAGE_ID = "v1";

const badgeColor = (level?: string | null) => {
  switch (level) {
    case "OK":
      return { bg: "#d4f5dd", fg: "#1b8f4c" };
    case "RISKY":
      return { bg: "#fff4bf", fg: "#9a6a00" };
    case "CRITICAL":
      return { bg: "#ffd8d8", fg: "#b42318" };
    default:
      return { bg: "#edf0f2", fg: "#5f6b77" };
  }
};

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function apiSend<T>(path: string, method: "POST" | "PUT", body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedParcel = parcels.find((p) => p.parcel_id === selectedParcelId) ?? null;

  const loadParcels = async () => {
    const res = await apiGet<{ parcels: Parcel[] }>(
      `/villages/${VILLAGE_ID}/parcels?season=${SEASON}`,
    );
    setParcels(res.parcels);
    if (!selectedParcelId && res.parcels.length > 0) {
      setSelectedParcelId(res.parcels[0].parcel_id);
      setSelectedCropId(res.parcels[0].crop?.crop_id ?? "");
    }
  };

  const loadDecision = async (parcelId: string) => {
    const res = await apiGet<ParcelDecision>(`/parcels/${parcelId}/decision?season=${SEASON}`);
    setDecision(res);
  };

  const scoreVillage = async () => {
    setBusy(true);
    setError("");
    try {
      await apiSend("/decision/score", "POST", { village_id: VILLAGE_ID, season: SEASON });
      await loadParcels();
      if (selectedParcelId) {
        await loadDecision(selectedParcelId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hesaplama hatasi");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const cropRes = await apiGet<{ crops: Crop[] }>("/crops");
        setCrops(cropRes.crops);
        await scoreVillage();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Baslangic yukleme hatasi");
      } finally {
        setLoading(false);
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedParcelId) return;
    setSelectedCropId(selectedParcel?.crop?.crop_id ?? "");
    void loadDecision(selectedParcelId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParcelId]);

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
      await scoreVillage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydetme hatasi");
      setBusy(false);
    }
  };

  const badge = badgeColor(decision?.risk_level ?? selectedParcel?.risk_level);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        fontFamily: "Segoe UI, Roboto, sans-serif",
      }}
    >
      <header
        style={{
          padding: "10px 20px",
          backgroundColor: "#1a252f",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Bilincli Ciftci Koyu</h3>
        <span style={{ fontSize: "0.8rem", opacity: 0.85 }}>TEKNOFEST 2026 | v1 Demo</span>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 4, position: "relative", height: "100%" }}>
          <FarmMap
            parcels={parcels}
            selectedParcelId={selectedParcelId}
            onSelect={setSelectedParcelId}
          />
        </div>

        <div
          style={{
            flex: 1,
            minWidth: "320px",
            maxWidth: "420px",
            backgroundColor: "#ffffff",
            borderLeft: "1px solid #ddd",
            padding: "20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "15px",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", color: "#2c3e50" }}>Parsel Analizi</h3>

          {loading ? <div>Yukleniyor...</div> : null}
          {error ? (
            <div style={{ color: "#b42318", background: "#fff0f0", padding: "10px", borderRadius: "8px" }}>
              {error}
            </div>
          ) : null}

          {selectedParcel ? (
            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #e1e4e8",
                borderRadius: "10px",
                padding: "15px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
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

              <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "bold", display: "block", marginBottom: "5px" }}>
                  Ekilmesi Planlanan Urun
                </label>
                <select
                  value={selectedCropId}
                  onChange={(e) => setSelectedCropId(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "5px", border: "1px solid #dcdde1" }}
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
                    marginTop: "10px",
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "#2d9cdb",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  Urun Planini Kaydet + Hesapla
                </button>
              </div>

              <div style={{ marginTop: "12px" }}>
                <h5 style={{ margin: "0 0 5px 0", fontSize: "0.85rem", color: "#7f8c8d" }}>Risk Nedenleri</h5>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem", color: "#c0392b" }}>
                  {(decision?.reasons ?? []).map((item) => (
                    <li key={`${item.code}-${item.text}`}>{item.text}</li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: "12px" }}>
                <h5 style={{ margin: "0 0 5px 0", fontSize: "0.85rem", color: "#7f8c8d" }}>Oneriler</h5>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem", color: "#27ae60" }}>
                  {(decision?.recommendations ?? []).map((item, idx) => (
                    <li key={`${item.type}-${idx}`}>{item.text}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div>Parsel seciniz.</div>
          )}

          <button
            type="button"
            onClick={() => void scoreVillage()}
            disabled={busy}
            style={{
              marginTop: "auto",
              padding: "12px",
              backgroundColor: "#3498db",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Hesaplaniyor..." : "Yeniden Hesapla"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;

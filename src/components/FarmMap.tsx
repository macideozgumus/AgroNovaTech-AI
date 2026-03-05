import { useMemo } from "react";
import { MapContainer, Rectangle, TileLayer, Tooltip } from "react-leaflet";
import { RISK_UI, toRiskLevel } from "../ui/risk";

type Parcel = {
  parcel_id: string;
  name: string;
  status: "UNKNOWN" | "OK" | "RISKY" | "CRITICAL";
  risk_level?: "UNKNOWN" | "OK" | "RISKY" | "CRITICAL" | null;
  field_block?: {
    field_block_id: string;
    name: string;
  } | null;
};

type FieldPosition = "top" | "right" | "bottom" | "left";

type Props = {
  parcels: Parcel[];
  selectedParcelId: string | null;
  onSelect: (parcelId: string) => void;
  secondaryFieldPosition: FieldPosition;
  onSecondaryFieldPositionChange: (position: FieldPosition) => void;
  layoutBusy?: boolean;
};

type PlottedParcel = {
  parcel: Parcel;
  bounds: [[number, number], [number, number]];
  center: [number, number];
  blockName: string;
};

const BASE_CENTER = { lat: 39.0, lng: 35.0 };
const BLOCK_SHIFT: Record<FieldPosition, { lat: number; lng: number }> = {
  top: { lat: 0.018, lng: 0 },
  right: { lat: 0, lng: 0.026 },
  bottom: { lat: -0.018, lng: 0 },
  left: { lat: 0, lng: -0.026 },
};

function getBlockName(parcel: Parcel) {
  const numericId = Number.parseInt(parcel.parcel_id.replace(/\D/g, ""), 10);
  const fallbackBlockName =
    Number.isFinite(numericId) && numericId > 4 ? "Tarla Blogu B" : "Tarla Blogu A";
  return parcel.field_block?.name ?? fallbackBlockName;
}

function getGridIndex(parcel: Parcel) {
  const fromName = Number.parseInt(parcel.name.replace(/\D/g, ""), 10);
  if (Number.isFinite(fromName) && fromName > 0) {
    return Math.min(fromName, 8) - 1;
  }
  const fromId = Number.parseInt(parcel.parcel_id.replace(/\D/g, ""), 10);
  if (Number.isFinite(fromId) && fromId > 0) {
    return Math.min(fromId, 8) - 1;
  }
  return 0;
}

function parcelPoint(index: number, center: { lat: number; lng: number }) {
  const row = Math.floor(index / 2);
  const col = index % 2;
  const lat = center.lat + (1.5 - row) * 0.0044;
  const lng = center.lng + (col === 0 ? -0.0042 : 0.0042);
  return { lat, lng };
}

function parcelBounds(center: { lat: number; lng: number }): [[number, number], [number, number]] {
  const halfLat = 0.00165;
  const halfLng = 0.00325;
  return [
    [center.lat - halfLat, center.lng - halfLng],
    [center.lat + halfLat, center.lng + halfLng],
  ];
}

function FarmMap({
  parcels,
  selectedParcelId,
  onSelect,
  secondaryFieldPosition,
  onSecondaryFieldPositionChange,
  layoutBusy = false,
}: Props) {
  const plottedParcels = useMemo<PlottedParcel[]>(() => {
    const shift = BLOCK_SHIFT[secondaryFieldPosition];
    const centers = {
      a: BASE_CENTER,
      b: { lat: BASE_CENTER.lat + shift.lat, lng: BASE_CENTER.lng + shift.lng },
    };

    return parcels.map((parcel) => {
      const blockName = getBlockName(parcel);
      const blockKey = blockName.includes("B") ? "b" : "a";
      const index = getGridIndex(parcel);
      const point = parcelPoint(index, centers[blockKey]);
      const bounds = parcelBounds(point);
      return { parcel, bounds, center: [point.lat, point.lng], blockName };
    });
  }, [parcels, secondaryFieldPosition]);

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        gap: "10px",
        padding: "12px",
        background:
          "radial-gradient(circle at 12% 18%, rgba(152, 204, 145, 0.32) 0%, rgba(152, 204, 145, 0) 45%), radial-gradient(circle at 90% 85%, rgba(225, 195, 120, 0.25) 0%, rgba(225, 195, 120, 0) 42%), linear-gradient(145deg, #edf6e8 0%, #e3efdc 50%, #f3efe2 100%)",
        borderRight: "1px solid #c7d6c6",
      }}
    >
      <section
        style={{
          borderRadius: "12px",
          background: "rgba(255,255,255,0.9)",
          border: "1px solid #d6e2d5",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "grid", gap: "4px" }}>
          <div style={{ fontWeight: 800, color: "#2f4f34", letterSpacing: "0.02em" }}>
            Tarla B Konumlandırma
          </div>
          <div style={{ fontSize: "0.78rem", color: "#5f7161" }}>
            Sonuç geldikçe parsel renkleri risk seviyesine göre haritada güncellenir.
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {[
            { value: "top", label: "Üst" },
            { value: "right", label: "Sağ" },
            { value: "bottom", label: "Alt" },
            { value: "left", label: "Sol" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSecondaryFieldPositionChange(option.value as FieldPosition)}
              disabled={layoutBusy}
              style={{
                border:
                  secondaryFieldPosition === option.value ? "2px solid #2f6d36" : "1px solid #c6d4c5",
                background: secondaryFieldPosition === option.value ? "#e7f4e3" : "rgba(255,255,255,0.92)",
                color: secondaryFieldPosition === option.value ? "#224f29" : "#3d5541",
                fontWeight: 800,
                borderRadius: "999px",
                padding: "7px 13px",
                cursor: "pointer",
                opacity: layoutBusy ? 0.7 : 1,
                transition: "all 140ms ease",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <div style={{ minHeight: 0, borderRadius: "14px", overflow: "hidden", border: "1px solid #d6e2d5" }}>
        <MapContainer
          center={[BASE_CENTER.lat, BASE_CENTER.lng]}
          zoom={13}
          style={{ width: "100%", height: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {plottedParcels.map(({ parcel, bounds, center, blockName }) => {
            const level = toRiskLevel(parcel.risk_level ?? parcel.status);
            const color = RISK_UI[level].marker;
            const isSelected = selectedParcelId === parcel.parcel_id;

            return (
              <Rectangle
                key={parcel.parcel_id}
                bounds={bounds}
                pathOptions={{
                  color: isSelected ? "#103913" : "#f7faf8",
                  weight: isSelected ? 3.2 : 1.8,
                  fillColor: color,
                  fillOpacity: 0.86,
                }}
                eventHandlers={{
                  click: () => onSelect(parcel.parcel_id),
                }}
              >
                <Tooltip direction="center" permanent={isSelected} position={center}>
                  <div style={{ fontWeight: 800, fontSize: "0.74rem" }}>
                    {blockName} - {parcel.name}
                  </div>
                  <div>
                    Risk: {level}
                  </div>
                </Tooltip>
              </Rectangle>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

export default FarmMap;

import { useMemo, useState, type CSSProperties } from "react";

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

type Props = {
  parcels: Parcel[];
  selectedParcelId: string | null;
  onSelect: (parcelId: string) => void;
};

const riskColor = (level?: string | null) => {
  switch (level) {
    case "OK":
      return "#2ecc71";
    case "RISKY":
      return "#f1c40f";
    case "CRITICAL":
      return "#e74c3c";
    default:
      return "#95a5a6";
  }
};

function FarmMap({ parcels, selectedParcelId, onSelect }: Props) {
  const [secondaryFieldPosition, setSecondaryFieldPosition] = useState<
    "top" | "right" | "bottom" | "left"
  >("right");

  const groupedParcels = useMemo(
    () =>
      parcels.reduce<Record<string, Parcel[]>>((acc, parcel) => {
    const numericId = Number.parseInt(parcel.parcel_id.replace(/\D/g, ""), 10);
    const fallbackBlockName =
      Number.isFinite(numericId) && numericId > 4 ? "Tarla Blogu B" : "Tarla Blogu A";
    const blockName = parcel.field_block?.name ?? fallbackBlockName;
    if (!acc[blockName]) {
      acc[blockName] = [];
    }
    acc[blockName].push(parcel);
    return acc;
  }, {}),
    [parcels],
  );

  if (!groupedParcels["Tarla Blogu A"]) {
    groupedParcels["Tarla Blogu A"] = [];
  }
  if (!groupedParcels["Tarla Blogu B"]) {
    groupedParcels["Tarla Blogu B"] = [];
  }

  const blockSlots: Record<"top" | "right" | "bottom" | "left" | "center", CSSProperties> = {
    top: { gridColumn: 2, gridRow: 1 },
    right: { gridColumn: 3, gridRow: 2 },
    bottom: { gridColumn: 2, gridRow: 3 },
    left: { gridColumn: 1, gridRow: 2 },
    center: { gridColumn: 2, gridRow: 2 },
  };

  const renderFieldBlock = (blockName: string, blockParcels: Parcel[]) => {
    const emptySlots = Math.max(0, 8 - blockParcels.length);

    return (
      <section
        key={blockName}
        style={{
          borderRadius: "10px",
          background: "rgba(255,255,255,0.82)",
          border: "1px solid #d8dde3",
          padding: "10px",
          display: "grid",
          gap: "8px",
          minWidth: "280px",
          boxShadow: "0 10px 24px rgba(27, 62, 37, 0.08)",
        }}
      >
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#48624a" }}>{blockName}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
          {blockParcels.map((parcel) => (
            <button
              key={parcel.parcel_id}
              type="button"
              onClick={() => onSelect(parcel.parcel_id)}
              style={{
                border:
                  selectedParcelId === parcel.parcel_id
                    ? "2px solid #2980b9"
                    : "1px solid #d8dde3",
                borderRadius: "10px",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                color: "#2c3e50",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <span>{parcel.name}</span>
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "999px",
                  backgroundColor: riskColor(parcel.risk_level ?? parcel.status),
                  display: "inline-block",
                }}
              />
            </button>
          ))}
          {Array.from({ length: emptySlots }, (_, index) => (
            <div
              key={`${blockName}-empty-${index}`}
              style={{
                border: "1px dashed #c9d4da",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.45)",
                minHeight: "42px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8a97a3",
                fontSize: "0.78rem",
                fontWeight: 600,
              }}
            >
              Bos Parsel
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "grid",
        placeItems: "center",
        background:
          "linear-gradient(135deg, #dff3df 0%, #c6e7b7 35%, #f4edd2 100%)",
        borderRight: "1px solid #d7dfd1",
      }}
    >
      <div
        style={{
        width: "90%",
        height: "85%",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.6)",
        border: "1px dashed #7aa874",
        padding: "12px",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        gap: "12px",
      }}
    >
        <section
          style={{
            borderRadius: "10px",
            background: "rgba(255,255,255,0.74)",
            border: "1px solid #d8dde3",
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "grid", gap: "4px" }}>
            <div style={{ fontWeight: 700, color: "#2f4f34" }}>Tarla B Konumlandirma</div>
            <div style={{ fontSize: "0.78rem", color: "#687781" }}>
              Kullanicinin ikinci tarlayi Tarla A&apos;nin hangi kenarina yerlestirecegini sec.
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {[
              { value: "top", label: "Ust" },
              { value: "right", label: "Sag" },
              { value: "bottom", label: "Alt" },
              { value: "left", label: "Sol" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setSecondaryFieldPosition(option.value as "top" | "right" | "bottom" | "left")
                }
                style={{
                  border:
                    secondaryFieldPosition === option.value
                      ? "2px solid #2f80ed"
                      : "1px solid #c9d4da",
                  background:
                    secondaryFieldPosition === option.value ? "#eef6ff" : "rgba(255,255,255,0.9)",
                  color: "#24435b",
                  fontWeight: 700,
                  borderRadius: "999px",
                  padding: "8px 14px",
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 1fr) minmax(280px, 1.2fr) minmax(220px, 1fr)",
            gridTemplateRows: "minmax(120px, auto) minmax(220px, auto) minmax(120px, auto)",
            gap: "12px",
            alignItems: "center",
            justifyItems: "center",
            minHeight: 0,
          }}
        >
          <div
            style={{
              ...blockSlots.center,
              width: "100%",
              display: "grid",
              gap: "8px",
            }}
          >
            {renderFieldBlock("Tarla Blogu A", groupedParcels["Tarla Blogu A"])}
          </div>

          <div
            style={{
              ...blockSlots[secondaryFieldPosition],
              width: "100%",
              display: "grid",
              gap: "8px",
            }}
          >
            {renderFieldBlock("Tarla Blogu B", groupedParcels["Tarla Blogu B"])}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FarmMap;

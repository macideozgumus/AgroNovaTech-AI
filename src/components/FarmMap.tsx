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
  const groupedParcels = parcels.reduce<Record<string, Parcel[]>>((acc, parcel) => {
    const numericId = Number.parseInt(parcel.parcel_id.replace(/\D/g, ""), 10);
    const fallbackBlockName =
      Number.isFinite(numericId) && numericId > 4 ? "Tarla Blogu B" : "Tarla Blogu A";
    const blockName = parcel.field_block?.name ?? fallbackBlockName;
    if (!acc[blockName]) {
      acc[blockName] = [];
    }
    acc[blockName].push(parcel);
    return acc;
  }, {});

  if (!groupedParcels["Tarla Blogu A"]) {
    groupedParcels["Tarla Blogu A"] = [];
  }
  if (!groupedParcels["Tarla Blogu B"]) {
    groupedParcels["Tarla Blogu B"] = [];
  }

  const orderedBlocks = ["Tarla Blogu A", "Tarla Blogu B"];

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
          background: "rgba(255,255,255,0.65)",
          border: "1px dashed #7aa874",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "14px",
          padding: "12px",
          alignContent: "start",
        }}
      >
        {orderedBlocks.map((blockName) => {
          const blockParcels = groupedParcels[blockName] ?? [];
          const emptySlots = Math.max(0, 8 - blockParcels.length);

          return (
          <section
            key={blockName}
            style={{
              borderRadius: "10px",
              background: "rgba(255,255,255,0.75)",
              border: "1px solid #d8dde3",
              padding: "10px",
              display: "grid",
              gap: "8px",
            }}
          >
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#48624a" }}>
              {blockName}
            </div>
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
        })}
      </div>
    </div>
  );
}

export default FarmMap;

type Parcel = {
  parcel_id: string;
  name: string;
  status: "UNKNOWN" | "OK" | "RISKY" | "CRITICAL";
  risk_level?: "UNKNOWN" | "OK" | "RISKY" | "CRITICAL" | null;
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
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(3, 1fr)",
          gap: "10px",
          padding: "12px",
        }}
      >
        {parcels.map((parcel) => (
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
        {parcels.length < 9 ? <div /> : null}
      </div>
    </div>
  );
}

export default FarmMap;

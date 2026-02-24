function FarmMap() {
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
        {["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"].map((parcel) => {
          const color =
            parcel === "P1"
              ? "#f1c40f"
              : parcel === "P5"
              ? "#e74c3c"
              : "#2ecc71";

          return (
            <button
              key={parcel}
              type="button"
              style={{
                border: "1px solid #d8dde3",
                borderRadius: "10px",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                color: "#2c3e50",
                fontWeight: 600,
              }}
            >
              <span>{parcel}</span>
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "999px",
                  backgroundColor: color,
                  display: "inline-block",
                }}
              />
            </button>
          );
        })}
        <div />
      </div>
    </div>
  );
}

export default FarmMap;


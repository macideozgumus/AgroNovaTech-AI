import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Dökümandaki Renk Standartları (Madde 6)
const STATUS_COLORS = {
  OK: '#2ECC71',       // Yeşil
  RISKY: '#F1C40F',    // Sarı
  CRITICAL: '#E74C3C', // Kırmızı
  UNKNOWN: '#BDC3C7'   // Gri
};

// Demo Veri Seti v1 (8 Parsel)
const demoParcels = [
  { id: 'p1', name: 'P1', status: 'RISKY', offset: [0, 0] },
  { id: 'p2', name: 'P2', status: 'OK', offset: [0, 1] },
  { id: 'p3', name: 'P3', status: 'OK', offset: [0, 2] },
  { id: 'p4', name: 'P4', status: 'OK', offset: [1, 0] },
  { id: 'p5', name: 'P5', status: 'OK', offset: [1, 1] },
  { id: 'p6', name: 'P6', status: 'OK', offset: [1, 2] },
  { id: 'p7', name: 'P7', status: 'OK', offset: [2, 0] },
  { id: 'p8', name: 'P8', status: 'OK', offset: [2, 1] },
];

const FarmMap = () => {
  // Parselleri haritada kutu kutu dizmek için yardımcı fonksiyon
  const createBounds = (row: number, col: number) => {
    const startLat = 39.905;
    const startLng = 32.815;
    const size = 0.005; // Kutuların boyutu
    return [
      [startLat - row * size, startLng + col * size],
      [startLat - (row + 1) * size, startLng + col * size],
      [startLat - (row + 1) * size, startLng + (col + 1) * size],
      [startLat - row * size, startLng + (col + 1) * size],
    ];
  };

  return (
    <MapContainer 
      center={[39.90, 32.82]} 
      zoom={14} 
      style={{ height: '500px', width: '100%', borderRadius: '12px' }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      
      {demoParcels.map((p) => (
        <Polygon 
          key={p.id} 
          positions={createBounds(p.offset[0], p.offset[1]) as any}
          pathOptions={{ 
            color: STATUS_COLORS[p.status as keyof typeof STATUS_COLORS], 
            fillOpacity: 0.7 
          }}
        >
          <Popup>
            <strong>{p.name} Analizi</strong> <br />
            Durum: {p.status}
          </Popup>
        </Polygon>
      ))}
    </MapContainer>
  );
};

export default FarmMap;
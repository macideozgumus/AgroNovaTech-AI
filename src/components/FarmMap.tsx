import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';

// Risk Seviyesi Renk Standartları
export const RISK_LEVEL_COLORS = {
  OK: '#2ecc71',       // GÜVENLİ
  RISKY: '#f1c40f',    // RİSKLİ
  CRITICAL: '#e74c3c', // KRİTİK
  UNKNOWN: '#95a5a6'   // BELİRSİZ
};

interface FarmMapProps {
  onSelect: (id: string) => void;
  parcels: any[];
}

const FarmMap = ({ onSelect, parcels }: FarmMapProps) => {
  const centerPoint: LatLngExpression = [39.8055, 32.8055];

  return (
    <MapContainer center={centerPoint} zoom={16} style={{ height: '100%', width: '100%', borderRadius: '12px' }}>
      <TileLayer 
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution='&copy; Esri Uydu Görüntüleri'
      />
      
      {parcels.map((p) => (
        <Polygon 
          key={p.parcel_id}
          positions={p.geometry as LatLngExpression[]} 
          pathOptions={{ 
            color: 'rgba(255,255,255,0.7)', 
            fillColor: RISK_LEVEL_COLORS[p.risk_level as keyof typeof RISK_LEVEL_COLORS] || RISK_LEVEL_COLORS.UNKNOWN, 
            fillOpacity: 0.5, 
            weight: 2,
            dashArray: '5, 5'
          }}
          eventHandlers={{ click: () => onSelect(p.parcel_id) }}
        >
          <Popup>
            <strong>Parsel {p.name}</strong> <br />
            Durum: {p.risk_level === 'OK' ? 'Güvenli' : p.risk_level === 'RISKY' ? 'Riskli' : 'Kritik'}
          </Popup>
        </Polygon>
      ))}
    </MapContainer>
  );
};

export default FarmMap;
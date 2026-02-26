import { useState } from 'react';
import FarmMap, { RISK_LEVEL_COLORS } from './components/FarmMap';

interface Parcel {
  parcel_id: string;
  name: string;
  risk_score: number;
  risk_level: 'OK' | 'RISKY' | 'CRITICAL' | 'UNKNOWN';
  crop: { crop_id: string; crop_name: string };
  geometry: number[][];
}

function App() {
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("p1");
  
  // 8 Parsel Veri Seti (Sözleşmeye Uygun)
  const [parcels] = useState<Parcel[]>([
    { parcel_id: "p1", name: "P1", risk_score: 68, risk_level: "RISKY", crop: { crop_id: "c_wheat", crop_name: "Buğday" }, geometry: [[39.8065, 32.8040], [39.8075, 32.8040], [39.8075, 32.8055], [39.8065, 32.8055]] },
    { parcel_id: "p2", name: "P2", risk_score: 15, risk_level: "OK", crop: { crop_id: "c_sun", crop_name: "Ayçiçek" }, geometry: [[39.8065, 32.8055], [39.8075, 32.8055], [39.8075, 32.8070], [39.8065, 32.8070]] },
    { parcel_id: "p3", name: "P3", risk_score: 20, risk_level: "OK", crop: { crop_id: "c_wheat", crop_name: "Buğday" }, geometry: [[39.8055, 32.8040], [39.8065, 32.8040], [39.8065, 32.8055], [39.8055, 32.8055]] },
    { parcel_id: "p4", name: "P4", risk_score: 45, risk_level: "RISKY", crop: { crop_id: "c_wheat", crop_name: "Buğday" }, geometry: [[39.8055, 32.8055], [39.8065, 32.8055], [39.8065, 32.8070], [39.8055, 32.8070]] },
    { parcel_id: "p5", name: "P5", risk_score: 10, risk_level: "OK", crop: { crop_id: "c_sun", crop_name: "Ayçiçek" }, geometry: [[39.8045, 32.8040], [39.8055, 32.8040], [39.8055, 32.8055], [39.8045, 32.8055]] },
    { parcel_id: "p6", name: "P6", risk_score: 5, risk_level: "OK", crop: { crop_id: "c_corn", crop_name: "Mısır" }, geometry: [[39.8045, 32.8055], [39.8055, 32.8055], [39.8055, 32.8070], [39.8045, 32.8070]] },
    { parcel_id: "p7", name: "P7", risk_score: 12, risk_level: "OK", crop: { crop_id: "c_bar", crop_name: "Arpa" }, geometry: [[39.8035, 32.8040], [39.8045, 32.8040], [39.8045, 32.8055], [39.8035, 32.8055]] },
    { parcel_id: "p8", name: "P8", risk_score: 85, risk_level: "CRITICAL", crop: { crop_id: "c_wheat", crop_name: "Buğday" }, geometry: [[39.8035, 32.8055], [39.8045, 32.8055], [39.8045, 32.8070], [39.8035, 32.8070]] },
  ]);

  const currentParcel = parcels.find(p => p.parcel_id === selectedId)!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#0f172a', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      
      {/* DEMO SÜRÜM BANDI */}
      <div style={{ background: '#e67e22', color: '#fff', textAlign: 'center', padding: '6px', fontSize: '0.8rem', fontWeight: 'bold', zIndex: 1000 }}>
        ⚠️ AGRONOVA AI - DEMO SÜRÜM (ÖN DEĞERLENDİRME AŞAMASI)
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* HARİTA ALANI */}
        <div style={{ flex: 3.5, padding: '15px' }}>
          <FarmMap parcels={parcels} onSelect={setSelectedId} />
        </div>

        {/* ANALİZ PANELİ */}
        <div style={{ flex: 1, minWidth: '400px', background: '#1e293b', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px', borderLeft: '1px solid #334155' }}>
          <div style={{ borderBottom: '1px solid #334155', paddingBottom: '15px' }}>
            <h1 style={{ color: '#2ecc71', margin: 0, fontSize: '1.6rem' }}>AGRONOVA AI</h1>
            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Köy Bazlı Akıllı Karar Destek Sistemi</span>
          </div>

          {/* PARSEL DURUM KARTI */}
          <div style={{ padding: '20px', borderRadius: '15px', background: '#0f172a', borderLeft: `6px solid ${RISK_LEVEL_COLORS[currentParcel.risk_level]}` }}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📍 Parsel {currentParcel.name}
            </h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Risk Puanı: <strong style={{ fontSize: '1.2rem' }}>%{currentParcel.risk_score}</strong></span>
              <span style={{ color: RISK_LEVEL_COLORS[currentParcel.risk_level], fontWeight: 'bold' }}>
                {currentParcel.risk_level === 'OK' ? 'GÜVENLİ' : currentParcel.risk_level === 'RISKY' ? 'RİSKLİ' : 'KRİTİK'}
              </span>
            </div>
          </div>

          {/* İŞLEM ALANI */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '600' }}>Yeni Ürün Planla (2026):</label>
            <select style={{ padding: '12px', borderRadius: '8px', background: '#334155', color: '#fff', border: '1px solid #475569' }}>
              <option value="c_wheat">🌾 Buğday</option>
              <option value="c_barley">🌾 Arpa</option>
              <option value="c_sun">🌻 Ayçiçek</option>
              <option value="c_corn">🌽 Mısır</option>
            </select>
            <button 
              onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }}
              disabled={loading}
              style={{ 
                marginTop: '10px', padding: '16px', background: '#2ecc71', color: '#0f172a', 
                fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer',
                transition: '0.3s'
              }}
            >
              {loading ? '🤖 ANALİZ EDİLİYOR...' : 'ANALİZİ BAŞLAT'}
            </button>
          </div>

          {/* ÖNERİ PANELİ */}
          <div style={{ flex: 1, padding: '20px', background: '#334155', borderRadius: '12px', border: '1px solid #475569', overflowY: 'auto' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#f1c40f', display: 'flex', alignItems: 'center', gap: '8px' }}>
              💡 Zirai Öneriler
            </h4>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6' }}>
              {currentParcel.risk_level === 'OK' ? (
                <p>✅ Mevcut ekim planı köy geneliyle uyumlu görünüyor. Toprak verimliliği korunmaktadır.</p>
              ) : (
                <>
                  <p>⚠️ <strong>Sorun:</strong> Komşu parsellerle ürün uyumsuzluğu ve toprak yorgunluğu riski.</p>
                  <p>📌 <strong>Eylem:</strong> Azot dengesi için münavebeli ekim (Arpa veya Baklagil) yapılması önerilir.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
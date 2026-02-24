import FarmMap from './components/FarmMap';

function App() {
  return (
    // Tüm ekranı kaplayan ana kutu
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      width: '100vw', 
      overflow: 'hidden', 
      fontFamily: 'Segoe UI, Roboto, sans-serif'
    }}>
      
      {/* Üst Başlık */}
      <header style={{ 
        padding: '10px 20px', 
        backgroundColor: '#1a252f', 
        color: 'white', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        zIndex: 1000
      }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>🌿 Bilinçli Çiftçi Köyü</h3>
        <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>TEKNOFEST 2026 | v1 Demo</span>
      </header>

      {/* Ana Gövde */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* SOL: HARİTA */}
        <div style={{ flex: 4, position: 'relative', height: '100%' }}>
          <FarmMap />
        </div>

        {/* SAĞ: ANALİZ PANELİ */}
        <div style={{ 
          flex: 1, 
          minWidth: '320px', 
          maxWidth: '400px', 
          backgroundColor: '#ffffff', 
          borderLeft: '1px solid #ddd',
          padding: '20px',
          overflowY: 'auto', 
          display: 'flex',
          flexDirection: 'column',
          gap: '15px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '5px' }}>
            Parsel Analizi
          </h3>
          
          {/* P1 Analiz Kartı */}
          <div style={{ 
            backgroundColor: '#fff', 
            border: '1px solid #e1e4e8',
            borderRadius: '10px', 
            padding: '15px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, color: '#e67e22' }}>📍 Parsel P1</h4>
              <span style={{ backgroundColor: '#f1c40f', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>RISKY</span>
            </div>
            
            <p style={{ margin: '10px 0', fontSize: '0.9rem' }}><strong>Risk Skoru:</strong> %68</p>

            {/* --- ÜRÜN SEÇME BÖLÜMÜ (YENİ EKLENDİ) --- */}
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#34495e', display: 'block', marginBottom: '5px' }}>
                Ekilmesi Planlanan Ürün:
              </label>
              <select style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '5px', 
                border: '1px solid #dcdde1',
                fontSize: '0.9rem'
              }}>
                <option value="c_wheat">Buğday</option>
                <option value="c_barley">Arpa (Münavebe Önerisi)</option>
                <option value="c_sunflower">Ayçiçek</option>
                <option value="c_corn">Mısır</option>
              </select>
            </div>
            {/* -------------------------------------- */}
            
            <div style={{ marginTop: '15px' }}>
              <h5 style={{ margin: '0 0 5px 0', fontSize: '0.85rem', color: '#7f8c8d' }}>⚠️ RİSK NEDENLERİ</h5>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: '#c0392b' }}>
                <li>Komşu uyumsuzluğu (Ayçiçek)</li>
                <li>Yüksek ürün yoğunluğu</li>
              </ul>
            </div>

            <div style={{ marginTop: '15px' }}>
              <h5 style={{ margin: '0 0 5px 0', fontSize: '0.85rem', color: '#7f8c8d' }}>💡 ÖNERİLER</h5>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: '#27ae60' }}>
                <li>Münavebe: Arpa önerilir</li>
                <li>Ekim tarihini kaydırın</li>
              </ul>
            </div>
          </div>

          <button style={{
            marginTop: 'auto',
            padding: '12px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background 0.3s'
          }}>
            YENİDEN HESAPLA
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
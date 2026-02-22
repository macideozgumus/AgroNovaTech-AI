# Architecture_API_Contract_v1

TEKNOFEST 2026 – Tarım Teknolojileri Yarışması  
**Proje:** Bilinçli Çiftçi Köyü: Köy Bazlı Akıllı Tarım ve Kolektif Karar Destek Sistemi  
**Kategori:** 2.2.2 – Tarım ve Hayvansal Üretim Veri Analitiği ve Bilgi Sistemleri  
**Sürüm:** v1 (ÖDR odaklı – demo + entegrasyon sözleşmesi)  
**Durum:** Revize edilmiş, demo-uyumlu mimari ve API kontratı

## 0. Bu Doküman Ne İşe Yarar?
Bu doküman, **Frontend ↔ Backend ↔ Decision Engine (Rules/ML)** arasında tek doğruluk kaynağıdır.

Bu sürüm aşağıdaki konuları sabitler:
- Minimum veri modeli (ERD seviyesi)
- API endpointleri ve JSON formatları
- Karar motoru giriş/çıkış sözleşmesi
- Demo veri seti ve uçtan uca demo akışı
- Backend modül tasarımı ve geliştirme sınırları

Bu sözleşmeye göre geliştirme yapılır. Alan adları ve JSON yapıları keyfi değiştirilmez.

## 1. Mevcut Taslağın Uygunluğu (Kısa Değerlendirme)
Verdiğiniz taslak **genel olarak doğru yönde ve proje için uygundur**. Özellikle şu yönleri güçlüdür:
- Köy bazlı yaklaşımı merkeze alması
- Rules + ML hibrit karar mantığını erken tanımlaması
- Demo veri seti ve takım iş bölümü eklemesi
- Frontend/Backend/AI entegrasyonunu tek kontratta toplaması

Ancak ÖDR demo ve ekip içi entegrasyon için aşağıdaki noktalar netleştirilmelidir:
- `status` ile `risk_level` ayrımı (parsel durumu vs son karar sonucu)
- Standart hata cevap formatı
- ID, enum, tarih/saat format kuralları
- Senkron/asenkron karar hesaplama davranışı
- Backend katman yapısı (API / service / repository / engine adapter)
- Demo modu ile üretim modu sınırları

Aşağıdaki revize kontrat bu eksikleri giderir.

## 2. Sistem Mimari Kararı (ÖDR için)
### 2.1 Hedef
- Hızlı çalışan demo
- Gerçek bilgi sistemi hissi
- Modüler yapı sayesinde sonraki aşamada büyütülebilir mimari

### 2.2 Teknoloji Seçimi (v1)
- **Backend:** Python + FastAPI
- **Veritabanı:** PostgreSQL (v1), `v2` için PostGIS opsiyonel
- **Frontend:** React + TypeScript + Leaflet
- **Container:** Docker / Docker Compose
- **Auth:** JWT (demo için sade RBAC)

### 2.3 Modüler Mimari (Tek Repo, Modüler Servis)
1. **Map/Parcel Module**
- Köy, parsel, komşuluk, ürün planı yönetimi

2. **Decision Engine Module**
- Rules/ML risk hesaplama
- Açıklanabilir nedenler ve öneriler üretimi

3. **Auth Module**
- Giriş, token üretimi, rol kontrolü

4. **API Layer**
- Frontend ile kontrata uygun JSON iletişimi
- Request validation / response shaping

5. **Persistence Layer**
- DB erişimi, seed verisi, karar sonucu kayıtları

## 3. Backend Tasarımı (Önerilen v1 Yapısı)
Aşağıdaki yapı demo için yeterli, aynı zamanda ölçeklenebilir:

```text
backend/
  app/
    main.py
    api/
      v1/
        auth.py
        villages.py
        parcels.py
        decisions.py
    core/
      config.py
      security.py
      enums.py
    models/          # SQLAlchemy ORM
    schemas/         # Pydantic request/response
    services/
      parcel_service.py
      decision_service.py
    repositories/
      parcel_repo.py
      decision_repo.py
    decision_engine/
      adapter.py     # backend ↔ rules/ml contract
      rules_v1.py
    db/
      session.py
      seed_demo_v1.py
```

### 3.1 Katman Sorumlulukları
- `api`: endpoint ve HTTP seviyesinde doğrulama
- `schemas`: kontrattaki JSON yapılarının Pydantic karşılığı
- `services`: iş akışı orchestration (hesapla, kaydet, döndür)
- `repositories`: DB sorguları
- `decision_engine`: rules/ML motorunu kontrata uydurma
- `models`: veri tabanı tabloları

### 3.2 Tasarım İlkeleri (v1)
- Decision endpoint sonucu her zaman DB'ye yazar (`DecisionResult`)
- Frontend yalnızca API kontratındaki alanları kullanır
- Rules motoru başlangıçta in-process çalışabilir (ayrı mikroservis şart değil)
- ML entegrasyonu eklense bile `decision_engine.adapter` arayüzü değişmez

## 4. Veri Modeli (Minimum ERD v1)
> Not: v1’de geometri zorunlu değildir. Komşuluk manuel tanımlanır.

### 4.1 Tablolar
#### `village`
- `id` (uuid veya demo string: `v1`)
- `name` (string)
- `center_lat` (float, nullable)
- `center_lng` (float, nullable)
- `created_at` (timestamp)

#### `parcel`
- `id` (uuid veya demo string: `p1`)
- `village_id` (fk -> village.id)
- `name` (string, örn. `P1`)
- `status` (enum: `UNKNOWN | OK | RISKY | CRITICAL`)
- `geometry_json` (nullable, GeoJSON string/json; v1 opsiyonel)
- `created_at` (timestamp)

#### `parcel_adjacency`
- `id` (uuid)
- `village_id` (fk)
- `parcel_id` (fk -> parcel.id)
- `neighbor_parcel_id` (fk -> parcel.id)
- `weight` (float, nullable, 0–1)

**Kural:** v1 için yönlü kayıt tutulabilir (`p1->p2` ve `p2->p1` ayrı satırlar).

#### `crop_catalog`
- `id` (string, örn. `c_wheat`)
- `crop_name` (string)
- `group_name` (nullable string)
- `is_active` (bool, default true)

#### `parcel_crop_plan`
- `id` (uuid)
- `parcel_id` (fk)
- `season` (string, örn. `2026_Spring`)
- `crop_id` (fk -> crop_catalog.id)
- `sowing_date` (date, nullable)
- `notes` (text, nullable)
- `updated_at` (timestamp)

**Unique constraint:** (`parcel_id`, `season`)

#### `decision_result`
- `id` (uuid)
- `village_id` (fk)
- `parcel_id` (nullable; köy geneli sonuç için boş olabilir)
- `season` (string)
- `risk_score` (int, 0–100)
- `risk_level` (enum: `OK | RISKY | CRITICAL`)
- `reasons_json` (json)
- `recommendations_json` (json)
- `confidence` (float, nullable, 0–1)
- `model_version` (string)
- `decision_run_id` (string/uuid, aynı batch için ortak kimlik)
- `created_at` (timestamp)

### 4.2 Kavramsal İlişkiler (Özet)
- 1 `village` -> çok `parcel`
- 1 `parcel` -> çok `parcel_crop_plan` (sezon bazında)
- 1 `parcel` -> çok `decision_result` (sezon ve çalıştırma bazında)
- `parcel_adjacency` parseller arası komşuluğu temsil eder

## 5. Kontrat Kuralları (Genel)
### 5.1 API Versiyonlama
Tüm endpointler `api/v1` prefix'i ile yayınlanır.
- Örn: `POST /api/v1/decision/score`

### 5.2 Zaman/Tarih Formatı
- `date`: `YYYY-MM-DD`
- `datetime`: ISO-8601 (`2026-02-22T12:00:00+03:00`)

### 5.3 Enum Kuralları
Enum değerleri büyük harf ve sabittir.
- `UNKNOWN | OK | RISKY | CRITICAL`
- `ADMIN | FARMER`

### 5.4 ID Kuralları
- Prod ortamında UUID önerilir.
- Demo ortamında okunabilir ID kullanılabilir (`v1`, `p1`, `c_wheat`).
- Frontend ID tipini string kabul etmelidir.

### 5.5 Standart Hata Formatı
Tüm hata cevaplarında ortak format kullanılır:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "season alanı zorunludur.",
    "details": {
      "field": "season"
    }
  }
}
```

Örnek hata kodları:
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `INTERNAL_ERROR`

## 6. API Contract (v1) — Frontend ↔ Backend
## 6.1 Kimlik Doğrulama
### `POST /api/v1/auth/login`
**Request**
```json
{ "email": "user@x.com", "password": "*****" }
```

**Response (200)**
```json
{
  "ok": true,
  "access_token": "jwt...",
  "token_type": "bearer",
  "role": "FARMER"
}
```

### Roller (RBAC)
- `ADMIN`: sistem kurulumu/test/seed
- `FARMER`: parsel ürün girişi, karar görüntüleme

> Demo notu: ÖDR demosunda auth geçici olarak devre dışı bırakılabilir; ancak response formatı ve rol modeli korunmalıdır.

## 6.2 Köy Listesi (Demo için önerilen ek endpoint)
### `GET /api/v1/villages`
**Response (200)**
```json
{
  "villages": [
    {
      "village_id": "v1",
      "name": "Demo Köyü",
      "center": { "lat": 39.0, "lng": 35.0 }
    }
  ]
}
```

## 6.3 Köy Parsellerini Listeleme
### `GET /api/v1/villages/{villageId}/parcels?season=2026_Spring`
**Response (200)**
```json
{
  "village_id": "v1",
  "season": "2026_Spring",
  "parcels": [
    {
      "parcel_id": "p1",
      "name": "P1",
      "status": "RISKY",
      "crop": { "crop_id": "c_wheat", "crop_name": "Buğday" },
      "risk_score": 68,
      "risk_level": "RISKY"
    }
  ]
}
```

**Not:**
- `status`, UI'nin harita renk durumudur (genellikle son `risk_level` ile eşitlenir).
- `risk_score` ve `risk_level`, son karar sonucu varsa döner; yoksa `null` olabilir.

## 6.4 Ürün Kataloğu Listeleme (Frontend select için önerilen ek endpoint)
### `GET /api/v1/crops`
**Response (200)**
```json
{
  "crops": [
    { "crop_id": "c_wheat", "crop_name": "Buğday" },
    { "crop_id": "c_barley", "crop_name": "Arpa" },
    { "crop_id": "c_sunflower", "crop_name": "Ayçiçek" },
    { "crop_id": "c_corn", "crop_name": "Mısır" }
  ]
}
```

## 6.5 Parsel Ürün Planı Güncelleme
### `PUT /api/v1/parcels/{parcelId}/crop-plan`
**Request**
```json
{
  "season": "2026_Spring",
  "crop_id": "c_wheat",
  "sowing_date": "2026-03-10"
}
```

**Response (200)**
```json
{ "ok": true, "parcel_id": "p1", "season": "2026_Spring" }
```

## 6.6 Karar Hesaplatma (Köy Bazlı)
### `POST /api/v1/decision/score`
**Request**
```json
{
  "village_id": "v1",
  "season": "2026_Spring"
}
```

**Response (200)**
```json
{
  "ok": true,
  "job_id": "djob_123",
  "status": "COMPLETED",
  "computed_at": "2026-02-22T12:00:00+03:00"
}
```

**Durumlar (v1):**
- `COMPLETED` (senkron hesaplama)
- `QUEUED` (ileri sürüm / async)
- `RUNNING` (ileri sürüm / async)
- `FAILED`

> v1'de hesaplama senkron yapılabilir. Buna rağmen `job_id` ve `status` alanları response içinde korunur.

## 6.7 Parsel Karar Sonucu Görüntüleme
### `GET /api/v1/parcels/{parcelId}/decision?season=2026_Spring`
**Response (200)**
```json
{
  "parcel_id": "p1",
  "season": "2026_Spring",
  "risk_score": 68,
  "risk_level": "RISKY",
  "reasons": [
    {
      "code": "NEIGHBOR_INCOMPATIBLE",
      "text": "Komşu parsellerde uyumsuz ürün kombinasyonu tespit edildi."
    },
    {
      "code": "HIGH_DIVERSITY_PRESSURE",
      "text": "Köyde ürün dağılımı dengesiz."
    }
  ],
  "recommendations": [
    {
      "type": "CROP_SUGGESTION",
      "text": "Komşu uyumu için bu parselde arpa önerilir."
    },
    {
      "type": "ACTION",
      "text": "Ekim tarihini 7-10 gün kaydırmak risk azaltabilir."
    }
  ],
  "confidence": 0.72,
  "model_version": "rules_v1"
}
```

## 6.8 Köy Genel Önerisi (Opsiyonel ama faydalı v1 endpoint)
### `GET /api/v1/villages/{villageId}/decision-summary?season=2026_Spring`
Amaç: Köy geneli ürün dağılımı, risk dağılımı ve ortak önerileri döndürmek.

**Örnek Response (200)**
```json
{
  "village_id": "v1",
  "season": "2026_Spring",
  "risk_distribution": {
    "OK": 2,
    "RISKY": 5,
    "CRITICAL": 1,
    "UNKNOWN": 0
  },
  "shared_recommendations": [
    {
      "type": "VILLAGE_PLAN",
      "text": "Ayçiçek yoğunluğu belirli bölgelerde kümelenmeli, komşu buğday parseller azaltılmalı."
    }
  ],
  "model_version": "rules_v1"
}
```

## 7. Decision Engine Contract (v1) — Backend ↔ AI/Rules
Decision Engine (rules veya ML), backend'e her parsel için aşağıdaki formatta çıktı vermelidir:

```json
{
  "risk_score": 0,
  "risk_level": "OK",
  "reason_codes": ["CODE1", "CODE2"],
  "recommendations": [
    { "type": "CROP_SUGGESTION", "text": "..." }
  ],
  "confidence": 0.0,
  "model_version": "rules_v1"
}
```

### 7.1 Minimum Reason Codes
- `NEIGHBOR_INCOMPATIBLE`
- `HIGH_DIVERSITY_PRESSURE`
- `SAME_CROP_CLUSTERING`
- `UNKNOWN_DATA`

### 7.2 Recommendation Types (v1)
- `CROP_SUGGESTION`
- `ACTION`
- `WARNING`
- `VILLAGE_PLAN`

### 7.3 Backend'in Sorumluluğu
- `reason_codes` -> kullanıcıya gösterilecek `reasons[]` metinlerine dönüştürme (TR açıklama)
- Engine çıktısını `DecisionResult` tablosuna yazma
- `risk_level` değerini parsel `status` alanına yansıtma (v1 davranışı)

## 8. Rules + ML Birleşim Mantığı (Sabit)
- `R_rules`: 0–100 (kural tabanı risk)
- `R_ml`: 0–100 (ML risk) varsa
- `confidence_ml`: 0–1

### 8.1 Nihai Risk Hesabı
- ML yoksa: `R = R_rules`
- ML varsa: `R = (1 - λ) * R_rules + λ * R_ml`
- `λ = clamp(0.2 + 0.6 * confidence_ml, 0.2, 0.8)`

### 8.2 Risk Seviyesi Eşikleri
- `OK`: `0–39`
- `RISKY`: `40–69`
- `CRITICAL`: `70–100`

> v1 demo için `rules_v1` yeterlidir. ML alanları boş/null olabilir ancak response şeması korunur.

## 9. Demo Akışı (ÖDR için zorunlu uçtan uca senaryo)
### Senaryo
Harita -> ürün gir -> hesapla -> öneri gör

1. Kullanıcı köyü seçer (`v1`)
2. Haritada 8 parsel görünür (`P1..P8`)
3. Kullanıcı bir parsele tıklar (örn. `P1`)
4. Ürün seçer / değiştirir (`PUT /parcels/{id}/crop-plan`)
5. `Hesapla` çalıştırılır (`POST /decision/score`)
6. Harita rengi `risk_level` değerine göre güncellenir
7. Panelde neden + öneri gösterilir (`GET /parcels/{id}/decision`)

### Kabul Kriterleri (ÖDR)
- JSON alan adları bu kontratla uyumlu olacak
- `risk_level` harita rengini belirleyecek
- Sonuçlar `decision_result` tablosuna kaydedilecek
- `P1` başlangıç demo senaryosunda `RISKY` görünecek
- UI mock'tan gerçek API'ye geçerken JSON alan isimleri değişmeyecek

## 10. Demo Veri Seti v1 (Sabit Referans)
**Village ID:** `v1`  
**Village Name:** `Demo Köyü`  
**Season:** `2026_Spring`

### 10.1 Parseller (8 adet)
```json
[
  { "parcel_id": "p1", "name": "P1" },
  { "parcel_id": "p2", "name": "P2" },
  { "parcel_id": "p3", "name": "P3" },
  { "parcel_id": "p4", "name": "P4" },
  { "parcel_id": "p5", "name": "P5" },
  { "parcel_id": "p6", "name": "P6" },
  { "parcel_id": "p7", "name": "P7" },
  { "parcel_id": "p8", "name": "P8" }
]
```

### 10.2 Komşuluk Listesi (Manual Adjacency v1)
```json
[
  { "parcel_id": "p1", "neighbor_parcel_id": "p2" },
  { "parcel_id": "p1", "neighbor_parcel_id": "p4" },

  { "parcel_id": "p2", "neighbor_parcel_id": "p1" },
  { "parcel_id": "p2", "neighbor_parcel_id": "p3" },
  { "parcel_id": "p2", "neighbor_parcel_id": "p5" },

  { "parcel_id": "p3", "neighbor_parcel_id": "p2" },
  { "parcel_id": "p3", "neighbor_parcel_id": "p6" },

  { "parcel_id": "p4", "neighbor_parcel_id": "p1" },
  { "parcel_id": "p4", "neighbor_parcel_id": "p5" },
  { "parcel_id": "p4", "neighbor_parcel_id": "p7" },

  { "parcel_id": "p5", "neighbor_parcel_id": "p2" },
  { "parcel_id": "p5", "neighbor_parcel_id": "p4" },
  { "parcel_id": "p5", "neighbor_parcel_id": "p6" },
  { "parcel_id": "p5", "neighbor_parcel_id": "p8" },

  { "parcel_id": "p6", "neighbor_parcel_id": "p3" },
  { "parcel_id": "p6", "neighbor_parcel_id": "p5" },

  { "parcel_id": "p7", "neighbor_parcel_id": "p4" },
  { "parcel_id": "p7", "neighbor_parcel_id": "p8" },

  { "parcel_id": "p8", "neighbor_parcel_id": "p5" },
  { "parcel_id": "p8", "neighbor_parcel_id": "p7" }
]
```

### 10.3 Ürün Kataloğu (`crop_catalog`)
```json
[
  { "crop_id": "c_wheat", "crop_name": "Buğday" },
  { "crop_id": "c_barley", "crop_name": "Arpa" },
  { "crop_id": "c_sunflower", "crop_name": "Ayçiçek" },
  { "crop_id": "c_corn", "crop_name": "Mısır" }
]
```

### 10.4 Demo Başlangıç Ürün Dağılımı (Test Senaryosu)
```json
[
  { "parcel_id": "p1", "crop_id": "c_wheat" },
  { "parcel_id": "p2", "crop_id": "c_sunflower" },
  { "parcel_id": "p3", "crop_id": "c_wheat" },
  { "parcel_id": "p4", "crop_id": "c_wheat" },
  { "parcel_id": "p5", "crop_id": "c_sunflower" },
  { "parcel_id": "p6", "crop_id": "c_corn" },
  { "parcel_id": "p7", "crop_id": "c_barley" },
  { "parcel_id": "p8", "crop_id": "c_wheat" }
]
```

## 11. Baseline Risk Mantığı (rules_v1 referansı)
### 11.1 Kurallar (Demo Baseline)
- **Kural-1:** Komşu uyumsuzluk
  - Buğday ↔ Ayçiçek = yüksek risk
  - Mısır ↔ Ayçiçek = orta risk
  - Aynı ürün komşuluğu = düşük risk (tek başına kritik sayılmaz)

### 11.2 Basit Skorlama (örnek)
- Her yüksek uyumsuz komşu = `+20`
- Aynı ürün yoğunluğu `%50` üzeri = `+15`
- Köyde farklı ürün sayısı `> 3` = `+10`
- Gerekirse normalize/clip: `0..100`

### 11.3 P1 için Beklenen Örnek Sonuç
Komşular:
- `P2 -> Ayçiçek` (yüksek risk)
- `P4 -> Buğday` (aynı ürün)

Beklenen örnek response:
```json
{
  "parcel_id": "p1",
  "risk_score": 68,
  "risk_level": "RISKY",
  "reasons": [
    {
      "code": "NEIGHBOR_INCOMPATIBLE",
      "text": "Komşu parselde ayçiçek tespit edildi."
    },
    {
      "code": "SAME_CROP_CLUSTERING",
      "text": "Aynı ürün yoğunluğu yüksek."
    }
  ],
  "recommendations": [
    {
      "type": "CROP_SUGGESTION",
      "text": "Arpa veya mısır önerilir."
    }
  ],
  "model_version": "rules_v1"
}
```

## 12. Frontend İçin Görsel Standartlar (Demo)
### Risk Renkleri
- `OK` -> Yeşil
- `RISKY` -> Sarı
- `CRITICAL` -> Kırmızı
- `UNKNOWN` -> Gri

### UI Davranışları (v1)
- Parsel tıklanınca sağ panel açılır
- Ürün değişikliği sonrası kullanıcıya kaydet durumu gösterilir
- Hesaplama sonrası parsel rengi ve panel bilgisi birlikte güncellenir

## 13. Sprint-0 İş Dağılımı (v1)
### Oğuz (Architect / Integration)
- Bu dokümanı tek sözleşme olarak sabitler
- Demo veri seti ve kabul kriterlerini netleştirir
- UI -> API -> Decision entegrasyon akışını doğrular

### Macide (Backend / Security / DevOps)
- FastAPI skeleton + JWT/RBAC + DB + Docker
- Endpointleri bu sözleşmeye göre çıkarır
- Demo seed (`v1`) verisini DB'ye basar

### Rumeysa (Frontend / UX / Demo Flow)
- Leaflet harita + parsel paneli + öneri paneli (mock -> API)
- `risk_level` renk haritalaması
- Demo akışını tıklanabilir hale getirir

### Memduh (AI / Risk Owner)
- `rules_v1` çıktısını bu contract formatında üretir
- (Opsiyonel) ML çıktısını aynı formata uydurur

## 14. ÖDR Strateji Notu
Öncelik sırası:
1. **Çalışan uçtan uca bilgi sistemi demosu**
2. Açıklanabilir rules tabanlı risk/öneri çıktısı
3. ML iyileştirmesi (varsa)

Amaç: "sadece model" değil, **harita + veri + karar + öneri** akışı çalışan bir karar destek sistemi göstermek.

## 15. Değişiklik Yönetimi (Bu Kontrat Nasıl Güncellenir?)
- Geriye uyumsuz değişikliklerde sürüm artırılır (`v2`)
- Geriye uyumlu ek alanlar (opsiyonel) `v1.x` olarak ilerler
- Mevcut alan adları silinmez / yeniden adlandırılmaz
- Her değişiklik bu dosyada tarih ve not ile işlenir

---

## Revizyon Özeti (Bu sürümde eklenen netleştirmeler)
- Backend katman tasarımı eklendi
- Hata response formatı standardize edildi
- `api/v1` versiyonlama kuralı netleştirildi
- `status` vs `risk_level` ayrımı açıklandı
- Demo için `GET /villages` ve `GET /crops` endpointleri eklendi
- Senkron/asenkron `decision/score` response davranışı netleştirildi
- `decision_run_id` ile batch izleme alanı eklendi


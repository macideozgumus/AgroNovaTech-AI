# Architecture & API Contract v2

## Proje
Bilincli Ciftci Koyu: Koy Bazli Akilli Tarim ve Kolektif Karar Destek Sistemi

## V2 Amaci
V1'deki tek bloklu demo yapiyi, ayni koy icinde birden fazla tarla blogunu (`FieldBlock`) destekleyecek sekilde genisletmek.

## Mimari Degisiklik
- `Village` birden fazla `FieldBlock` icerir
- Her `FieldBlock` birden fazla `Parcel` icerir
- `ParcelAdjacency` artik komsulugun tipini de tasir:
  - `INTRA_BLOCK`
  - `INTER_BLOCK`
- UI yerlesim kurali:
  - `Tarla Blogu A` merkezde sabitlenir
  - `Tarla Blogu B`, kullanici tarafindan `ust`, `sag`, `alt`, `sol` kenarlarindan birine yerlestirilir
  - `INTER_BLOCK` komsuluklari secilen kenara gore degisir

## Veri Modeli Degisiklikleri

### `FieldBlock`
- `id`
- `village_id`
- `name`
- `display_order`
- `geometry_json` (opsiyonel)
- `placement_mode` (opsiyonel)
  - `CENTER_FIXED`
  - `EDGE_SELECTABLE`
- `created_at`

### `Parcel` (v2 ek alan)
- `field_block_id` (zorunlu)

### `ParcelAdjacency` (v2 ek alan)
- `adjacency_type`
  - `INTRA_BLOCK`
  - `INTER_BLOCK`

## API v2 Degisiklikleri

### `GET /api/v2/villages/{villageId}/field-blocks`
Koydeki tarla bloklarini listeler.

Ornek response:
```json
{
  "village_id": "v1",
  "field_blocks": [
    {
      "field_block_id": "fb_a",
      "name": "Tarla Blogu A",
      "display_order": 1,
      "placement_mode": "CENTER_FIXED"
    },
    {
      "field_block_id": "fb_b",
      "name": "Tarla Blogu B",
      "display_order": 2,
      "placement_mode": "EDGE_SELECTABLE"
    }
  ]
}
```

### `PUT /api/v2/villages/{villageId}/field-layout`
Tarla Blogu B'nin Tarla Blogu A'nin hangi kenarina yerlestirilecegini belirler.

Ornek request:
```json
{
  "field_layout_position": "right"
}
```

Ornek response:
```json
{
  "ok": true,
  "village_id": "v1",
  "field_layout_position": "right"
}
```

### `GET /api/v2/villages/{villageId}/parcels?season=2026_Spring`
V1'e ek olarak block bilgisi ve komsuluk ozeti tasir.

Ornek response:
```json
{
  "village_id": "v1",
  "season": "2026_Spring",
  "parcels": [
    {
      "parcel_id": "a_p1",
      "name": "A-P1",
      "field_block": {
        "field_block_id": "fb_a",
        "name": "Tarla Blogu A"
      },
      "status": "RISKY",
      "crop": {
        "crop_id": "c_wheat",
        "crop_name": "Bugday"
      },
      "risk_score": 66,
      "risk_level": "RISKY"
    }
  ]
}
```

### `GET /api/v2/parcels/{parcelId}/neighbors?season=2026_Spring`
Secili parselin blok ici ve bloklar arasi komsularini ayri listeler. `INTER_BLOCK`
komsulari aktif tarla yerlesimine gore hesaplanir.

Ornek response:
```json
{
  "parcel_id": "a_p4",
  "season": "2026_Spring",
  "layout_position": "right",
  "neighbors": {
    "intra_block": [
      { "parcel_id": "a_p1", "adjacency_type": "INTRA_BLOCK" }
    ],
    "inter_block": [
      { "parcel_id": "b_p1", "adjacency_type": "INTER_BLOCK" }
    ]
  }
}
```

### `GET /api/v2/parcels/{parcelId}/decision?season=2026_Spring`
V1'e ek olarak blok bilgisi ve komsu ozetini de donebilir.

## Risk Modeli v2

Toplam risk:
`R = R_intra + R_inter + R_density + R_village`

- `R_intra`: ayni blok icindeki uyumsuz komsular
- `R_inter`: diger bloktan sinir komsulari (`Tarla B` konumuna gore degisir)
- `R_density`: ayni urun yogunlugu
- `R_village`: koy geneli dagilim baskisi

Ornek agirliklar:
- `INTRA_BLOCK` uyumsuz komsu: `+20`
- `INTER_BLOCK` uyumsuz komsu: `+25`
- ayni urun yogunlugu > %50: `+15`
- koyde urun cesidi > 3: `+10`

## V2 Kabul Kriterleri
- UI `Tarla Blogu A`yi merkezde, `Tarla Blogu B`yi 4 kenardan secilebilir sekilde gosterir
- Her parsel `field_block_id` tasir
- `Tarla Blogu B` konum secimi UI'dan yapilabilir
- Konum degisince `INTER_BLOCK` komsuluklari degisir
- Komsuluk tipi API'de gorunur
- Risk nedenleri blok ici ve bloklar arasi etkiyi ayirt eder
- Demo, en az iki komsu tarla blogu ile calisir

## Gun-5 E2E Dogrulama (Stabilizasyon)
Asagidaki zincir tek calistirmada gecmelidir:
1. `PUT /api/v2/villages/{villageId}/field-layout`
2. `GET /api/v2/villages/{villageId}/field-layout`
3. `GET /api/v2/parcels/{parcelId}/neighbors?season=2026_Spring`
4. `POST /api/v1/decision/score`
5. `GET /api/v1/parcels/{parcelId}/decision?season=2026_Spring`

Gecis kurali:
- `field_layout_position` degisikligi API'de gorulmeli
- `neighbors.inter_block` listesi aktif yone gore degismeli
- risk sonucu (`risk_score` ve/veya `reasons`) guncellenmeli

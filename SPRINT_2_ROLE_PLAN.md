# Sprint-2 Rol Plani

## Tema
Tek bloklu demo yapisindan cikarak ayni koy icinde iki komsu tarla blogu (`FieldBlock`) uzerinde komsu tarla etkisini gosteren mimariye gecis.

## Hedef Cikti
- `Tarla Blogu A` merkezde sabit gorunur
- `Tarla Blogu B`, `Tarla Blogu A`nin ust / sag / alt / sol kenarlarindan birine yerlestirilebilir
- Iki komsu tarla blogu UI'da ayri gorunur
- Parseller hem blok ici hem bloklar arasi komsulukla degerlendirilir
- Risk modeli `INTRA_BLOCK` ve `INTER_BLOCK` etkilerini ayirir
- API v2 bu veri modelini tasir

## Oguz (Kaptan / Architect / Integration)
- `FieldBlock` kavramini mimariye sabitler
- API Contract v2'yi kilitler
- `Tarla A merkez / Tarla B 4 kenar secimi` kuralini resmi akisa yazar
- `INTRA_BLOCK` ve `INTER_BLOCK` komsuluk kurallarini netlestirir
- Demo akisini iki bloga gore gunceller
- Entegrasyon kabul kriterlerini ve test senaryolarini yazar

Teslim:
- `Architecture_API_Contract_v2.md`
- Sprint-2 kabul kriterleri
- V2 demo veri akisi

## Macide (Backend / DB / Security)
- `field_block` modelini ve migration'i ekler
- `parcel` tablosunu `field_block_id` ile genisletir
- `parcel_adjacency` tablosuna `adjacency_type` ekler
- `seed_demo_v2.py` ile iki blogu ve bloklar arasi komsulugu yukler
- `Tarla Blogu B` konumuna gore `INTER_BLOCK` komsulugunu degistirecek backend layout state'ini ekler
- V2 endpointlerini block bilgisi tasiyacak sekilde genisletir

Teslim:
- SQLAlchemy model genisletmeleri
- Alembic migration
- Demo seed v2
- V2 endpoint response alanlari
- Tarla yerlesim (layout) backend akisi

## Rumeysa (Frontend / UX)
- Mevcut tek grid yapisini iki bloklu gorunume tasir
- Parselleri `field_block_id` bazli gruplar
- `Tarla Blogu A`yi merkezde sabitler
- `Tarla Blogu B` icin `ust / sag / alt / sol` secim kontrolu ekler
- Secilen parsel icin:
  - blok bilgisi
  - blok ici komsular
  - sinir komsulari
  - risk nedenleri
  gosterir
- Uydu goruntu / harita ustu overlay taslagini hazirlar

Teslim:
- Iki bloklu harita/grid UI
- 4 yonlu Tarla B yerlesim secimi
- Komsuluk bilgisi paneli
- Block bazli secim ve gorsel ayrim

## Memduh (AI / Risk / Optimizasyon)
- Risk modelini blok ici / bloklar arasi olacak sekilde ayirir
- `R_intra`, `R_inter`, `R_density`, `R_village` bilesenlerini netlestirir
- `R_inter` etkisini `Tarla Blogu B` konumuna bagli olarak ele alir
- `rules_v2` taslagini yazar
- 3 yeni test senaryosu uretir:
  - blok ici dusuk risk
  - ayni veri ile `Tarla B` konumu degistiginde sinir komsulugundan artan risk
  - koy geneli dagilim baskisi

Teslim:
- `rules_v2` puanlama tablosu
- yeni test senaryolari
- aciklanabilir reason code genisletmesi

## Sprint-2 Kapanis Kriteri
- UI `Tarla Blogu A` merkezde, `Tarla Blogu B` 4 kenar secimli olacak sekilde gosterir
- Backend block + adjacency type verisini tasir
- `Tarla Blogu B` konumu degistiginde `INTER_BLOCK` komsuluklari degisir
- Risk modeli komsu tarla etkisini ayri agirlikla hesaba katar
- Demo, proje hedefindeki "komsu tarla analizi" iddiasini dogrudan gosterir

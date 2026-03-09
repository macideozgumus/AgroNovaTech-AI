# MOBILE SPRINT PLAN (mobile-demo-check)

## 1) Amaç
Bu sprintin hedefi, mobil uygulamayi `mobile-demo-check` branch'i uzerinde conflict olusturmadan uctan uca calisir hale getirmektir.

Kapsam:
- Login -> Koy/Parsel listeleme -> Karar hesaplama -> Karar gosterimi
- Hybrid risk motoru (`rules + ml`) mobil akisa entegre
- Gercek cihazda (Expo Go) dogrulanmis akış

---

## 2) Zorunlu Branch Kurallari
- Herkes sadece kendi gununde kod yazar.
- Kod yazmaya baslamadan once:
  - `git checkout mobile-demo-check`
  - `git pull origin mobile-demo-check`
- Gun sonu zorunlu:
  - `git add <kendi dosyalari>`
  - `git commit -m "<rol>-<gun>-<is>"`
  - `git push origin mobile-demo-check`
- `git add .` yasak.
- Ayni dosyaya plansiz paralel giris yasak.
- Her rol sprint boyunca en az 1 ozgun requirement eklemek zorunda.

---

## 3) Sali -> Pazar Sirali Gorev Akisi

## Sali - Oğuz (Mimari ve Kilitler)
Dosyalar:
- `Architecture_API_Contract_v2.md`
- `MOBILE_SPRINT_PLAN.md`
- `RUNBOOK.md`

Teslimler:
- Contract alanlari kilitlenecek: `risk_score`, `risk_level`, `reason_codes`, `confidence`, `model_version`, `decision_source`
- Tunnel/LAN calistirma runbook'u netlestirilecek
- Dosya kilidi ve push sirasi finalize edilecek

Ozgün requirement (zorunlu):
- `Offline son karar cache` zorunlulugu (parcel+season bazli)

Gun sonu push sahibi:
- Oğuz

## Carsamba - Rumeysa (Mobil UI/UX ve Tasarim)
Dosyalar:
- `mobile-app/src/navigation/AppNavigator.tsx`
- `mobile-app/src/screens/LoginScreen.tsx`
- `mobile-app/src/screens/VillageParcelsScreen.tsx`
- `mobile-app/src/screens/DecisionScreen.tsx`
- `mobile-app/src/components/*` (varsa)

Teslimler:
- Login ekrani, Koy/Parsel liste ekrani, Karar ekrani tasarimi tamam
- Ekranlar arasi akış ve temel hata durumlari gorsel olarak net
- Frontend tasarimlari mobilde okunakli ve sade

Ozgün requirement (zorunlu):
- `Risk nedenleri oncelik sirasi` (en kritik neden en ustte)

Gun sonu push sahibi:
- Rumeysa

## Persembe - Macide (Backend Stabilizasyon)
Dosyalar:
- `backend/app/main.py`
- `backend/app/decision_engine/*`
- `backend/app/db/*`
- `backend/app/repositories/*`

Teslimler:
- `POST /api/v1/auth/login`
- `GET /api/v1/villages/{id}/parcels`
- `PUT/GET field-layout`, `GET neighbors`, `POST decision/score`, `GET decision`
- Decision sonucunun DB persist edilmesi

Ozgün requirement (zorunlu):
- `API latency target < 800ms` olcumlenebilir metrik

Gun sonu push sahibi:
- Macide

## Cuma - Memduh (AI/ML ve Test)
Dosyalar:
- `backend/app/decision_engine/rules_v2.py`
- `backend/app/decision_engine/hybrid.py`
- `backend/app/decision_engine/model_loader.py` (yeni)
- `backend/app/decision_engine/model_artifacts/*` (yeni, model dosyasi)
- `backend/app/decision_engine/reason_map.py` (yeni)
- `tests/test_decision_engine.py`
- `tests/test_api_endpoints.py`
- `tests/test_ml_inference.py` (yeni)

Teslimler:
- Gercek ML inference backend'e baglanacak (placeholder degil):
  - model artifact yukleme
  - `R_ml` uretilmesi
  - model yoksa otomatik `rules_only` fallback
- Hybrid skor formulunun production akista calismasi:
  - `R_final = (1-lambda)*R_rules + lambda*R_ml`
  - `lambda = clamp(0.2 + 0.6*confidence_ml, 0.2, 0.8)`
- Reason code aciklamalari merkezi map ile zorunlu:
  - her code icin `text + severity + source(intra/inter/ml)`
- Otomatik testler:
  - rules_only akisi
  - ml_inference akisi
  - hybrid akisi
  - model yokken fallback akisi

Ozgün requirement (zorunlu):
- `ML güven skoru zorunlulugu`: `confidence` alani null olamaz (hybrid modda)

Gun sonu push sahibi:
- Memduh

## Cumartesi - Entegrasyon Gunu (Tek Kod Sahibi: Oğuz)
Dosyalar:
- `mobile-app/src/api/client.ts`
- `mobile-app/src/api/cache.ts`
- `mobile-app/src/types/api.ts`
- `RUNBOOK.md`

Teslimler:
- Mobil API client timeout/retry/cache son kontroller
- LAN + Tunnel akislari dogrulama
- ngrok/HTTPS ve CORS kontrolleri

Not:
- Diger roller bug bildirebilir ama kod push yetkisi sadece Oğuz'da.

Gun sonu push sahibi:
- Oğuz

## Pazar - Kapanis ve Kanit
Dosyalar:
- `RUNBOOK.md`
- `artifacts/mobile_e2e/*` (olusturulacak)

Teslimler:
- Gercek cihaz E2E kayitlari
- Endpoint zinciri kaniti:
  - login -> parcels -> layout/neighbors -> score -> decision
- Sprint kapanis notu

Gun sonu push sahibi:
- Oğuz

---

## 4) Dosya Kilidi
- Oğuz: dokumanlar + runbook + final entegrasyon dosyalari
- Rumeysa: `mobile-app/src/screens/*`, `mobile-app/src/navigation/*`, `mobile-app/src/components/*`
- Macide: `backend/app/main.py`, `backend/app/db/*`, `backend/app/repositories/*`
- Memduh: `backend/app/decision_engine/*`, `tests/*`

---

## 5) Sprint Sonu Kabul Kriterleri
- Mobilde gercek cihazda login akisi calisiyor
- Koy/Parsel listesi backend'den geliyor
- Karar hesaplama ve karar cekme endpointleri calisiyor
- Hybrid model alanlari mobilde gorunuyor (`confidence`, `model_version`, `decision_source`)
- Gercek ML inference calisiyor (artifact yuklu), model kapaliysa rules fallback otomatik calisiyor
- En az 1 ozgun requirement her rol tarafindan eklenmis ve uygulanmis
- `mobile-demo-check` branch'inde sirali, conflict'siz commit gecmisi var

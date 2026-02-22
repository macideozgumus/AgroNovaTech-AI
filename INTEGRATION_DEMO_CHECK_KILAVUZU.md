# INTEGRATION_DEMO_CHECK_KILAVUZU

Bu doküman, `integration-demo-check` branch'inin nasıl kullanılacağını tanımlar.

## Amaç
- Ekip branch'lerinden gelen kodları `main`e almadan önce tek yerde birleştirip test etmek
- Entegrasyon hatalarını erken yakalamak (UI + API + Decision akışı)
- `main` branch'ini temiz ve stabil tutmak

## Branch Rolü
- `integration-demo-check` bir **toplama/test branch'i**dir
- Kalıcı geliştirme branch'i değildir
- Sprint sonunda PR ile `main`e alınır (uygunsa)

## Oluşturma Kuralı
`integration-demo-check` branch'i her zaman `main` üzerinden açılır.

GitHub arayüzünde:
- `New branch name`: `integration-demo-check`
- `Source`: `main`

Komut satırı ile:
```bash
git checkout main
git pull origin main
git checkout -b integration-demo-check
git push -u origin integration-demo-check
```

## Hangi Branch'ler Bu Branch'e Alınır?
Sprint durumuna göre örnek:
- `backend`
- `frontend`
- `system-api-contract-v1`
- (varsa) `rules-v1` / `ai-risk`

## Branch'leri Entegre Etme (Önerilen Sıra)
1. `system-api-contract-v1` (contract/schemas)
2. `backend`
3. `frontend`
4. `ai-risk` / `rules-v1` (varsa)

Not: Gerçek sıra takımın hazır olma durumuna göre değişebilir; amaç conflict ve kırılmayı hızlı görmek.

## Entegrasyon Alma Yöntemi
## Yöntem A (Önerilen): PR ile `integration-demo-check`e merge
- Ekip üyesi kendi branch'inden PR açar
- `base` olarak `integration-demo-check` seçilir (geçici test için)
- Kontrol edilir, merge edilir

## Yöntem B: Local merge (kaptan toplar)
```bash
git checkout integration-demo-check
git pull origin integration-demo-check

git fetch origin
git merge origin/system-api-contract-v1
git merge origin/backend
git merge origin/frontend
```

Conflict varsa bu branch'te çözülür.

## Entegrasyon Kontrol Checklist (Kaptan)
- Endpoint path'ler contract ile aynı mı?
- JSON alan adları birebir aynı mı?
- `risk_level` sadece `OK | RISKY | CRITICAL | UNKNOWN` mu?
- `reasons[]` formatı bozulmamış mı? (`code`, `text`)
- `recommendations[]` formatı bozulmamış mı? (`type`, `text`)
- Frontend `season` parametresini doğru gönderiyor mu?
- `POST /decision/score` sonrası `GET /parcels/{id}/decision` çalışıyor mu?
- Harita rengi `risk_level` ile güncelleniyor mu?
- Demo senaryosunda `P1` beklenen şekilde `RISKY` görünüyor mu?

## Önerilen Günlük Akış (Kaptan)
1. `main` güncellenir
2. `integration-demo-check` güncellenir
3. Hazır branch'ler sırayla alınır
4. Demo akışı test edilir
5. Sorunlar ekip üyelerine branch bazlı geri bildirilir
6. Stabil hale gelince PR (`integration-demo-check -> main`) açılır

## Kurallar
- `main`e doğrudan push yapılmaz
- Entegrasyon branch'i test amaçlıdır; feature geliştirme burada yapılmaz
- Büyük conflict çözümü sonrası tekrar demo akışı baştan test edilir


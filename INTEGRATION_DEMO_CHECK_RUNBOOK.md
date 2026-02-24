# INTEGRATION_DEMO_CHECK_RUNBOOK

## 1. Amaç
`integration-demo-check` branch'i:
- Ekip branch'lerinden gelen kodlari `main`e almadan once birlestirip test etmek icin kullanilir
- UI + API + Decision akislarini dogrulamak icin kullanilir
- `main` branch'ini temiz ve stabil tutar

Bu branch bir **toplama/test branch'i**dir; kalici feature branch degildir.

## 2. Gerekli Programlar (Calisma Ortami)
### Zorunlu
- `Git`
- `Python 3.9+`
- `Node.js + npm`
- `Docker Desktop` (PostgreSQL icin onerilen)

### Backend Python paketleri (`backend/requirements.txt`)
- `fastapi`
- `uvicorn`
- `sqlalchemy`
- `alembic`
- `psycopg2-binary`

### Frontend npm paketleri (`package.json`)
- `react`
- `react-dom`
- `vite`
- `typescript`
- `leaflet`

## 3. Branch Birleştirme Kurallari
### `integration-demo-check` olusturma (main uzerinden)
```bash
git checkout main
git pull origin main
git checkout -b integration-demo-check
git push -u origin integration-demo-check
```

### Guncelleme ve fetch
```bash
git checkout integration-demo-check
git pull origin integration-demo-check
git fetch origin
```

### Onerilen merge sirasi
1. `system-api-contract-v1`
2. `backend`
3. `frontend`
4. `ai/rules-engine-v1` (varsa)

### Local merge komutlari
```bash
git merge origin/system-api-contract-v1
git merge origin/backend
git merge origin/frontend
git merge origin/ai/rules-engine-v1
```

### `unrelated histories` hatasi olursa
```bash
git merge origin/frontend --allow-unrelated-histories
```

### Vim merge ekranindan cikis (merge mesajini kaydet)
- `Esc`
- `:wq`
- `Enter`

### Conflict cozumunden sonra
```bash
git status
git add .
git commit -m "integration-demo-check - resolve merge conflicts"
```

## 4. Repo Temizligi (Commit Etme / Etme)
### Commit ETME
- `node_modules/`
- `backend/.venv/`
- `__pycache__/`

### Commit ET
- `src/**`
- `backend/app/**`
- `backend/alembic/**`
- `backend/scripts/**`
- `docs/**`
- `*.md`

Kontrol:
```bash
git status
```

## 5. Frontend Calistirma (Vite + React)
Repo kokunde:
```bash
npm install
npm run dev
```

Genelde acilan adres:
- `http://localhost:5173`

Not:
- UI backend'i `http://127.0.0.1:8000/api/v1` adresinden cagirir
- Backend kapaliysa UI'da `Failed to fetch` gorulur

## 6. Backend Calistirma (FastAPI)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health kontrol:
```bash
curl http://127.0.0.1:8000/api/v1/health
```

Beklenen:
```json
{"status":"ok","service":"backend","version":"v1"}
```

## 7. PostgreSQL Kurulumu
### Secenek A (Onerilen): Docker ile PostgreSQL
Once Docker Desktop acik olmali.

Kontrol:
```bash
docker ps
```

Container baslat:
```bash
docker run --name agronova-postgres ^
  -e POSTGRES_USER=postgres ^
  -e POSTGRES_PASSWORD=postgres ^
  -e POSTGRES_DB=agronovatech_ai ^
  -p 5432:5432 ^
  -d postgres:16
```

### Secenek B: Native PostgreSQL (Windows)
- `services.msc` icinde `postgresql-x64-xx` servisini `Start`
- `pgAdmin` veya `psql` ile `agronovatech_ai` veritabanini olustur

## 8. Alembic Migration ve Demo Seed
Varsayilan DB baglantisi:
- `postgresql+psycopg2://postgres:postgres@localhost:5432/agronovatech_ai`

Sifre farkliysa (`PowerShell`):
```powershell
$env:DATABASE_URL="postgresql+psycopg2://postgres:SIFREN@127.0.0.1:5432/agronovatech_ai"
```

Migration:
```bash
cd backend
.venv\Scripts\activate
alembic upgrade head
```

Seed:
```bash
python scripts/seed_demo_v1.py
```

Beklenen:
- `Demo seed v1 basildi: village=v1, parcels=8`

## 9. Entegrasyon Testi (UI + API + Decision)
### Onerilen terminal duzeni
- Terminal 1: Backend (`uvicorn`)
- Terminal 2: Frontend (`npm run dev`)
- Terminal 3: DB / migration / seed

### API smoke test komutlari
```bash
curl http://127.0.0.1:8000/api/v1/health
curl http://127.0.0.1:8000/api/v1/crops
curl http://127.0.0.1:8000/api/v1/villages
curl "http://127.0.0.1:8000/api/v1/villages/v1/parcels?season=2026_Spring"
```

Koy bazli karar hesaplat:
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/decision/score" ^
  -H "Content-Type: application/json" ^
  -d "{\"village_id\":\"v1\",\"season\":\"2026_Spring\"}"
```

Tek parsel karar:
```bash
curl "http://127.0.0.1:8000/api/v1/parcels/p1/decision?season=2026_Spring"
```

Tum parseller (PowerShell):
```powershell
1..8 | ForEach-Object { curl "http://127.0.0.1:8000/api/v1/parcels/p$_/decision?season=2026_Spring" }
```

## 10. UI Checklist (Kaptan Kontrolu)
- Harita/parsel ekrani geliyor mu?
- Parsel paneli aciliyor mu?
- Urun secimi calisiyor mu?
- `Urun Planini Kaydet + Hesapla` calisiyor mu?
- `Yeniden Hesapla` hata vermiyor mu?
- Backend logunda endpoint cagrilari gorunuyor mu?
- `risk_level` UI rengini degistiriyor mu?
- `P1` baslangicta `RISKY` gorunuyor mu?
- Diger parsellerde karar/oneriler geliyor mu?
- `reasons[]` formati dogru mu (`code`, `text`)?
- `recommendations[]` formati dogru mu (`type`, `text`)?

## 11. Sik Hatalar ve Cozumler
### UI'da `Failed to fetch`
Sebep:
- Backend calismiyor
- Yanlis port
- Backend crash oldu

Cozum:
```bash
curl http://127.0.0.1:8000/api/v1/health
```
Calismiyorsa backend'i yeniden baslat:
```bash
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### `git checkout frontend` branch yok
```bash
git fetch origin
git switch -c frontend --track origin/frontend
```

### `fatal: refusing to merge unrelated histories`
```bash
git merge origin/frontend --allow-unrelated-histories
```

### `alembic/seed` sirasinda PostgreSQL baglanti hatasi
Sebep:
- PostgreSQL calismiyor

Cozum:
- Docker Desktop'i ac
- PostgreSQL container baslat
- `alembic upgrade head` ve `seed` komutlarini tekrar calistir

## 12. Mevcut Durum (Ozet)
- Frontend ↔ Backend entegrasyonu calisabilir durumda
- Backend'de `/api/v1` demo endpointleri var
- Rules tabanli demo risk hesaplama var
- Gercek AI/ML henuz yok (roadmap)
- PostgreSQL + SQLAlchemy + Alembic + seed altyapisi eklendi
- Endpointlerin DB'ye tam refactor edilmesi sonraki adim

## 13. PR Akisi (`integration-demo-check -> main`)
```bash
git add .
git commit -m "integration-demo-check - merge branches and validate end-to-end demo flow"
git push origin integration-demo-check
```

GitHub PR:
- `base`: `main`
- `compare`: `integration-demo-check`

## 14. Kaptan Için Gun Sonu Rutin
1. `main` guncel mi?
2. `integration-demo-check` guncel mi?
3. Hangi branch'ler merge edildi?
4. Backend calisiyor mu?
5. Frontend calisiyor mu?
6. Health + parcels + decision endpointleri calisiyor mu?
7. UI checklist gecti mi?
8. Sorunlar branch bazli notlandi mi?
9. PR acmaya hazir mi?


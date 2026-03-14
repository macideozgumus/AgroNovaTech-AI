# MOBILE_TUNNEL_RUNBOOK.md

## 1. Amac
Bu runbook, mobil uygulamayi Expo Tunnel + ngrok backend tüneli ile calistirmak icin net ve tekrar edilebilir adimlari verir.

Bu akista:
- Frontend (Expo) `https://...exp.direct`
- Backend (FastAPI) `https://...ngrok-free.dev`
uzerinden konusur.

---

## 2. On Kosullar

### Gerekli araclar
- Python 3.9+
- Node.js 18+
- npm
- Expo Go (telefonda)
- ngrok (kurulu ve auth token tanimli)

### Repo
Komutlar repo kokunde calisacak:
`C:\Users\oğuz\AgroNovaTech-AI`

---

## 3. Ilk Kurulum (Bir kere)

### 3.1 Backend bagimliliklari
```bash
python -m pip install -r backend/requirements.txt
```

### 3.2 Mobile bagimliliklari
```bash
cd mobile-app
npm install
npx expo install @react-native-async-storage/async-storage react-native-gesture-handler react-native-screens react-native-safe-area-context expo-constants
cd ..
```

### 3.3 ngrok auth (bir kere)
```bash
ngrok config add-authtoken <NGROK_TOKEN>
```

---

## 4. Her Calistirmada Izlenecek Sira

## Adim 1: Backend'i baslat
```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
Beklenen log:
- `Uvicorn running on http://0.0.0.0:8000`

## Adim 2: Lokal health kontrol
Yeni terminal ac:
```bash
curl http://127.0.0.1:8000/health
```
Beklenen:
```json
{"status":"ok"}
```

## Adim 3: ngrok ile backend'i HTTPS yayina al
Yeni terminalde:
```bash
ngrok http 8000
```
Beklenen forwarding satiri:
`https://<random>.ngrok-free.dev -> http://localhost:8000`

Kontrol:
- Tarayicida su iki adresi kontrol et:
  - `https://<random>.ngrok-free.dev/health`
  - `https://<random>.ngrok-free.dev/docs`
- Beklenen:
  - `/health` => `{"status":"ok"}`
  - `/docs` => FastAPI Swagger arayuzu acilir

Not:
- `https://<random>.ngrok-free.dev/` kok path'inde `{"detail":"Not Found"}` gormen normaldir.
- Cunku backend'de `/` route tanimli degildir.

## Adim 4: Expo'yu tunnel ile baslat
Yeni terminalde:
```bash
cd mobile-app
set EXPO_PUBLIC_API_BASE_URL=https://<random>.ngrok-free.dev
npx expo start -c --tunnel
```

Not:
- Her yeni ngrok URL'inde bu env degerini guncellemen gerekir.

## Adim 5: QR okut ve login test
- Telefondan Expo Go ile QR okut.
- Login:
  - `demo / demo123`
  - veya `oguz / 123456`

---

## 5. Web Test (Opsiyonel)
Expo web acikken login sonrasi API cagrilari JSON donmeli.

Eger su hata gorulurse:
- `Unexpected token '<', "<!DOCTYPE"...`
sebep: JSON yerine HTML donuyor.

Cozum:
- ngrok URL dogru mu kontrol et.
- `mobile-app/src/api/client.ts` icinde `ngrok-skip-browser-warning` header'i oldugunu dogrula.
- Expo'yu cache temiz baslat: `npx expo start -c --tunnel`

---

## 6. Sik Hata ve Cozumleri

### Hata A: `Network request failed`
Kontrol listesi:
1. Backend calisiyor mu?
2. ngrok forwarding `localhost:8000` mu? (80 degil)
3. `EXPO_PUBLIC_API_BASE_URL` ngrok https URL mi?
4. `https://<ngrok>/health` aciliyor mu?

### Hata B: `CORS policy / No Access-Control-Allow-Origin`
- Backend'de CORS middleware acik olmali (`backend/app/main.py`).
- Expo tunnel origin'leri (`*.exp.direct`) izinli olmali.

### Hata C: `Mixed Content` (HTTPS sayfa HTTP API cagiriyor)
- Tunnel modda API URL kesinlikle `https://...ngrok...` olmali.
- `http://192.168.x.x:8000` tunnel modda kullanilmaz.

### Hata D: `502 Bad Gateway` ngrok'da
- ngrok yanlis porta baglidir.
- Dogru komut: `ngrok http 8000`

### Hata E: `0.0.0.0:8000` tarayicida acilmiyor
- `0.0.0.0` browser adresi degil, bind adresidir.
- PC icin: `http://127.0.0.1:8000/health`

### Hata F: `GET /api/v1/parcels/{id}/decision` 404
- Her zaman bug degildir.
- Bu endpoint, ilgili `parcel_id + season` icin karar daha once persist edilmediyse `404` doner.
- Beklenen dogru akis:
  1. `GET decision` => 404
  2. `POST /api/v1/decision/score` => 200
  3. `GET decision` => 200
- Hata sayilmasi icin:
  - `POST /decision/score` sonrasinda
  - ayni `parcel + season` icin
  - `GET decision` hala surekli `404` donmeli

---

## 7. Gun Sonu Kapanis Kontrolu
Asagidaki 5 madde true ise akış saglikli:
1. `curl http://127.0.0.1:8000/health` => ok
2. `https://<ngrok>/health` => ok
3. Expo logunda `[AgroNova][API] Base URL: https://<ngrok>`
4. Mobil login basarili
5. Login sonrasi parcel/decision ekranlari veri cekiyor

Ek entegrasyon kontrolu:
6. `https://<ngrok>/docs` aciliyor
7. `GET decision` 404 gelirse sonraki `POST score` sonrasi veri olusuyor

---

## 8. Hizli Tekrar (Kisa)
```bash
# Terminal 1
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2
ngrok http 8000

# Terminal 3
cd mobile-app
set EXPO_PUBLIC_API_BASE_URL=https://<ngrok-url>
npx expo start -c --tunnel
```

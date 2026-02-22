# API cURL Examples (v1)

Base URL (local):

```bash
http://localhost:8000/api/v1
```

## 1. Login

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@x.com",
    "password": "*****"
  }'
```

## 2. List Villages

```bash
curl "http://localhost:8000/api/v1/villages"
```

## 3. List Parcels in Village (Season)

```bash
curl "http://localhost:8000/api/v1/villages/v1/parcels?season=2026_Spring"
```

## 4. List Crops

```bash
curl "http://localhost:8000/api/v1/crops"
```

## 5. Update Parcel Crop Plan

```bash
curl -X PUT "http://localhost:8000/api/v1/parcels/p1/crop-plan" \
  -H "Content-Type: application/json" \
  -d '{
    "season": "2026_Spring",
    "crop_id": "c_wheat",
    "sowing_date": "2026-03-10"
  }'
```

## 6. Trigger Village Decision Score

```bash
curl -X POST "http://localhost:8000/api/v1/decision/score" \
  -H "Content-Type: application/json" \
  -d '{
    "village_id": "v1",
    "season": "2026_Spring"
  }'
```

## 7. Get Parcel Decision Result

```bash
curl "http://localhost:8000/api/v1/parcels/p1/decision?season=2026_Spring"
```

## 8. Get Village Decision Summary (Optional)

```bash
curl "http://localhost:8000/api/v1/villages/v1/decision-summary?season=2026_Spring"
```


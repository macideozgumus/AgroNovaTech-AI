# Architecture API Contract v2

## Scope
This contract locks Day-1 mobile requirements and AI/ML response fields.

## Required AI/ML Decision Fields
Every decision response must include:
- `risk_score` (0-100)
- `risk_level` (`OK` | `RISKY` | `CRITICAL`)
- `reason_codes` (array of string)
- `confidence` (nullable float 0-1)
- `model_version` (string)
- `decision_source` (`rules_only` | `hybrid`)

## Endpoint Contract (Mobile)

### POST `/api/v1/decision/score`
Request:
```json
{
  "village_id": "v1",
  "season": "2026_Spring",
  "parcel_id": "a_p1",
  "ml_score": 62.5,
  "ml_confidence": 0.7
}
```

Response:
```json
{
  "parcel_id": "a_p1",
  "season": "2026_Spring",
  "risk_score": 64,
  "risk_level": "RISKY",
  "reason_codes": ["INTRA_BLOCK_CONFLICT"],
  "confidence": 0.7,
  "model_version": "hybrid_v1",
  "decision_source": "hybrid"
}
```

### GET `/api/v1/parcels/{parcel_id}/decision?season=...`
Response shape is identical to POST response.

## Mobile Requirement (Locked)
- Offline last-result cache is mandatory:
  - Keep latest decision per `parcel_id + season` in local device storage.
  - Show cached decision while network call is pending.

## Day-2 Performance Requirement
- API target response time: < 800 ms for mobile flows.
- Server returns X-Response-Time-Ms and X-Latency-Target-Ms headers for observability.

## Day-2 Mobile API Additions
- POST /api/v1/auth/login for mobile login flow.
- GET /api/v1/villages/{id}/parcels for village parcel listing.
- Decisions persist in SQLite (ackend/app/agronova.db) and are read by GET /api/v1/parcels/{id}/decision.

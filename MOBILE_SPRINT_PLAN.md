# MOBILE SPRINT PLAN

## Day 1 - Architecture Lock + Mobile Skeleton

### Oğuz (Docs)
Files:
- `Architecture_API_Contract_v2.md`
- `MOBILE_SPRINT_PLAN.md`

Tasks:
- Lock mobile API requirements.
- Lock AI/ML decision fields: `risk_score`, `risk_level`, `reason_codes`, `confidence`, `model_version`, `decision_source`.
- Add requirement: offline last-result cache.

### Macide (Backend)
File:
- `backend/app/main.py`

Tasks:
- Guarantee contract fields are always returned from decision endpoints.

### Rumeysa (Mobile UI Skeleton)
Files:
- `mobile-app/src/navigation/AppNavigator.tsx`
- `mobile-app/src/screens/LoginScreen.tsx`
- `mobile-app/src/screens/VillageParcelsScreen.tsx`
- `mobile-app/src/screens/DecisionScreen.tsx`

Tasks:
- Create skeleton screens: Login, Village/Parcel list, Decision detail.

### Memduh (AI/ML)
File:
- `app/services/decision_engine.py`

Tasks:
- Add hybrid model skeleton (`rules + optional ml`).
- Use weighted lambda logic to combine rule score and ml score.

## Mandatory Rules
- Everyone works only in their slot.
- Start each slot:
  - `git checkout mobile-demo-check`
  - `git pull origin mobile-demo-check`
- End each slot:
  - `git add <owned files only>`
  - `git commit -m "<role>-<day>-<work>"`
  - `git push origin mobile-demo-check`
- `git add .` is forbidden.
- Every member must propose at least one new requirement during sprint.

## Day 2 - Backend + API Client
- Macide: ackend/app/main.py, ackend/app/decision_engine/*`r
  - Stabilized endpoints: field-layout, neighbors, decision/score, decision.
  - Requirement added: API response target < 800ms (X-Response-Time-Ms + /api/v1/metrics/latency).
- Rumeysa: mobile-app/src/api/*, mobile-app/src/types/*`r
  - Typed API client + timeout + retry mechanism implemented.
  - Requirement added: mobile retry mechanism (2 retries with backoff).
- Memduh: 	ests/test_decision_engine.py`r
  - Rules/hybrid calculation tests added.


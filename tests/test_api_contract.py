import sys
from pathlib import Path
import unittest

BACKEND_PATH = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

import app.main as backend_main  # noqa: E402


class TestApiContract(unittest.TestCase):
    def test_login_contract(self) -> None:
        payload = backend_main.login(
            {"email": "user@example.com", "password": "secret"},
        )

        self.assertIn("ok", payload)
        self.assertIn("access_token", payload)
        self.assertIn("token_type", payload)
        self.assertIn("role", payload)
        self.assertEqual(payload["role"], "FARMER")

    def test_parcels_contract(self) -> None:
        payload = backend_main.village_parcels("v1", "2026_Spring")

        self.assertIn("village_id", payload)
        self.assertIn("season", payload)
        self.assertIn("parcels", payload)
        self.assertIsInstance(payload["parcels"], list)
        self.assertGreater(len(payload["parcels"]), 0)

        first = payload["parcels"][0]
        for field in ("parcel_id", "name", "status", "crop", "risk_score", "risk_level", "field_block"):
            self.assertIn(field, first)

    def test_parcel_decision_contract(self) -> None:
        backend_main.score(
            {"village_id": "v1", "season": "2026_Spring"},
        )

        payload = backend_main.parcel_decision("a_p1", "2026_Spring")

        for field in (
            "parcel_id",
            "season",
            "risk_score",
            "risk_level",
            "reasons",
            "recommendations",
            "model_version",
        ):
            self.assertIn(field, payload)

        self.assertIsInstance(payload["reasons"], list)
        self.assertIsInstance(payload["recommendations"], list)

        if payload["reasons"]:
            self.assertIn("code", payload["reasons"][0])
            self.assertIn("text", payload["reasons"][0])

        if payload["recommendations"]:
            self.assertIn("type", payload["recommendations"][0])
            self.assertIn("text", payload["recommendations"][0])


if __name__ == "__main__":
    unittest.main()

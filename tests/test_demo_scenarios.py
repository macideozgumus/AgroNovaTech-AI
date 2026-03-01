import sys
from copy import deepcopy
from pathlib import Path
import unittest


BACKEND_PATH = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

import app.main as backend_main  # noqa: E402


class TestDemoScenarios(unittest.TestCase):
    def setUp(self) -> None:
        self.original_crop_plan = deepcopy(backend_main.STATE["crop_plan"])
        self.original_decisions = deepcopy(backend_main.STATE["decisions"])

    def tearDown(self) -> None:
        backend_main.STATE["crop_plan"] = self.original_crop_plan
        backend_main.STATE["decisions"] = self.original_decisions

    def test_default_demo_p1_is_risky(self) -> None:
        backend_main.STATE["crop_plan"] = {
            "a_p1": "c_wheat",
            "a_p2": "c_sunflower",
            "a_p3": "c_wheat",
            "a_p4": "c_wheat",
            "a_p5": "c_wheat",
            "a_p6": "c_sunflower",
            "a_p7": "c_corn",
            "a_p8": "c_barley",
            "b_p1": "c_wheat",
            "b_p2": "c_barley",
            "b_p3": "c_wheat",
            "b_p4": "c_corn",
            "b_p5": "c_wheat",
            "b_p6": "c_sunflower",
            "b_p7": "c_wheat",
            "b_p8": "c_wheat",
        }

        decisions = backend_main.compute_all_decisions()
        p1 = decisions["a_p1"]

        self.assertEqual(p1["risk_score"], 68)
        self.assertEqual(p1["risk_level"], "RISKY")
        self.assertTrue(any(item["code"] == "NEIGHBOR_INCOMPATIBLE" for item in p1["reasons"]))

    def test_adjusted_demo_p5_is_ok(self) -> None:
        backend_main.STATE["crop_plan"] = {
            "a_p1": "c_wheat",
            "a_p2": "c_wheat",
            "a_p3": "c_sunflower",
            "a_p4": "c_wheat",
            "a_p5": "c_barley",
            "a_p6": "c_corn",
            "a_p7": "c_wheat",
            "a_p8": "c_wheat",
            "b_p1": "c_barley",
            "b_p2": "c_barley",
            "b_p3": "c_wheat",
            "b_p4": "c_corn",
            "b_p5": "c_barley",
            "b_p6": "c_barley",
            "b_p7": "c_wheat",
            "b_p8": "c_barley",
        }

        decisions = backend_main.compute_all_decisions()
        p5 = decisions["a_p5"]

        self.assertEqual(p5["risk_score"], 10)
        self.assertEqual(p5["risk_level"], "OK")
        self.assertFalse(any(item["code"] == "NEIGHBOR_INCOMPATIBLE" for item in p5["reasons"]))


if __name__ == "__main__":
    unittest.main()

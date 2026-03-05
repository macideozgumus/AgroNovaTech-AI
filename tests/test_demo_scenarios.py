import unittest

from app.services.decision_engine import run_rules_v2
from app.core.enums import RiskLevel

class TestDemoScenarios(unittest.TestCase):
    def test_scenario_1_intra_block_increase(self):
        """Test 1 (Blok İçi Artış)"""
        output = run_rules_v2(
            parcel_crop_id="c_wheat",
            intra_block_neighbor_crop_ids=["c_sunflower"],
            inter_block_neighbor_crop_ids=[],
            village_unique_crops_count=2,
        )
        self.assertGreater(output.risk_score, 0)
        self.assertIn("INTRA_BLOCK_CONFLICT", output.reason_codes)

    def test_scenario_2_border_direction_sensitivity(self):
        """Test 2 (Yön/Sınır Hassasiyeti)"""
        output_normal = run_rules_v2(
            parcel_crop_id="c_wheat",
            intra_block_neighbor_crop_ids=[],
            inter_block_neighbor_crop_ids=["c_sunflower"],
            village_unique_crops_count=2,
            border_margin=1.0,
            wind_factor=1.0,
        )
        output_windy = run_rules_v2(
            parcel_crop_id="c_wheat",
            intra_block_neighbor_crop_ids=[],
            inter_block_neighbor_crop_ids=["c_sunflower"],
            village_unique_crops_count=2,
            border_margin=1.0,
            wind_factor=1.5,
        )
        self.assertGreater(output_windy.risk_score, output_normal.risk_score)
        self.assertIn("INTER_BLOCK_BORDER_CONFLICT", output_windy.reason_codes)

    def test_scenario_3_suitable_distribution(self):
        """Test 3 (Uygun Dağılım)"""
        output = run_rules_v2(
            parcel_crop_id="c_wheat",
            intra_block_neighbor_crop_ids=["c_wheat"],
            inter_block_neighbor_crop_ids=["c_corn"],
            village_unique_crops_count=2,
            border_margin=1.0,
            wind_factor=1.0,
        )
        self.assertEqual(output.risk_level, RiskLevel.OK.value)
        self.assertNotIn("INTRA_BLOCK_CONFLICT", output.reason_codes)
        self.assertNotIn("INTER_BLOCK_BORDER_CONFLICT", output.reason_codes)

if __name__ == "__main__":
    unittest.main()

import unittest
from app.services.decision_engine import run_rules_v1, run_rules_v2
from app.core.enums import RiskLevel

class TestDecisionEngine(unittest.TestCase):

    def test_run_rules_v1_critical(self):
        """
        Senaryo 1: Çok Yüksek Risk / CRITICAL (Hedef Skor: 70)
        - 3 uyumsuz komşu (Buğday <-> Ayçiçeği) -> 3 x 20 = 60 puan
        - Köydeki farklı ürün çeşidi > 3 (4 > 3) -> 10 puan
        - Toplam: 70 -> CRITICAL
        """
        output = run_rules_v1(
            parcel_crop_id="c_wheat",
            neighbor_crop_ids=["c_sunflower", "c_sunflower", "c_sunflower"],
            village_unique_crops_count=4
        )
        self.assertEqual(output.risk_score, 70)
        self.assertEqual(output.risk_level, RiskLevel.CRITICAL.value)
        self.assertIn("NEIGHBOR_INCOMPATIBLE", output.reason_codes)
        self.assertIn("HIGH_DIVERSITY_PRESSURE", output.reason_codes)

    def test_run_rules_v1_risky(self):
        """
        Senaryo 2: Orta Risk / RISKY (Hedef Skor: 45)
        - 1 uyumsuz komşu (Buğday <-> Ayçiçeği) -> 20 puan
        - Aynı ürün yoğunluğu %66.6 > %50 (3 komşudan 2'si Buğday) -> 15 puan
        - Köydeki farklı ürün çeşidi > 3 (4 > 3) -> 10 puan
        - Toplam: 45 -> RISKY
        """
        output = run_rules_v1(
            parcel_crop_id="c_wheat",
            neighbor_crop_ids=["c_sunflower", "c_wheat", "c_wheat"],
            village_unique_crops_count=4
        )
        self.assertEqual(output.risk_score, 45)
        self.assertEqual(output.risk_level, RiskLevel.RISKY.value)
        self.assertIn("NEIGHBOR_INCOMPATIBLE", output.reason_codes)
        self.assertIn("SAME_CROP_CLUSTERING", output.reason_codes)
        self.assertIn("HIGH_DIVERSITY_PRESSURE", output.reason_codes)

    def test_run_rules_v1_ok(self):
        """
        Senaryo 3: Güvenli / OK (Hedef Skor: 10)
        - 0 uyumsuz komşu -> 0 puan
        - Aynı ürün yoğunluğu %0 <= %50 -> 0 puan
        - Köydeki farklı ürün çeşidi > 3 (4 > 3) -> 10 puan
        - Toplam: 10 -> OK
        """
        output = run_rules_v1(
            parcel_crop_id="c_barley",
            neighbor_crop_ids=["c_wheat", "c_wheat", "c_corn"],
            village_unique_crops_count=4
        )
        self.assertEqual(output.risk_score, 10)
        self.assertEqual(output.risk_level, RiskLevel.OK.value)
        self.assertIn("HIGH_DIVERSITY_PRESSURE", output.reason_codes)
        self.assertNotIn("NEIGHBOR_INCOMPATIBLE", output.reason_codes)
        self.assertNotIn("SAME_CROP_CLUSTERING", output.reason_codes)

    def test_run_rules_v1_empty_string(self):
        """
        Ek Senaryo: Boş string gönderildiğinde parsel boş varsayılır ve UNKNOWN döner
        """
        output = run_rules_v1(
            parcel_crop_id="",
            neighbor_crop_ids=["c_wheat", "c_corn"],
            village_unique_crops_count=2
        )
        self.assertEqual(output.risk_score, 0)
        self.assertEqual(output.risk_level, RiskLevel.UNKNOWN.value)
        self.assertIn("UNKNOWN_DATA", output.reason_codes)

    def test_run_rules_v2_inter_block_conflict_is_heavier(self):
        output = run_rules_v2(
            parcel_crop_id="c_wheat",
            intra_block_neighbor_crop_ids=["c_sunflower"],
            inter_block_neighbor_crop_ids=["c_sunflower"],
            village_unique_crops_count=2,
        )
        self.assertEqual(output.risk_score, 45)
        self.assertEqual(output.risk_level, RiskLevel.RISKY.value)
        self.assertIn("INTRA_BLOCK_CONFLICT", output.reason_codes)
        self.assertIn("INTER_BLOCK_BORDER_CONFLICT", output.reason_codes)

    def test_run_rules_v2_same_input_changes_with_border_position(self):
        no_border_output = run_rules_v2(
            parcel_crop_id="c_wheat",
            intra_block_neighbor_crop_ids=["c_wheat", "c_wheat"],
            inter_block_neighbor_crop_ids=[],
            village_unique_crops_count=2,
        )
        border_output = run_rules_v2(
            parcel_crop_id="c_wheat",
            intra_block_neighbor_crop_ids=["c_wheat", "c_wheat"],
            inter_block_neighbor_crop_ids=["c_sunflower"],
            village_unique_crops_count=2,
        )
        self.assertGreater(border_output.risk_score, no_border_output.risk_score)
        self.assertIn("INTER_BLOCK_BORDER_CONFLICT", border_output.reason_codes)

if __name__ == '__main__':
    unittest.main()

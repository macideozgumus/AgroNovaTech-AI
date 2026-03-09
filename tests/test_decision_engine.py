from backend.app.decision_engine.hybrid import combine_rules_with_ml
from backend.app.decision_engine.rules_v2 import compute_rules_score


def test_rules_score_increases_with_inter_block_conflict():
    low, _ = compute_rules_score(
        intra_high=0,
        intra_medium=0,
        intra_same=0,
        inter_high=0,
        inter_medium=0,
        inter_same=0,
        same_crop_ratio=0.1,
        village_crop_diversity=2,
    )
    high, _ = compute_rules_score(
        intra_high=0,
        intra_medium=0,
        intra_same=0,
        inter_high=2,
        inter_medium=0,
        inter_same=0,
        same_crop_ratio=0.1,
        village_crop_diversity=2,
    )
    assert high > low


def test_hybrid_uses_ml_when_confidence_present():
    out = combine_rules_with_ml(rules_score=40, ml_score=80, ml_confidence=1.0)
    assert out.decision_source == "hybrid"
    assert out.model_version == "hybrid_v1"
    assert out.risk_score > 40


def test_rules_only_when_ml_missing():
    out = combine_rules_with_ml(rules_score=55, ml_score=None, ml_confidence=None)
    assert out.decision_source == "rules_only"
    assert out.model_version == "rules_v2"
    assert out.risk_score == 55

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RuleComponents:
    r_ic: float
    r_border: float
    r_density: float
    r_village: float


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def compute_rules_score(
    intra_high: int,
    intra_medium: int,
    intra_same: int,
    inter_high: int,
    inter_medium: int,
    inter_same: int,
    same_crop_ratio: float,
    village_crop_diversity: int,
) -> tuple[float, RuleComponents]:
    r_ic = (20 * intra_high) + (12 * intra_medium) + (13 * intra_same)
    r_border = (25 * inter_high) + (15 * inter_medium) + (16 * inter_same)
    r_density = 15 if same_crop_ratio > 0.5 else 0
    r_village = 10 if village_crop_diversity > 3 else 0
    total = clamp(r_ic + r_border + r_density + r_village)
    return total, RuleComponents(r_ic=r_ic, r_border=r_border, r_density=r_density, r_village=r_village)

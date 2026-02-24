from enum import Enum

from app.core.enums import RiskLevel


class ReasonCode(str, Enum):
    NEIGHBOR_INCOMPATIBLE = "NEIGHBOR_INCOMPATIBLE"
    HIGH_DIVERSITY_PRESSURE = "HIGH_DIVERSITY_PRESSURE"
    SAME_CROP_CLUSTERING = "SAME_CROP_CLUSTERING"
    UNKNOWN_DATA = "UNKNOWN_DATA"


REASON_TEXT_TR: dict[str, str] = {
    ReasonCode.NEIGHBOR_INCOMPATIBLE.value: "Komşu parsellerde uyumsuz ürün kombinasyonu tespit edildi.",
    ReasonCode.HIGH_DIVERSITY_PRESSURE.value: "Köyde ürün dağılımı dengesiz.",
    ReasonCode.SAME_CROP_CLUSTERING.value: "Aynı ürün yoğunluğu yüksek.",
    ReasonCode.UNKNOWN_DATA.value: "Karar için bazı veriler eksik veya tanımsız.",
}


RISK_LEVEL_THRESHOLDS: dict[RiskLevel, tuple[int, int]] = {
    RiskLevel.OK: (0, 39),
    RiskLevel.RISKY: (40, 69),
    RiskLevel.CRITICAL: (70, 100),
}


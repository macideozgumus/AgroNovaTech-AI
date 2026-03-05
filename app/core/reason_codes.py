from enum import Enum

from app.core.enums import RiskLevel


class ReasonCode(str, Enum):
    NEIGHBOR_INCOMPATIBLE = "NEIGHBOR_INCOMPATIBLE"
    INTRA_BLOCK_CONFLICT = "INTRA_BLOCK_CONFLICT"
    INTER_BLOCK_BORDER_CONFLICT = "INTER_BLOCK_BORDER_CONFLICT"
    HIGH_DIVERSITY_PRESSURE = "HIGH_DIVERSITY_PRESSURE"
    SAME_CROP_CLUSTERING = "SAME_CROP_CLUSTERING"
    HIGH_DENSITY_CLUSTERING = "HIGH_DENSITY_CLUSTERING"
    VILLAGE_DISTRIBUTION_PRESSURE = "VILLAGE_DISTRIBUTION_PRESSURE"
    UNKNOWN_DATA = "UNKNOWN_DATA"


REASON_TEXT_TR: dict[str, str] = {
    ReasonCode.NEIGHBOR_INCOMPATIBLE.value: "Komsu parsellerde uyumsuz urun kombinasyonu tespit edildi.",
    ReasonCode.INTRA_BLOCK_CONFLICT.value: "Ayni tarla blogu icinde uyumsuz komsu urun tespit edildi.",
    ReasonCode.INTER_BLOCK_BORDER_CONFLICT.value: "Komsu tarla sinirinda uyumsuz urun etkisi tespit edildi.",
    ReasonCode.HIGH_DIVERSITY_PRESSURE.value: "Koyde urun dagilimi dengesiz.",
    ReasonCode.SAME_CROP_CLUSTERING.value: "Ayni urun yogunlugu yuksek.",
    ReasonCode.HIGH_DENSITY_CLUSTERING.value: "Urun yogunlugu riski tespit edildi.",
    ReasonCode.VILLAGE_DISTRIBUTION_PRESSURE.value: "Koy geneli cesitlilik baskisi gozlemlendi.",
    ReasonCode.UNKNOWN_DATA.value: "Karar icin bazi veriler eksik veya tanimsiz.",
}


RISK_LEVEL_THRESHOLDS: dict[RiskLevel, tuple[int, int]] = {
    RiskLevel.OK: (0, 39),
    RiskLevel.RISKY: (40, 69),
    RiskLevel.CRITICAL: (70, 100),
}

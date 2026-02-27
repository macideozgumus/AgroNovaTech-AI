from enum import Enum

class RiskLevel(str, Enum):
    LOW = "dusuk"
    MEDIUM = "orta"
    HIGH = "yuksek"

class CropType(str, Enum):
    BUGDAY = "bugday"
    ARPA = "arpa"
    NOHUT = "nohut"
    MISIR = "misir"
    AYCICEK = "aycicek"
    PATATES = "patates"

class ReasonCode(str, Enum):
    NEIGHBOR_CONFLICT = "NEIGHBOR_CONFLICT"
    MONOCULTURE_RISK = "MONOCULTURE_RISK"
    COMPATIBLE = "COMPATIBLE"
    IDEAL = "IDEAL"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
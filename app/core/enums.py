from enum import Enum


class StrEnum(str, Enum):
    def __str__(self) -> str:
        return str(self.value)


class RiskLevel(StrEnum):
    UNKNOWN = "UNKNOWN"
    OK = "OK"
    RISKY = "RISKY"
    CRITICAL = "CRITICAL"


class UserRole(StrEnum):
    ADMIN = "ADMIN"
    FARMER = "FARMER"


class JobStatus(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class RecommendationType(StrEnum):
    CROP_SUGGESTION = "CROP_SUGGESTION"
    ACTION = "ACTION"
    WARNING = "WARNING"
    VILLAGE_PLAN = "VILLAGE_PLAN"


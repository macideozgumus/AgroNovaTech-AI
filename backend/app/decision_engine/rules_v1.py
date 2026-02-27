# Komşuluk bazlı risk hesaplama motoru
# AI ekibi bu dosyayı genişletecek

from app.core.enums import RiskLevel, ReasonCode

# Ürün uyum matrisi
# True = uyumlu, False = riskli
CROP_COMPATIBILITY = {
    ("bugday", "arpa"):    True,
    ("bugday", "nohut"):   True,
    ("bugday", "misir"):   False,
    ("bugday", "bugday"):  False,
    ("arpa",   "nohut"):   True,
    ("arpa",   "arpa"):    False,
    ("arpa",   "misir"):   True,
    ("nohut",  "misir"):   True,
    ("nohut",  "nohut"):   False,
    ("misir",  "aycicek"): True,
    ("misir",  "misir"):   False,
    ("aycicek","aycicek"): False,
    ("patates","bugday"):  True,
    ("patates","patates"): False,
}

def check_compatibility(crop_a: str, crop_b: str) -> bool:
    """İki ürünün uyumlu olup olmadığını kontrol eder."""
    key = (crop_a, crop_b)
    reverse_key = (crop_b, crop_a)
    if key in CROP_COMPATIBILITY:
        return CROP_COMPATIBILITY[key]
    if reverse_key in CROP_COMPATIBILITY:
        return CROP_COMPATIBILITY[reverse_key]
    return True  # Bilinmeyen kombinasyon = varsayılan uyumlu

def calculate_risk(crop_type: str, neighbor_crop_types: list) -> dict:
    """
    Komşu tarlalara göre risk skoru hesaplar.
    0.0 = sıfır risk, 1.0 = maksimum risk
    """
    if not neighbor_crop_types:
        return {
            "risk_score": 0.1,
            "risk_level": RiskLevel.LOW,
            "reason_code": ReasonCode.INSUFFICIENT_DATA,
            "recommendation": "Komşu tarla verisi yok, genel öneri: ekim planına devam edilebilir."
        }

    conflict_count = 0
    total = len(neighbor_crop_types)

    for neighbor_crop in neighbor_crop_types:
        if not check_compatibility(crop_type, neighbor_crop):
            conflict_count += 1

    # Monokultur kontrolü (aynı ürün komşuda)
    same_crop_count = neighbor_crop_types.count(crop_type)
    if same_crop_count >= 2:
        conflict_count += 1

    risk_score = round(conflict_count / (total + 1), 2)

    if risk_score == 0.0:
        return {
            "risk_score": 0.1,
            "risk_level": RiskLevel.LOW,
            "reason_code": ReasonCode.IDEAL,
            "recommendation": "Komşu tarlalarla tam uyum. Ekim planına devam edilebilir."
        }
    elif risk_score <= 0.35:
        return {
            "risk_score": risk_score,
            "risk_level": RiskLevel.LOW,
            "reason_code": ReasonCode.COMPATIBLE,
            "recommendation": "Genel uyum iyi. Takip önerilir."
        }
    elif risk_score <= 0.65:
        return {
            "risk_score": risk_score,
            "risk_level": RiskLevel.MEDIUM,
            "reason_code": ReasonCode.NEIGHBOR_CONFLICT,
            "recommendation": "Komşu tarlalarla kısmi uyumsuzluk. Alternatif ürün değerlendirilebilir."
        }
    else:
        return {
            "risk_score": risk_score,
            "risk_level": RiskLevel.HIGH,
            "reason_code": ReasonCode.MONOCULTURE_RISK,
            "recommendation": "Yüksek risk! Komşu tarlalarla ciddi uyumsuzluk. Ürün değişikliği önerilir."
        }
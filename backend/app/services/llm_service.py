"""Deterministic explanation and dialogue layer for hybrid scenario planning.

This module keeps final decisions in optimizer + rules, then produces
human-readable explanations, what-if analysis, and chat replies.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class PlanExplanation:
    summary_tr: str
    key_risks: list[str]
    farmer_recommendations: list[str]
    checklist: list[str]


@dataclass
class WhatIfResult:
    condition: str
    impact_summary: str
    affected_parcels: list[str]
    alternative_crops: list[str]


@dataclass
class ChatResponse:
    reply: str
    suggestions: list[str]


def _top_risk_parcels(plan_data: dict[str, Any], limit: int = 3) -> list[dict[str, Any]]:
    rows = list(plan_data.get("selections", []))
    return sorted(rows, key=lambda item: item.get("risk_score", 0), reverse=True)[:limit]


def explain_plan_with_llm(
    plan_data: dict[str, Any],
    risk_reasons: list[str],
    neighbor_info: Optional[dict[str, Any]] = None,
) -> PlanExplanation:
    plan_type = plan_data.get("plan_type", "balanced")
    balanced_count = int(plan_data.get("balanced_count", 0))
    risky_count = int(plan_data.get("risky_count", 0))
    critical_count = int(plan_data.get("critical_count", 0))
    top_risks = _top_risk_parcels(plan_data)
    top_risk_ids = [item["parcel_id"] for item in top_risks]

    strategy_line = {
        "balanced": "Bu plan komşu baskısı ile ürün çeşitliliği arasında denge kuruyor.",
        "low_risk": "Bu plan kritik alanları daha güvenli ürünlere çekerek temkinli davranıyor.",
        "yield_balance": "Bu plan verim potansiyelini korurken sınır baskısını makul seviyede tutuyor.",
    }.get(plan_type, "Bu plan mevcut skor motoruna göre dengeli aday olarak öne çıkıyor.")

    risk_lines: list[str] = []
    if "INTER_BLOCK_BORDER_CONFLICT" in risk_reasons:
        risk_lines.append("Sınır komşuluğunda yüksek uyumsuzluk görülen parseller var.")
    if "INTRA_BLOCK_CONFLICT" in risk_reasons:
        risk_lines.append("Aynı blok içinde birbirini zorlayan ürün eşleşmeleri bulunuyor.")
    if "HIGH_DENSITY_CLUSTERING" in risk_reasons:
        risk_lines.append("Bazı alanlarda aynı ürün yoğunluğu risk yaratıyor.")
    if not risk_lines:
        risk_lines.append("Belirgin bir sert kural ihlali görünmüyor.")

    recommendations = [
        "Ekim öncesi en riskli parseller için komşu ürün dağılımını sahada tekrar doğrula.",
        "Sulama planı zayıfsa buğday ve arpa ağırlığını artıran düşük risk senaryoyu karşılaştır.",
        "Kararı uygulamadan önce kritik kalan parseller için bir tur daha skor üret.",
    ]

    checklist = [
        "Komşu parsel ürünleri güncel mi kontrol et.",
        "Su erişimi ve ekipman planı hazır mı doğrula.",
        "Kritik veya riskli kalan parseller için alternatif planı incele.",
    ]

    if neighbor_info and neighbor_info.get("edges"):
        checklist.append("Sınır kenarındaki parseller için komşuluk grafiğini son kez gözden geçir.")

    summary = (
        f"{strategy_line} Dengeli parsel sayısı {balanced_count}, riskli parsel sayısı {risky_count}, "
        f"kritik parsel sayısı {critical_count} olarak görünüyor."
    )
    if top_risk_ids:
        summary += f" Özellikle {', '.join(top_risk_ids)} parselleri dikkat istiyor."

    return PlanExplanation(
        summary_tr=summary,
        key_risks=risk_lines,
        farmer_recommendations=recommendations,
        checklist=checklist,
    )


def generate_what_if_analysis(
    plan_data: dict[str, Any],
    conditions: list[str],
) -> list[WhatIfResult]:
    rows = _top_risk_parcels(plan_data)
    top_risk_ids = [item["parcel_id"] for item in rows]
    outputs: list[WhatIfResult] = []

    for condition in conditions:
        normalized = condition.lower()
        if "su" in normalized:
            outputs.append(
                WhatIfResult(
                    condition=condition,
                    impact_summary="Su seviyesi düşerse mısır baskısı artar, düşük su uyumlu ürünler daha güvenli olur.",
                    affected_parcels=top_risk_ids,
                    alternative_crops=["wheat", "barley"],
                )
            )
        elif "verim" in normalized or "fiyat" in normalized:
            outputs.append(
                WhatIfResult(
                    condition=condition,
                    impact_summary="Verim beklentisi veya fiyat baskısı artarsa ayçiçeği ve mısır öne çıkabilir, fakat sınır riskleri tekrar kontrol edilmelidir.",
                    affected_parcels=top_risk_ids,
                    alternative_crops=["corn", "sunflower"],
                )
            )
        else:
            outputs.append(
                WhatIfResult(
                    condition=condition,
                    impact_summary="Koşul değişikliğinin etkisi öncelikle riskli parsellerde görülür; alternatif plan karşılaştırması önerilir.",
                    affected_parcels=top_risk_ids,
                    alternative_crops=["wheat", "sunflower"],
                )
            )

    return outputs


def chat_about_plan(
    plan_id: str,
    user_message: str,
    context: Optional[dict[str, Any]] = None,
) -> ChatResponse:
    normalized = user_message.lower()
    context = context or {}

    if "neden" in normalized and "öner" in normalized:
        reply = (
            f"{plan_id} planı, backend skor motorunda komşuluk baskısı ile çeşitlilik dengesini daha iyi koruduğu için öne çıktı. "
            "Son karar LLM tarafından değil, optimizer ve kurallar tarafından verildi."
        )
    elif "risk" in normalized and ("düş" in normalized or "azalt" in normalized):
        reply = (
            "Riski düşürmek için önce kritik kalan parsellerde mısır ve ayçiçeği yoğunluğunu azaltıp "
            "buğday veya arpa alternatiflerini karşılaştırmak gerekir."
        )
    elif "alternatif" in normalized or "ne olur" in normalized:
        reply = (
            "Alternatif plan için su, komşu ürün ve riskli parsel bilgisi yeniden değerlendirilmelidir. "
            "Düşük risk ve verim dengeli planları birlikte karşılaştırmanız en doğru adım olur."
        )
    else:
        reply = (
            f"{plan_id} planı hakkında yardımcı olabilirim. "
            f"Bağlam: köy={context.get('village_id', 'bilinmiyor')}, sezon={context.get('season', 'bilinmiyor')}."
        )

    return ChatResponse(
        reply=reply,
        suggestions=[
            "Bu plan neden seçildi?",
            "Daha temkinli alternatif var mı?",
            "Su azalırsa hangi parseller etkilenir?",
        ],
    )

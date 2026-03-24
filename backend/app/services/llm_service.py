"""Gemini-backed explanation layer with deterministic fallback."""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import httpx
from dotenv import load_dotenv

GEMINI_API_KEY_ENV = "GEMINI_API_KEY"
GEMINI_MODEL_ENV = "GEMINI_MODEL"
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_TIMEOUT_SECONDS = 8.0
STATUS_CACHE_TTL_SECONDS = 300

_last_provider_status = {"checked_at": 0.0, "enabled": False, "provider": None, "reason": "not_checked"}

load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)


@dataclass
class PlanExplanation:
    summary_tr: str
    key_risks: list[str]
    farmer_recommendations: list[str]
    checklist: list[str]
    provider: str = "fallback"


@dataclass
class WhatIfResult:
    condition: str
    impact_summary: str
    affected_parcels: list[str]
    alternative_crops: list[str]
    provider: str = "fallback"


@dataclass
class ChatResponse:
    reply: str
    suggestions: list[str]
    provider: str = "fallback"


@dataclass
class ProviderStatus:
    enabled: bool
    provider: Optional[str]
    reason: str


def _gemini_api_key() -> Optional[str]:
    return os.getenv(GEMINI_API_KEY_ENV)


def _gemini_model() -> str:
    return os.getenv(GEMINI_MODEL_ENV, DEFAULT_GEMINI_MODEL)


def _gemini_enabled() -> bool:
    api_key = _gemini_api_key()
    return bool(api_key and api_key != "your_gemini_api_key_here")


def _extract_text(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates") or []
    if not candidates:
        return ""
    content = candidates[0].get("content") or {}
    parts = content.get("parts") or []
    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    return "\n".join(text for text in texts if text).strip()


def _call_gemini(prompt: str, system_instruction: str) -> str:
    api_key = _gemini_api_key()
    if not api_key:
        raise RuntimeError("Gemini API key is missing")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{_gemini_model()}:generateContent"
    payload = {
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 700,
            "topP": 0.8,
        },
    }

    with httpx.Client(timeout=GEMINI_TIMEOUT_SECONDS) as client:
        response = client.post(url, params={"key": api_key}, json=payload)
        response.raise_for_status()
        text = _extract_text(response.json())
        if not text:
            raise RuntimeError("Gemini returned an empty response")
        return text


def _describe_provider_error(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        status_code = exc.response.status_code
        try:
            payload = exc.response.json()
            message = ((payload.get("error") or {}).get("message")) or exc.response.text
        except Exception:
            message = exc.response.text
        message = " ".join(message.split())[:160]
        return f"gemini_http_{status_code}:{message}"
    if isinstance(exc, httpx.ConnectError):
        return "gemini_connect_error"
    if isinstance(exc, httpx.ReadTimeout):
        return "gemini_timeout"
    return f"gemini_error:{type(exc).__name__}"


def _top_risk_parcels(plan_data: dict[str, Any], limit: int = 3) -> list[dict[str, Any]]:
    rows = list(plan_data.get("selections", []))
    return sorted(rows, key=lambda item: item.get("risk_score", 0), reverse=True)[:limit]


def _fallback_plan_explanation(
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
        provider="fallback",
    )


def _fallback_what_if(plan_data: dict[str, Any], conditions: list[str]) -> list[WhatIfResult]:
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
                    provider="fallback",
                )
            )
        elif "verim" in normalized or "fiyat" in normalized:
            outputs.append(
                WhatIfResult(
                    condition=condition,
                    impact_summary="Verim beklentisi veya fiyat baskısı artarsa ayçiçeği ve mısır öne çıkabilir, fakat sınır riskleri tekrar kontrol edilmelidir.",
                    affected_parcels=top_risk_ids,
                    alternative_crops=["corn", "sunflower"],
                    provider="fallback",
                )
            )
        else:
            outputs.append(
                WhatIfResult(
                    condition=condition,
                    impact_summary="Koşul değişikliğinin etkisi öncelikle riskli parsellerde görülür; alternatif plan karşılaştırması önerilir.",
                    affected_parcels=top_risk_ids,
                    alternative_crops=["wheat", "sunflower"],
                    provider="fallback",
                )
            )
    return outputs


def _fallback_chat(plan_id: str, user_message: str, context: Optional[dict[str, Any]] = None) -> ChatResponse:
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
        provider="fallback",
    )


def explain_plan_with_llm(
    plan_data: dict[str, Any],
    risk_reasons: list[str],
    neighbor_info: Optional[dict[str, Any]] = None,
) -> PlanExplanation:
    fallback = _fallback_plan_explanation(plan_data, risk_reasons, neighbor_info)
    if not _gemini_enabled():
        return fallback

    prompt = (
        "Aşağıdaki tarım planını çiftçiye sade Türkçe ile açıkla.\n"
        "Kısa bir paragraf üret. Teknik ama anlaşılır ol.\n"
        f"Plan verisi: {json.dumps(plan_data, ensure_ascii=False)}\n"
        f"Risk nedenleri: {json.dumps(risk_reasons, ensure_ascii=False)}\n"
        f"Komşuluk özeti: {json.dumps(neighbor_info or {}, ensure_ascii=False)}"
    )
    system_instruction = (
        "Sen bir tarımsal karar açıklama asistanısın. Nihai kararı değiştirme. "
        "Sadece optimizer ve rules çıktısını açıkla."
    )
    try:
        text = _call_gemini(prompt, system_instruction)
        return PlanExplanation(
            summary_tr=text,
            key_risks=fallback.key_risks,
            farmer_recommendations=fallback.farmer_recommendations,
            checklist=fallback.checklist,
            provider="gemini",
        )
    except Exception:
        return fallback


def generate_what_if_analysis(
    plan_data: dict[str, Any],
    conditions: list[str],
) -> list[WhatIfResult]:
    fallback = _fallback_what_if(plan_data, conditions)
    if not _gemini_enabled():
        return fallback

    prompt = (
        "Aşağıdaki plan için her koşul hakkında kısa etki analizi yap.\n"
        "Her koşul için bir kısa cümle üret.\n"
        f"Plan verisi: {json.dumps(plan_data, ensure_ascii=False)}\n"
        f"Koşullar: {json.dumps(conditions, ensure_ascii=False)}"
    )
    system_instruction = (
        "Sen tarımsal what-if analiz asistanısın. "
        "Nihai kararı değiştirme, sadece olası etkileri özetle."
    )
    try:
        text = _call_gemini(prompt, system_instruction)
        lines = [line.strip("- ").strip() for line in text.splitlines() if line.strip()]
        outputs: list[WhatIfResult] = []
        for index, condition in enumerate(conditions):
            impact = lines[index] if index < len(lines) else fallback[index].impact_summary
            outputs.append(
                WhatIfResult(
                    condition=condition,
                    impact_summary=impact,
                    affected_parcels=fallback[index].affected_parcels,
                    alternative_crops=fallback[index].alternative_crops,
                    provider="gemini",
                )
            )
        return outputs
    except Exception:
        return fallback


def chat_about_plan(
    plan_id: str,
    user_message: str,
    context: Optional[dict[str, Any]] = None,
) -> ChatResponse:
    fallback = _fallback_chat(plan_id, user_message, context)
    if not _gemini_enabled():
        return fallback

    prompt = (
        "Aşağıdaki kullanıcı mesajına Türkçe yanıt ver.\n"
        "Kısa, net ve tarımsal plan bağlamına sadık ol.\n"
        f"Plan kimliği: {plan_id}\n"
        f"Bağlam: {json.dumps(context or {}, ensure_ascii=False)}\n"
        f"Kullanıcı mesajı: {user_message}"
    )
    system_instruction = (
        "Sen optimizer ve rules sonuçlarını açıklayan bir tarım asistanısın. "
        "Nihai kararı değiştirme, sadece açıkla ve alternatifleri tartış."
    )
    try:
        text = _call_gemini(prompt, system_instruction)
        return ChatResponse(reply=text, suggestions=fallback.suggestions, provider="gemini")
    except Exception:
        return fallback


def get_llm_provider_status(force_refresh: bool = False) -> ProviderStatus:
    now = time.time()
    if not force_refresh and now - _last_provider_status["checked_at"] < STATUS_CACHE_TTL_SECONDS:
        return ProviderStatus(
            enabled=bool(_last_provider_status["enabled"]),
            provider=_last_provider_status["provider"],
            reason=str(_last_provider_status["reason"]),
        )

    if not _gemini_enabled():
        _last_provider_status.update(
            {"checked_at": now, "enabled": False, "provider": None, "reason": "missing_api_key"}
        )
        return ProviderStatus(enabled=False, provider=None, reason="missing_api_key")

    try:
        _call_gemini("Yanıt olarak sadece OK yaz.", "Sadece OK döndür.")
        _last_provider_status.update(
            {"checked_at": now, "enabled": True, "provider": "gemini", "reason": "ok"}
        )
        return ProviderStatus(enabled=True, provider="gemini", reason="ok")
    except Exception as exc:
        reason = _describe_provider_error(exc)
        _last_provider_status.update(
            {"checked_at": now, "enabled": False, "provider": None, "reason": reason}
        )
        return ProviderStatus(enabled=False, provider=None, reason=reason)

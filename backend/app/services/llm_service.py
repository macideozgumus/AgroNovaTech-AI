"""LLM Service — Explanation & Dialogue Layer

Hibrit mimaride LLM'in rolü:
  FinalDecision = numeric optimizer + hard/soft rules
  LLM            = explanation + what-if analysis + user dialogue

Bu modül üç ayrı LLM kullanım alanını kapsar:
  1. Plan Explanation  → "Bu plan neden önerildi?"
  2. What-if Analysis  → "Su azalırsa ne değişir?"
  3. User Dialogue     → "Mısırdan vazgeçmeden riski düşürmek istiyorum"

NOT: Fonksiyonlar şu an iskelet (stub) hâlindedir. LLM API entegrasyonu
     (OpenAI / Gemini / yerel model) ilerleyen sprintlerde eklenecektir.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Data Transfer Objects
# ---------------------------------------------------------------------------

@dataclass
class PlanExplanation:
    """LLM'in ürettiği plan açıklaması."""
    summary_tr: str                 # Sade Türkçe özet
    key_risks: list[str]            # Öne çıkan risk başlıkları
    farmer_recommendations: list[str]  # Çiftçiye öneriler
    checklist: list[str]            # Uygulanmadan önce kontrol listesi


@dataclass
class WhatIfResult:
    """Bir koşul değişikliği senaryosunun sonucu."""
    condition: str                  # Değiştirilen koşul açıklaması
    impact_summary: str             # Etkinin kısa özeti
    affected_parcels: list[str]     # Etkilenen parsel ID'leri
    alternative_crops: list[str]    # Önerilen alternatif ürünler


@dataclass
class ChatResponse:
    """Kullanıcı diyalog yanıtı."""
    reply: str                      # LLM'in doğal dil yanıtı
    suggestions: list[str]          # Takip sorusu önerileri


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def explain_plan_with_llm(
    plan_data: dict[str, Any],
    risk_reasons: list[str],
    neighbor_info: Optional[dict[str, Any]] = None,
) -> PlanExplanation:
    """Optimizer çıktısını alır, sade Türkçe plan açıklaması üretir.

    Parameters
    ----------
    plan_data : dict
        Optimizer'ın ürettiği plan verisi.  Beklenen anahtarlar:
        ``plan_type``, ``title``, ``selections``, ``balanced_count``,
        ``risky_count``, ``critical_count``, ``reason_list``.
    risk_reasons : list[str]
        ``INTRA_BLOCK_CONFLICT``, ``INTER_BLOCK_BORDER_CONFLICT`` gibi
        risk neden kodları.
    neighbor_info : dict, optional
        Komşuluk grafiği bilgisi (node/edge listesi).

    Returns
    -------
    PlanExplanation
        Türkçe özet, riskler, öneriler ve kontrol listesi.

    Raises
    ------
    NotImplementedError
        LLM entegrasyonu henüz tamamlanmadı.
    """
    # TODO: LLM API çağrısı eklenecek (Sprint-3)
    # Prompt şablonu:
    #   - plan tipi, seçilen ürünler, riskli/kritik parseller
    #   - komşuluk uyarıları, skor özeti
    #   - İstenen çıktı: sade Türkçe açıklama, çiftçiye öneri, kontrol listesi
    raise NotImplementedError(
        "explain_plan_with_llm henüz uygulanmadı. "
        "LLM API entegrasyonu Sprint-3'te eklenecek."
    )


def generate_what_if_analysis(
    plan_data: dict[str, Any],
    conditions: list[str],
) -> list[WhatIfResult]:
    """Koşul değişikliği senaryolarını analiz eder.

    Örnek sorular:
      - "Su seviyesi düşerse ne olur?"
      - "Buğday fiyatı artarsa hangi parseller etkilenir?"
      - "Komşu parsel mısıra geçerse risk nasıl değişir?"

    Parameters
    ----------
    plan_data : dict
        Mevcut plan verisi (selections, risk skorları vb.).
    conditions : list[str]
        Analiz edilecek koşul açıklamaları.
        Örn: ``["su_seviyesi_dusuk", "bugday_fiyat_artisi"]``

    Returns
    -------
    list[WhatIfResult]
        Her koşul için etki analizi sonucu.

    Raises
    ------
    NotImplementedError
        LLM entegrasyonu henüz tamamlanmadı.
    """
    # TODO: LLM API çağrısı eklenecek (Sprint-3)
    # Prompt şablonu:
    #   - mevcut plan + alan bazlı koşul değişikliği
    #   - İstenen çıktı: etki özeti, etkilenen parseller, alternatif ürünler
    raise NotImplementedError(
        "generate_what_if_analysis henüz uygulanmadı. "
        "LLM API entegrasyonu Sprint-3'te eklenecek."
    )


def chat_about_plan(
    plan_id: str,
    user_message: str,
    context: Optional[dict[str, Any]] = None,
) -> ChatResponse:
    """Kullanıcıyla doğal dil diyaloğu yürütür.

    Örnek kullanıcı mesajları:
      - "Bu planı neden önerdin?"
      - "Mısırdan vazgeçmeden riski düşürmek istiyorum"
      - "a_p3 parseli için daha güvenli bir ürün var mı?"

    Parameters
    ----------
    plan_id : str
        Konuşmanın bağlamındaki plan kimliği.
    user_message : str
        Kullanıcının doğal dil mesajı.
    context : dict, optional
        Ek bağlam bilgisi (village_id, season, mevcut seçimler vb.).

    Returns
    -------
    ChatResponse
        LLM'in yanıtı ve takip sorusu önerileri.

    Raises
    ------
    NotImplementedError
        LLM entegrasyonu henüz tamamlanmadı.
    """
    # TODO: LLM API çağrısı eklenecek (Sprint-3)
    # Prompt şablonu:
    #   - plan_id üzerinden senaryo verisi çekilir
    #   - kullanıcı mesajı + plan bağlamı birleştirilir
    #   - İstenen çıktı: doğal dil yanıt, takip sorusu önerileri
    raise NotImplementedError(
        "chat_about_plan henüz uygulanmadı. "
        "LLM API entegrasyonu Sprint-3'te eklenecek."
    )

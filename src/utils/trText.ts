type ReasonLike = { code?: string; text?: string };
type RecommendationLike = { text?: string };

const REASON_TR_BY_CODE: Record<string, string> = {
  NEIGHBOR_INCOMPATIBLE: "Komşu parsellerde uyumsuz ürün kombinasyonu tespit edildi.",
  INTRA_BLOCK_CONFLICT: "Aynı tarla bloğu içinde uyumsuz komşu ürün tespit edildi.",
  INTER_BLOCK_BORDER_CONFLICT: "Komşu tarla sınırında uyumsuz ürün etkisi tespit edildi.",
  HIGH_DIVERSITY_PRESSURE: "Köyde ürün dağılımı dengesiz.",
  SAME_CROP_CLUSTERING: "Aynı ürün yoğunluğu yüksek.",
  UNKNOWN_DATA: "Karar için bazı veriler eksik veya tanımsız.",
};

const EXACT_TEXT_TR: Record<string, string> = {
  "Komsu parsellerde uyumsuz urun kombinasyonu tespit edildi.": REASON_TR_BY_CODE.NEIGHBOR_INCOMPATIBLE,
  "Ayni tarla blogu icinde uyumsuz komsu urun tespit edildi.": REASON_TR_BY_CODE.INTRA_BLOCK_CONFLICT,
  "Komsu tarla sinirinda uyumsuz urun etkisi tespit edildi.": REASON_TR_BY_CODE.INTER_BLOCK_BORDER_CONFLICT,
  "Koyde urun dagilimi dengesiz.": REASON_TR_BY_CODE.HIGH_DIVERSITY_PRESSURE,
  "Ayni urun yogunlugu yuksek.": REASON_TR_BY_CODE.SAME_CROP_CLUSTERING,
  "Karar icin bazi veriler eksik veya tanimsiz.": REASON_TR_BY_CODE.UNKNOWN_DATA,
  "Komsu parselde aycicek tespit edildi.": "Komşu parselde ayçiçek tespit edildi.",
  "Sinir komsulugu icin arpa veya misir onerilir.": "Sınır komşuluğu için arpa veya mısır önerilir.",
  "Arpa veya misir onerilir.": "Arpa veya mısır önerilir.",
  "Munavebe icin farkli urun planlayin.": "Münavebe için farklı ürün planlayın.",
  "Mevcut plan uygun gorunuyor, sezon takibi yapin.": "Mevcut plan uygun görünüyor, sezon takibi yapın.",
  "Ekim tarihini 7-10 gun kaydirmak risk azaltabilir.": "Ekim tarihini 7-10 gün kaydırmak riski azaltabilir.",
};

const TOKEN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bKomsu\b/g, "Komşu"],
  [/\bkomsu\b/g, "komşu"],
  [/\bsinir\b/g, "sınır"],
  [/\bAyni\b/g, "Aynı"],
  [/\bayni\b/g, "aynı"],
  [/\burun\b/g, "ürün"],
  [/\bUrun\b/g, "Ürün"],
  [/\boge\b/g, "öğe"],
  [/\bKoy\b/g, "Köy"],
  [/\bkoy\b/g, "köy"],
  [/\bdagilimi\b/g, "dağılımı"],
  [/\byogunlugu\b/g, "yoğunluğu"],
  [/\byuksek\b/g, "yüksek"],
  [/\bicin\b/g, "için"],
  [/\bIcinde\b/g, "İçinde"],
  [/\bicinde\b/g, "içinde"],
  [/\btanimsiz\b/g, "tanımsız"],
  [/\bbazi\b/g, "bazı"],
  [/\bonerilir\b/g, "önerilir"],
  [/\boneri\b/g, "öneri"],
  [/\bgorunuyor\b/g, "görünüyor"],
  [/\bkaydirmak\b/g, "kaydırmak"],
  [/\bgun\b/g, "gün"],
  [/\bfarkli\b/g, "farklı"],
  [/\bMunavebe\b/g, "Münavebe"],
  [/\bAycicek\b/g, "Ayçiçek"],
  [/\baycicek\b/g, "ayçiçek"],
  [/\bblogu\b/g, "bloğu"],
  [/\bBlogu\b/g, "Bloğu"],
];

export function normalizeTrText(text?: string | null): string {
  if (!text) return "";
  if (EXACT_TEXT_TR[text]) {
    return EXACT_TEXT_TR[text];
  }
  let out = text;
  for (const [pattern, replacement] of TOKEN_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function getReasonTextTr(reason: ReasonLike): string {
  if (reason.code && REASON_TR_BY_CODE[reason.code]) {
    return REASON_TR_BY_CODE[reason.code];
  }
  return normalizeTrText(reason.text ?? "");
}

export function getRecommendationTextTr(recommendation: RecommendationLike): string {
  return normalizeTrText(recommendation.text ?? "");
}

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "./ui";

const PRIORITY_MAP: Record<string, number> = {
  INTER_BLOCK_BORDER_CONFLICT: 1,
  INTRA_BLOCK_CONFLICT: 2,
  HIGH_DENSITY_CLUSTERING: 3,
  VILLAGE_DISTRIBUTION_PRESSURE: 4,
};

const COPY_MAP: Record<string, { title: string; detail: string; tone: string }> = {
  INTER_BLOCK_BORDER_CONFLICT: {
    title: "Sınır Tarla Çatışması",
    detail: "Komşu blokta uyumsuz ürün etkisi var. Sınır parselleri daha dikkatli planlanmalı.",
    tone: colors.critical,
  },
  INTRA_BLOCK_CONFLICT: {
    title: "Blok İçi Ürün Çatışması",
    detail: "Aynı tarla bloğunda komşu parseller birbiriyle uyumsuz bir kombinasyon oluşturuyor.",
    tone: colors.risky,
  },
  HIGH_DENSITY_CLUSTERING: {
    title: "Yoğun Tek Ürün Deseni",
    detail: "Aynı ürünün yoğunlaşması risk yayılımını ve verim baskısını artırıyor.",
    tone: colors.risky,
  },
  VILLAGE_DISTRIBUTION_PRESSURE: {
    title: "Köy Geneli Dağılım Baskısı",
    detail: "Köy genelindeki ürün dağılımı dengeli değil. Kolektif planlama gerekli.",
    tone: colors.ok,
  },
};

export function sortReasonCodes(reasonCodes: string[]) {
  return [...reasonCodes].sort((a, b) => (PRIORITY_MAP[a] ?? 99) - (PRIORITY_MAP[b] ?? 99));
}

export function ReasonList({ reasonCodes }: { reasonCodes: string[] }) {
  const items = sortReasonCodes(reasonCodes);
  if (items.length === 0) {
    return <Text style={styles.empty}>Belirgin bir risk nedeni kaydı yok.</Text>;
  }

  return (
    <View style={styles.list}>
      {items.map((code, index) => {
        const copy = COPY_MAP[code] ?? {
          title: code,
          detail: "Bu risk kodu için açıklama tanımlanmadı.",
          tone: colors.unknown,
        };
        return (
          <View key={`${code}-${index}`} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: copy.tone }]} />
            <View style={styles.copy}>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.detail}>{copy.detail}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#35261d",
    padding: 14,
    borderWidth: 1,
    borderColor: "#493227",
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    marginTop: 6,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  detail: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
  },
});

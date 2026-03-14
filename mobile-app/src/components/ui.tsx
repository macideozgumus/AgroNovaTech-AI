import React, { useState } from "react";
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import type { ParcelItem, RiskLevel } from "../types/api";

export const colors = {
  appBg: "#241712",
  panel: "#2f2018",
  cardBorder: "#4e372b",
  text: "#f8f1e8",
  muted: "#baa48f",
  accent: "#ff7a21",
  ok: "#69ef42",
  risky: "#f8c941",
  critical: "#ff625b",
  unknown: "#91a0b5",
};

const cropImageMap: Record<string, string> = {
  corn: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
  wheat: "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=900&q=80",
  barley: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80",
  sunflower: "https://images.unsplash.com/photo-1470509037663-253afd7f0f51?auto=format&fit=crop&w=900&q=80",
};

const cropFallbackMap: Record<string, string> = {
  corn: "#4f7a33",
  wheat: "#8d7232",
  barley: "#6a5d32",
  sunflower: "#9a7337",
};

export function ScreenShell({
  children,
  contentStyle,
}: {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.screen, contentStyle]}>{children}</View>;
}

export function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.primaryButtonDisabled,
        pressed && !disabled && styles.primaryButtonPressed,
      ]}
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function InputField({
  label,
  ...props
}: TextInputProps & {
  label: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput placeholderTextColor="#7f746d" {...props} style={[styles.input, props.style]} />
    </View>
  );
}

export function RiskBadge({ level }: { level: RiskLevel | "UNKNOWN" }) {
  const palette =
    level === "OK"
      ? { bg: "rgba(105,239,66,0.14)", fg: colors.ok }
      : level === "RISKY"
        ? { bg: "rgba(248,201,65,0.15)", fg: colors.risky }
        : level === "CRITICAL"
          ? { bg: "rgba(255,98,91,0.14)", fg: colors.critical }
          : { bg: "rgba(145,160,181,0.14)", fg: colors.unknown };

  const text =
    level === "OK" ? "Guvenli" : level === "RISKY" ? "Riskli" : level === "CRITICAL" ? "Kritik" : "Bilinmiyor";

  return (
    <View style={[styles.riskBadge, { backgroundColor: palette.bg }]}> 
      <View style={[styles.riskDot, { backgroundColor: palette.fg }]} />
      <Text style={[styles.riskBadgeText, { color: palette.fg }]}>{text}</Text>
    </View>
  );
}

export function ParcelVisualCard({
  parcel,
  riskLevel,
  subtitle,
  onPress,
}: {
  parcel: ParcelItem;
  riskLevel: RiskLevel | "UNKNOWN";
  subtitle: string;
  onPress: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUri = cropImageMap[parcel.planned_crop] ?? cropImageMap.wheat;
  const fallbackColor = cropFallbackMap[parcel.planned_crop] ?? "#47502f";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.parcelCard, pressed && { opacity: 0.92 }]}> 
      {imageFailed ? (
        <View style={[styles.parcelImage, styles.parcelImageInner, { backgroundColor: fallbackColor }]}>
          <View style={styles.parcelOverlay} />
          <View style={styles.parcelTopRow}>
            <Text style={styles.cropChip}>{parcel.planned_crop.toUpperCase()}</Text>
            <RiskBadge level={riskLevel} />
          </View>
          <View style={styles.parcelBottom}>
            <Text style={styles.parcelTitle}>{parcel.parcel_id.toUpperCase()}</Text>
            <Text style={styles.parcelSubtitle}>{subtitle}</Text>
          </View>
        </View>
      ) : (
        <ImageBackground
          source={{ uri: imageUri }}
          style={styles.parcelImage}
          imageStyle={styles.parcelImageInner}
          onError={() => setImageFailed(true)}
        >
          <View style={styles.parcelOverlay} />
          <View style={styles.parcelTopRow}>
            <Text style={styles.cropChip}>{parcel.planned_crop.toUpperCase()}</Text>
            <RiskBadge level={riskLevel} />
          </View>
          <View style={styles.parcelBottom}>
            <Text style={styles.parcelTitle}>{parcel.parcel_id.toUpperCase()}</Text>
            <Text style={styles.parcelSubtitle}>{subtitle}</Text>
          </View>
        </ImageBackground>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBg,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },
  sectionCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.panel,
    padding: 18,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#153822",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2d5e41",
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: "#f4fff1",
    fontSize: 17,
    fontWeight: "700",
  },
  inputGroup: {
    gap: 10,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#c7d5c6",
    backgroundColor: "#f5f7f0",
    color: "#1d291c",
    paddingHorizontal: 16,
    fontSize: 17,
  },
  riskBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  riskDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  riskBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  parcelCard: {
    width: "48%",
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 14,
  },
  parcelImage: {
    minHeight: 236,
    justifyContent: "space-between",
    padding: 16,
  },
  parcelImageInner: {
    borderRadius: 22,
  },
  parcelOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  parcelTopRow: {
    zIndex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cropChip: {
    zIndex: 1,
    color: "#fff7e8",
    backgroundColor: "rgba(34,22,16,0.72)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  parcelBottom: {
    zIndex: 1,
    gap: 5,
  },
  parcelTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  parcelSubtitle: {
    color: "#f0ddd0",
    fontSize: 15,
    fontWeight: "600",
  },
});

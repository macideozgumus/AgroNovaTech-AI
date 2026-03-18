import React, { useState } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../api/client";
import { saveAuthToken } from "../api/cache";
import { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const aerialHero =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=80";

export function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("demo123");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const result = await apiClient.login({ username, password });
      await saveAuthToken(result.access_token);
      navigation.replace("VillageParcels");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Giri\u015f ba\u015far\u0131s\u0131z");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ImageBackground source={{ uri: aerialHero }} style={styles.heroMap} imageStyle={styles.heroMapImage}>
            <View style={styles.heroOverlay} />
          </ImageBackground>

          <View style={styles.loginCard}>
            <Text style={styles.cardEyebrow}>{"Demo Giri\u015fi"}</Text>
            <Text style={styles.cardTitle}>{"Bilin\u00e7li \u00c7ift\u00e7i K\u00f6y\u00fc"}</Text>
            <Text style={styles.cardText}>{"Kendi tarlalar\u0131na ula\u015f, k\u00f6y genelini incele ve hasat plan\u0131n\u0131 takip et."}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{"Kullan\u0131c\u0131 ad\u0131"}</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                style={styles.input}
                placeholder="demo"
                placeholderTextColor="#93A0AA"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{"\u015eifre"}</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                placeholder="demo123"
                placeholderTextColor="#93A0AA"
              />
            </View>

            {errorText ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>{"Giri\u015f ba\u015far\u0131s\u0131z"}</Text>
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            ) : null}

            <Pressable style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={onLogin} disabled={loading}>
              <Text style={styles.primaryButtonText}>{loading ? "Giriliyor..." : "Giri\u015f Yap"}</Text>
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>DEMO HESAP</Text>
              <Text style={styles.metaValue}>demo / demo123</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>PANEL</Text>
              <Text style={styles.metaValue}>{"Tarlam - K\u00f6y Geneli - Hasat"}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F6F2",
  },
  page: {
    flex: 1,
    backgroundColor: "#F4F6F2",
  },
  scrollContent: {
    paddingBottom: 28,
    paddingTop: 12,
  },
  heroMap: {
    minHeight: 360,
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  heroMapImage: {
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 18, 20, 0.1)",
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
  },
  loginCard: {
    marginHorizontal: 18,
    marginTop: -42,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 20,
    gap: 14,
  },
  cardEyebrow: {
    color: "#2B8A37",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "#10162F",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 38,
  },
  cardText: {
    color: "#68796F",
    fontSize: 15,
    lineHeight: 22,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: "#20362B",
    fontSize: 15,
    fontWeight: "700",
  },
  input: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "#F8FAF7",
    borderWidth: 1,
    borderColor: "#D9E5DA",
    paddingHorizontal: 16,
    color: "#20313B",
    fontSize: 17,
  },
  errorBox: {
    borderRadius: 18,
    backgroundColor: "#FDE5DF",
    borderWidth: 1,
    borderColor: "#EFB1A3",
    padding: 14,
    gap: 6,
  },
  errorTitle: {
    color: "#8D2F21",
    fontWeight: "800",
    fontSize: 16,
  },
  errorText: {
    color: "#9D4333",
    fontSize: 15,
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "#1AD95A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#12311C",
    fontSize: 17,
    fontWeight: "900",
  },
  metaRow: {
    paddingHorizontal: 18,
    paddingTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  metaCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#EAF1E4",
    padding: 14,
    gap: 8,
  },
  metaLabel: {
    color: "#476454",
    fontSize: 12,
    fontWeight: "800",
  },
  metaValue: {
    color: "#1B223A",
    fontSize: 16,
    fontWeight: "700",
  },
});

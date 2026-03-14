import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../api/client";
import { saveAuthToken } from "../api/cache";
import { InputField, PrimaryButton, ScreenShell, SectionCard, colors } from "../components/ui";
import { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

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
      setErrorText(error instanceof Error ? error.message : "Giris basarisiz");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScreenShell>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <Text style={styles.overline}>AGRONOVA MOBILE DEMO</Text>
            <Text style={styles.title}>Bilincli Ciftci Koyu</Text>
            <Text style={styles.subtitle}>
              Tek ekrandan giris yap, koydeki parselleri gor ve hybrid karar akisini dogrula.
            </Text>
          </View>

          <SectionCard style={styles.loginCard}>
            <Text style={styles.cardTitle}>Demo girisi</Text>
            <Text style={styles.cardText}>Backend demo kullanicisi ile direkt akisa gecebilirsin.</Text>

            <InputField label="Kullanici adi" value={username} onChangeText={setUsername} autoCapitalize="none" />
            <InputField label="Sifre" secureTextEntry value={password} onChangeText={setPassword} />

            {!!errorText && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Giris basarisiz</Text>
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            )}

            <PrimaryButton title={loading ? "Giriliyor..." : "Koy ekranina gec"} disabled={loading} onPress={onLogin} />

            <Text style={styles.helper}>Demo akisi icin varsayilan bilgiler otomatik dolu geliyor.</Text>
          </SectionCard>

          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>DEMO HESAP</Text>
              <Text style={styles.metaValue}>demo / demo123</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>AKIS</Text>
              <Text style={styles.metaValue}>Login - Parsel - Karar</Text>
            </View>
          </View>
        </ScrollView>
      </ScreenShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5efe2" },
  scrollContent: { gap: 20 },
  hero: {
    minHeight: 240,
    borderRadius: 28,
    backgroundColor: "#efe7d7",
    justifyContent: "flex-end",
    padding: 22,
    borderWidth: 1,
    borderColor: "#eadfca",
  },
  overline: {
    color: "#76653d",
    letterSpacing: 1.2,
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    marginTop: 10,
    color: "#183023",
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 10,
    color: "#5f6e61",
    fontSize: 16,
    lineHeight: 24,
  },
  loginCard: {
    backgroundColor: "#fffdfa",
    borderColor: "#d9dfcf",
    gap: 14,
  },
  cardTitle: {
    color: "#20362b",
    fontSize: 18,
    fontWeight: "800",
  },
  cardText: {
    color: "#68796f",
    fontSize: 15,
    lineHeight: 22,
  },
  errorBox: {
    borderRadius: 18,
    backgroundColor: "#fde5df",
    borderWidth: 1,
    borderColor: "#efb1a3",
    padding: 14,
    gap: 6,
  },
  errorTitle: {
    color: "#8d2f21",
    fontWeight: "800",
    fontSize: 16,
  },
  errorText: {
    color: "#9d4333",
    fontSize: 15,
  },
  helper: {
    color: "#7d847b",
    fontSize: 13,
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
  },
  metaCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#eaf1e4",
    padding: 14,
    gap: 8,
  },
  metaLabel: {
    color: "#476454",
    fontSize: 12,
    fontWeight: "800",
  },
  metaValue: {
    color: colors.appBg,
    fontSize: 16,
    fontWeight: "700",
  },
});

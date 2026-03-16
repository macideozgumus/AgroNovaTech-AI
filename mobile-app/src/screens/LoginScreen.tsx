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
      setErrorText(error instanceof Error ? error.message : "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.page}>
        <View style={styles.topBar}>
          <View style={styles.iconGhost}>
            <Text style={styles.iconGhostText}>≡</Text>
          </View>
          <Text style={styles.pageTitle}>Köy Haritası</Text>
          <View style={styles.closeGhost}>
            <Text style={styles.closeGhostText}>×</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ImageBackground source={{ uri: aerialHero }} style={styles.heroMap} imageStyle={styles.heroMapImage}>
            <View style={styles.heroOverlay} />
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>⌕</Text>
              <Text style={styles.searchPlaceholder}>Tarla veya komşu ara</Text>
            </View>
          </ImageBackground>

          <View style={styles.loginCard}>
            <Text style={styles.cardEyebrow}>Demo girişi</Text>
            <Text style={styles.cardTitle}>Bilinçli Çiftçi Köyü</Text>
            <Text style={styles.cardText}>Kendi tarlalarına ulaş, köy genelini incele ve hasat planını takip et.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kullanıcı adı</Text>
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
              <Text style={styles.inputLabel}>Şifre</Text>
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
                <Text style={styles.errorTitle}>Giriş başarısız</Text>
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            ) : null}

            <Pressable style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={onLogin} disabled={loading}>
              <Text style={styles.primaryButtonText}>{loading ? "Giriliyor..." : "Kendi tarlama geç"}</Text>
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>DEMO HESAP</Text>
              <Text style={styles.metaValue}>demo / demo123</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>PANEL</Text>
              <Text style={styles.metaValue}>Tarlam - Köy Geneli - Hasat</Text>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
  },
  iconGhost: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  iconGhostText: {
    fontSize: 28,
    color: "#0E1731",
    fontWeight: "700",
  },
  pageTitle: {
    color: "#10162F",
    fontSize: 24,
    fontWeight: "900",
  },
  closeGhost: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#909589",
  },
  closeGhostText: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 30,
  },
  scrollContent: {
    paddingBottom: 28,
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
  searchBar: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    minHeight: 58,
    marginTop: 8,
  },
  searchIcon: {
    color: "#24E75C",
    fontSize: 24,
    marginRight: 12,
  },
  searchPlaceholder: {
    color: "#9DA3AA",
    fontSize: 18,
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

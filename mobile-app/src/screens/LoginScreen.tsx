import React, { useMemo, useState } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiClient } from "../api/client";
import { saveAuthProfile, saveAuthToken } from "../api/cache";
import { RootStackParamList } from "../navigation/AppNavigator";
import { buildVillageOptions, normalizeSearch, turkeyProvinces } from "../utils/turkeyLocations";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const aerialHero =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=80";

export function LoginScreen({ navigation }: Props) {
  const [mode, setMode] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("demo123");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [province, setProvince] = useState("Sakarya");
  const [district, setDistrict] = useState("Serdivan");
  const [village, setVillage] = useState("Serdivan Merkez Köyü");
  const [provinceQuery, setProvinceQuery] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");
  const [villageQuery, setVillageQuery] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const provinceOptions = useMemo(
    () => turkeyProvinces.filter((item) => normalizeSearch(item.name).includes(normalizeSearch(provinceQuery.trim()))),
    [provinceQuery],
  );
  const districtOptions = useMemo(() => {
    const allDistricts = turkeyProvinces.find((item) => item.name === province)?.districts ?? [];
    return allDistricts.filter((item) => normalizeSearch(item.name).includes(normalizeSearch(districtQuery.trim())));
  }, [districtQuery, province]);
  const villageOptions = useMemo(
    () =>
      buildVillageOptions(province, district).filter((item) =>
        normalizeSearch(item).includes(normalizeSearch(villageQuery.trim())),
      ),
    [district, province, villageQuery],
  );

  const onLogin = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const result = await apiClient.login({ username, password });
      await saveAuthToken(result.access_token);
      await saveAuthProfile({
        username: result.username,
        province: result.province,
        district: result.district,
        village: result.village,
      });
      navigation.replace("VillageParcels");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    if (normalizedUsername.length < 3) {
      setErrorText("Kullanıcı adı en az 3 karakter olmalı.");
      return;
    }
    if (password.trim().length < 6) {
      setErrorText("Şifre en az 6 karakter olmalı.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorText("Şifre tekrar alanı eşleşmiyor.");
      return;
    }

    setLoading(true);
    setErrorText(null);
    try {
      const result = await apiClient.register({ username: normalizedUsername, password, province, district, village });
      await saveAuthToken(result.access_token);
      await saveAuthProfile({
        username: result.username,
        province: result.province,
        district: result.district,
        village: result.village,
      });
      navigation.replace("VillageParcels");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Kullanıcı oluşturulamadı");
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
            <Text style={styles.cardEyebrow}>Demo Girişi</Text>
            <Text style={styles.cardTitle}>Bilinçli Çiftçi Köyü</Text>
            <Text style={styles.cardText}>Kendi tarlalarına ulaş, köy genelini incele ve hasat planını takip et.</Text>

            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeButton, mode === "LOGIN" && styles.modeButtonActive]}
                onPress={() => {
                  setMode("LOGIN");
                  setErrorText(null);
                }}
              >
                <Text style={[styles.modeButtonText, mode === "LOGIN" && styles.modeButtonTextActive]}>Giriş Yap</Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, mode === "REGISTER" && styles.modeButtonActive]}
                onPress={() => {
                  setMode("REGISTER");
                  setUsername("");
                  setPassword("");
                  setConfirmPassword("");
                  setProvince("Sakarya");
                  setDistrict("Serdivan");
                  setVillage("Serdivan Merkez Köyü");
                  setProvinceQuery("");
                  setDistrictQuery("");
                  setVillageQuery("");
                  setErrorText(null);
                }}
              >
                <Text style={[styles.modeButtonText, mode === "REGISTER" && styles.modeButtonTextActive]}>Yeni Kullanıcı</Text>
              </Pressable>
            </View>

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

            {mode === "REGISTER" ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Şifre tekrar</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    style={styles.input}
                    placeholder="Şifreyi tekrar yaz"
                    placeholderTextColor="#93A0AA"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>İl</Text>
                  <View style={styles.selectorShell}>
                    <TextInput
                      value={provinceQuery}
                      onChangeText={setProvinceQuery}
                      style={styles.searchInput}
                      placeholder="İl ara..."
                      placeholderTextColor="#8C9888"
                    />
                    <Text style={styles.selectorValue}>Seçili İl: {province}</Text>
                    <ScrollView style={styles.selectorScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                      {provinceOptions.map((item) => (
                        <Pressable
                          key={item.id}
                          style={[styles.selectorOption, province === item.name && styles.selectorOptionActive]}
                          onPress={() => {
                            const nextDistrict = item.districts[0]?.name ?? "";
                            const nextVillage = buildVillageOptions(item.name, nextDistrict)[0] ?? "";
                            setProvince(item.name);
                            setDistrict(nextDistrict);
                            setVillage(nextVillage);
                            setDistrictQuery("");
                            setVillageQuery("");
                          }}
                        >
                          <Text style={[styles.selectorOptionText, province === item.name && styles.selectorOptionTextActive]}>
                            {item.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>İlçe</Text>
                  <View style={styles.selectorShell}>
                    <TextInput
                      value={districtQuery}
                      onChangeText={setDistrictQuery}
                      style={styles.searchInput}
                      placeholder="İlçe ara..."
                      placeholderTextColor="#8C9888"
                    />
                    <Text style={styles.selectorValue}>Seçili İlçe: {district}</Text>
                    <ScrollView style={styles.selectorScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                      {districtOptions.map((item) => (
                        <Pressable
                          key={`${province}-${item.id}`}
                          style={[styles.selectorOption, district === item.name && styles.selectorOptionActive]}
                          onPress={() => {
                            const nextVillage = buildVillageOptions(province, item.name)[0] ?? "";
                            setDistrict(item.name);
                            setVillage(nextVillage);
                            setVillageQuery("");
                          }}
                        >
                          <Text style={[styles.selectorOptionText, district === item.name && styles.selectorOptionTextActive]}>
                            {item.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Köy</Text>
                  <View style={styles.selectorShell}>
                    <TextInput
                      value={villageQuery}
                      onChangeText={setVillageQuery}
                      style={styles.searchInput}
                      placeholder="Köy ara..."
                      placeholderTextColor="#8C9888"
                    />
                    <Text style={styles.selectorValue}>Seçili Köy: {village}</Text>
                    <ScrollView style={styles.selectorScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                      {villageOptions.map((item) => (
                        <Pressable
                          key={`${district}-${item}`}
                          style={[styles.selectorOption, village === item && styles.selectorOptionActive]}
                          onPress={() => setVillage(item)}
                        >
                          <Text style={[styles.selectorOptionText, village === item && styles.selectorOptionTextActive]}>
                            {item}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </>
            ) : null}

            {errorText ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>{mode === "LOGIN" ? "Giriş başarısız" : "Kayıt başarısız"}</Text>
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={mode === "LOGIN" ? onLogin : onRegister}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? (mode === "LOGIN" ? "Giriş yapılıyor..." : "Kullanıcı oluşturuluyor...") : mode === "LOGIN" ? "Giriş Yap" : "Kullanıcı Oluştur"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>DEMO HESAP</Text>
              <Text style={styles.metaValue}>demo / demo123 / Sakarya / Serdivan / Kazımpaşa Köyü</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>{mode === "LOGIN" ? "PANEL" : "ADRES SIRASI"}</Text>
              <Text style={styles.metaValue}>
                {mode === "LOGIN" ? "Tarlam - Köy Geneli - Hasat" : "İl → İlçe → Köy sıralı şekilde seçilir"}
              </Text>
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
    backgroundColor: "#EEF2E7",
  },
  page: {
    flex: 1,
    backgroundColor: "#EEF2E7",
  },
  scrollContent: {
    paddingBottom: 32,
    paddingTop: 14,
  },
  heroMap: {
    minHeight: 360,
    justifyContent: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  heroMapImage: {
    borderRadius: 34,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(22, 34, 52, 0.12)",
    borderRadius: 34,
  },
  loginCard: {
    marginHorizontal: 18,
    marginTop: -42,
    backgroundColor: "#FCFCF9",
    borderRadius: 30,
    padding: 22,
    gap: 16,
  },
  cardEyebrow: {
    color: "#7A6546",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "#162234",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 38,
  },
  cardText: {
    color: "#6B7A67",
    fontSize: 15,
    lineHeight: 22,
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
  },
  modeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: "#F4F5F0",
    borderWidth: 1,
    borderColor: "#DFE4D8",
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonActive: {
    backgroundColor: "#DCEFD8",
    borderColor: "#BED5B3",
  },
  modeButtonText: {
    color: "#5D6B5B",
    fontSize: 14,
    fontWeight: "800",
  },
  modeButtonTextActive: {
    color: "#375436",
  },
  inputGroup: {
    gap: 8,
  },
  selectorShell: {
    borderRadius: 20,
    backgroundColor: "#F4F5F0",
    borderWidth: 1,
    borderColor: "#DFE4D8",
    padding: 12,
    gap: 10,
  },
  searchInput: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE4D8",
    paddingHorizontal: 14,
    color: "#20313B",
    fontSize: 15,
  },
  selectorValue: {
    color: "#375436",
    fontSize: 14,
    fontWeight: "800",
  },
  selectorScroll: {
    maxHeight: 170,
  },
  selectorOption: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectorOptionActive: {
    backgroundColor: "#DCEFD8",
  },
  selectorOptionText: {
    color: "#556461",
    fontSize: 14,
    fontWeight: "700",
  },
  selectorOptionTextActive: {
    color: "#375436",
    fontWeight: "900",
  },
  inputLabel: {
    color: "#233123",
    fontSize: 15,
    fontWeight: "800",
  },
  input: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "#F4F5F0",
    borderWidth: 1,
    borderColor: "#DFE4D8",
    paddingHorizontal: 16,
    color: "#20313B",
    fontSize: 17,
  },
  errorBox: {
    borderRadius: 18,
    backgroundColor: "#FFF0EC",
    borderWidth: 1,
    borderColor: "#F0C2B7",
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
    backgroundColor: "#BFD9B8",
    borderWidth: 1,
    borderColor: "#A8C8A0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#35522E",
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
    backgroundColor: "#FCFCF9",
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E1E7DA",
  },
  metaLabel: {
    color: "#6B7A67",
    fontSize: 12,
    fontWeight: "900",
  },
  metaValue: {
    color: "#162234",
    fontSize: 16,
    fontWeight: "800",
  },
});

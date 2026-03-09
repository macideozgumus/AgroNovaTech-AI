import React, { useState } from "react";
import { Button, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { apiClient } from "../api/client";
import { saveAuthToken } from "../api/cache";
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
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Bilincli Ciftci Koyu</Text>
        <TextInput style={styles.input} placeholder="Kullanici adi" value={username} onChangeText={setUsername} />
        <TextInput style={styles.input} placeholder="Sifre" secureTextEntry value={password} onChangeText={setPassword} />
        {!!errorText && <Text style={styles.error}>{errorText}</Text>}
        <Button title={loading ? "Giriliyor..." : "Giris"} disabled={loading} onPress={onLogin} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#d0d0d0", borderRadius: 8, padding: 10 },
  error: { color: "#b00020" },
});

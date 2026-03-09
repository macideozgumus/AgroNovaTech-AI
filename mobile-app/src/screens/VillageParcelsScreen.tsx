import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { apiClient } from "../api/client";
import { RootStackParamList } from "../navigation/AppNavigator";
import type { ParcelItem } from "../types/api";

type Props = NativeStackScreenProps<RootStackParamList, "VillageParcels">;

export function VillageParcelsScreen({ navigation }: Props) {
  const [parcels, setParcels] = useState<ParcelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadParcels = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getParcels("v1");
        if (mounted) {
          setParcels(data.parcels);
          setErrorText(null);
        }
      } catch (error) {
        if (mounted) {
          setErrorText(error instanceof Error ? error.message : "Parseller yuklenemedi");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadParcels();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Koy Parselleri</Text>
      {loading && <ActivityIndicator />}
      {!!errorText && <Text style={styles.error}>{errorText}</Text>}

      {!loading && !errorText && (
        <FlatList
          data={parcels}
          keyExtractor={(item) => item.parcel_id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.item}
              onPress={() => navigation.navigate("Decision", { parcelId: item.parcel_id, season: "2026_Spring" })}
            >
              <Text style={styles.itemText}>{item.parcel_id.toUpperCase()}</Text>
              <Text style={styles.subText}>Blok: {item.field_block} | Urun: {item.planned_crop}</Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f4f7f4", gap: 8 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  error: { color: "#b00020" },
  item: { backgroundColor: "#fff", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#d9e3d9" },
  itemText: { fontSize: 16, fontWeight: "600" },
  subText: { fontSize: 12, color: "#667" },
});

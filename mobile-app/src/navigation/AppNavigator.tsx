import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { LoginScreen } from "../screens/LoginScreen";
import { VillageParcelsScreen } from "../screens/VillageParcelsScreen";
import { DecisionScreen } from "../screens/DecisionScreen";

export type RootStackParamList = {
  Login: undefined;
  VillageParcels: undefined;
  Decision: { parcelId: string; season: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: "#241712" },
          headerTintColor: "#f7efe5",
          headerShadowVisible: false,
          contentStyle: { backgroundColor: "#241712" },
          headerTitleStyle: { fontWeight: "800" },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Giris" }} />
        <Stack.Screen name="VillageParcels" component={VillageParcelsScreen} options={{ title: "Koy Genel Bakis" }} />
        <Stack.Screen name="Decision" component={DecisionScreen} options={{ title: "Parsel Karari" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

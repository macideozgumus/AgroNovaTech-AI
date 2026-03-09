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
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Login" }} />
        <Stack.Screen
          name="VillageParcels"
          component={VillageParcelsScreen}
          options={{ title: "Koy / Parseller" }}
        />
        <Stack.Screen name="Decision" component={DecisionScreen} options={{ title: "Karar" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

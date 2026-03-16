import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { LoginScreen } from "../screens/LoginScreen";
import { VillageParcelsScreen } from "../screens/VillageParcelsScreen";
import { DecisionScreen } from "../screens/DecisionScreen";
import { ScenarioBuilderScreen } from "../screens/ScenarioBuilderScreen";

export type RootStackParamList = {
  Login: undefined;
  VillageParcels: undefined;
  Decision: { parcelId: string; season: string };
  ScenarioBuilder: { focusParcelId?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#F4F6F2" },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="VillageParcels" component={VillageParcelsScreen} />
        <Stack.Screen name="Decision" component={DecisionScreen} />
        <Stack.Screen name="ScenarioBuilder" component={ScenarioBuilderScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

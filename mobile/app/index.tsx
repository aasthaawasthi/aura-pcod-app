import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { colors } from "../lib/theme";

export default function Index() {
  const { isLoading, isAuthenticated, profile } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (profile && !profile.onboarding_complete) {
      router.replace("/onboarding");
    } else {
      router.replace("/(tabs)/home");
    }
  }, [isLoading, isAuthenticated, profile]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

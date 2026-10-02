import { useLocalSearchParams, router, Stack } from "expo-router";
import { ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, H1, Body, Muted } from "../../components/ui";
import { colors, space } from "../../lib/theme";

// One static-content screen reused for every "read this, no interaction
// needed" page off the side nav (Privacy policy / Help / About Aura),
// keyed by the :slug route param - avoids three near-identical files.
const PAGES: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacy policy",
    body:
      "Aura stores your cycle, habit and check-in data to personalize your diet and exercise suggestions. " +
      "Your data lives on this app's own server and is never sold or shared with third parties.\n\n" +
      "You can delete your account and all associated data at any time by contacting us from the Help page. " +
      "This is placeholder policy text for the development build - replace it with your real policy before " +
      "shipping to the App Store or Play Store.",
  },
  help: {
    title: "Help",
    body:
      "Need a hand with something?\n\n" +
      "• Cycle & check-in questions - open the Cycle or Check-in tab and tap any card for details.\n" +
      "• Account or data issues - reach out at support@aura-app.example and we'll help you sort it out.\n" +
      "• Found a bug? Let us know what you were doing right before it happened - that's the fastest way for us " +
      "to fix it.",
  },
  about: {
    title: "About Aura",
    body:
      "Aura is a PCOD/PCOS companion app that brings together cycle intelligence, daily habit coaching and " +
      "Indian diet personalization in one place, so the everyday work of managing PCOD takes less guesswork.\n\n" +
      "Built for the people living with it, not just the people studying it.\n\nVersion 1.0.0",
  },
};

export default function InfoPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const page = PAGES[String(slug)] || { title: "Aura", body: "Nothing here yet." };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl, gap: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Body style={{ color: colors.primary, fontSize: 14 }}>Back</Body>
        </Pressable>
        <H1 style={{ fontSize: 24 }}>{page.title}</H1>
        <Muted style={{ fontSize: 14, lineHeight: 21 }}>{page.body}</Muted>
      </ScrollView>
    </Screen>
  );
}

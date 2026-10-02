import { useState } from "react";
import { ScrollView, View, Pressable, Switch } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, H1, Body, Muted, Card } from "../../components/ui";
import { colors, space } from "../../lib/theme";

type Toggle = { key: string; label: string; hint: string; default: boolean };

const TOGGLES: Toggle[] = [
  { key: "checkin", label: "Daily check-in nudge", hint: "A reminder if you haven't logged today yet", default: true },
  { key: "period", label: "Period predictions", hint: "When your next period or fertile window is near", default: true },
  { key: "habits", label: "Habit streaks", hint: "Encouragement when a streak is about to break", default: true },
  { key: "tips", label: "Tips & insights", hint: "Occasional diet and cycle insights worth knowing", default: false },
];

// Local-only toggle screen for now - there's no push-notification backend
// wired up yet, so these control what WOULD be sent once that's built.
export default function NotificationsSettings() {
  const [values, setValues] = useState<Record<string, boolean>>(
    Object.fromEntries(TOGGLES.map((t) => [t.key, t.default]))
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl, gap: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Body style={{ color: colors.primary, fontSize: 14 }}>Back</Body>
        </Pressable>
        <H1 style={{ fontSize: 24 }}>Notifications</H1>
        <Muted style={{ fontSize: 13 }}>Choose what Aura can notify you about.</Muted>

        <Card>
          {TOGGLES.map((t, i) => (
            <View key={t.key}>
              <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Body style={{ fontSize: 14 }}>{t.label}</Body>
                  <Muted style={{ fontSize: 11.5, marginTop: 1 }}>{t.hint}</Muted>
                </View>
                <Switch
                  value={values[t.key]}
                  onValueChange={(v) => setValues((prev) => ({ ...prev, [t.key]: v }))}
                  trackColor={{ false: colors.border, true: colors.primarySoft }}
                  thumbColor={values[t.key] ? colors.primary : colors.surface}
                />
              </View>
              {i < TOGGLES.length - 1 && <View style={{ height: 1, backgroundColor: colors.border }} />}
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

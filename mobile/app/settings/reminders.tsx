import { useState } from "react";
import { ScrollView, View, Pressable, Switch } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, H1, Body, Muted, Card } from "../../components/ui";
import { colors, space } from "../../lib/theme";

type Reminder = { key: string; label: string; time: string; default: boolean };

const REMINDERS: Reminder[] = [
  { key: "checkin", label: "Log today's check-in", time: "8:00 PM", default: true },
  { key: "water", label: "Drink water", time: "Every 2 hours, 9 AM - 9 PM", default: false },
  { key: "sleep", label: "Wind down for bed", time: "10:30 PM", default: true },
  { key: "walk", label: "Move / walk break", time: "5:00 PM", default: false },
];

// Local-only for now, same as Notifications - flip these on and the times
// are what Aura would use once reminder scheduling is wired up.
export default function RemindersSettings() {
  const [values, setValues] = useState<Record<string, boolean>>(
    Object.fromEntries(REMINDERS.map((r) => [r.key, r.default]))
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl, gap: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Body style={{ color: colors.primary, fontSize: 14 }}>Back</Body>
        </Pressable>
        <H1 style={{ fontSize: 24 }}>Reminders</H1>
        <Muted style={{ fontSize: 13 }}>Gentle nudges through the day, on your schedule.</Muted>

        <Card>
          {REMINDERS.map((r, i) => (
            <View key={r.key}>
              <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Body style={{ fontSize: 14 }}>{r.label}</Body>
                  <Muted style={{ fontSize: 11.5, marginTop: 1 }}>{r.time}</Muted>
                </View>
                <Switch
                  value={values[r.key]}
                  onValueChange={(v) => setValues((prev) => ({ ...prev, [r.key]: v }))}
                  trackColor={{ false: colors.border, true: colors.primarySoft }}
                  thumbColor={values[r.key] ? colors.primary : colors.surface}
                />
              </View>
              {i < REMINDERS.length - 1 && <View style={{ height: 1, backgroundColor: colors.border }} />}
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

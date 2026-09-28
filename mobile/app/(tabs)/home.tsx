import React, { useCallback, useState } from "react";
import { View, ScrollView, RefreshControl, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { cycleApi, dietApi, habitsApi, dailyLogApi, CycleInfo, Diet, Habit, DailyLog } from "../../lib/api";
import { Screen, H1, H2, Body, Muted, Card } from "../../components/ui";
import { CyclePhaseTimeline } from "../../components/CyclePhaseTimeline";
import { colors, phaseColors, space } from "../../lib/theme";

export default function Home() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cycle, setCycle] = useState<CycleInfo | null>(null);
  const [diet, setDiet] = useState<Diet | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, d, h, log] = await Promise.all([
        cycleApi.get(),
        dietApi.today(),
        habitsApi.list(),
        dailyLogApi.today().catch(() => null),
      ]);
      setCycle(c);
      setDiet(d);
      setHabits(h);
      setTodayLog(log);
    } catch {
      // surfaced inline per-card would be ideal; keep MVP simple
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const doneCount = habits.filter((h) => h.done).length;
  const allHabitsDone = habits.length > 0 && doneCount === habits.length;
  const phaseStyle = cycle?.phase ? phaseColors[cycle.phase] : null;

  if (loading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl, gap: space.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View>
          <Muted>Hey there</Muted>
          <H1>Your dashboard</H1>
          <Muted style={{ marginTop: 2 }}>Tap any card to open that section.</Muted>
        </View>

        {/* Cycle */}
        <SectionCard
          icon="calendar-outline"
          iconColor={colors.primary}
          title="Cycle"
          onPress={() => router.push("/(tabs)/cycle")}
        >
          {cycle?.hasData ? (
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View>
                  <Muted>Day {cycle.cycleDay}</Muted>
                  {phaseStyle && (
                    <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 17, color: phaseStyle.fg, marginTop: 2 }}>
                      {phaseStyle.label}
                    </Body>
                  )}
                </View>
                {cycle.predictedNextPeriod && (
                  <View style={{ alignItems: "flex-end" }}>
                    <Muted>Next period</Muted>
                    <Body style={{ fontFamily: "Manrope_700Bold" }}>{formatDate(cycle.predictedNextPeriod)}</Body>
                  </View>
                )}
              </View>

              <View style={{ marginTop: space.sm }}>
                <CyclePhaseTimeline currentPhase={cycle.phase} />
              </View>

              {cycle.flag && (
                <View style={styles.flagBox}>
                  <Muted>{cycle.flag.message}</Muted>
                </View>
              )}
            </View>
          ) : (
            <View>
              <Body style={{ fontFamily: "Manrope_700Bold", marginBottom: 2 }}>Track your cycle</Body>
              <Muted>{cycle?.message || "Log your period start date to unlock predictions."}</Muted>
            </View>
          )}
        </SectionCard>

        {/* Check-in */}
        <SectionCard
          icon="add-circle-outline"
          iconColor={colors.primary}
          title="Today's check-in"
          onPress={() => router.push("/(tabs)/checkin")}
        >
          {todayLog ? (
            <View>
              <Body style={{ fontFamily: "Manrope_700Bold", marginBottom: 4 }}>
                Logged{todayLog.mood ? ` · feeling ${todayLog.mood}` : ""}
              </Body>
              {todayLog.symptoms?.length > 0 ? (
                <Muted>{todayLog.symptoms.join(", ")}</Muted>
              ) : (
                <Muted>No symptoms noted today.</Muted>
              )}
            </View>
          ) : (
            <Muted>You haven't checked in today - a minute of logging sharpens every prediction.</Muted>
          )}
        </SectionCard>

        {/* Habits */}
        <SectionCard
          icon="checkmark-circle-outline"
          iconColor={colors.gold}
          title="Today's habits"
          badge={habits.length > 0 ? `${doneCount}/${habits.length}` : undefined}
          onPress={() => router.push("/(tabs)/habits")}
        >
          {allHabitsDone && (
            <View style={styles.successBanner}>
              <Ionicons name="sparkles" size={14} color={colors.secondary} />
              <Muted style={{ color: colors.secondary }}>All habits done today!</Muted>
            </View>
          )}
          {habits.slice(0, 4).map((h) => (
            <View key={h.id} style={styles.habitRow}>
              <Ionicons
                name={h.done ? "checkmark-circle" : "ellipse-outline"}
                size={18}
                color={h.done ? colors.secondary : colors.inkMuted}
              />
              <Body style={{ flex: 1 }}>{h.name}</Body>
              {h.streak > 0 && <Muted>{h.streak}d streak</Muted>}
            </View>
          ))}
        </SectionCard>

        {/* Diet */}
        {diet && (
          <SectionCard
            icon="restaurant-outline"
            iconColor={colors.secondary}
            title="Today's plate"
            onPress={() => router.push("/diet-plan")}
          >
            <DietRow label="Breakfast" value={diet.breakfast} />
            <DietRow label="Lunch" value={diet.lunch} />
            <DietRow label="Snack" value={diet.snack} />
            <DietRow label="Dinner" value={diet.dinner} />
          </SectionCard>
        )}

        {profile?.profile_type && profile.profile_type !== "unclassified" && (
          <Muted style={{ textAlign: "center", paddingHorizontal: space.lg }}>
            Your plan is currently tuned for a {profile.profile_type.replace("_", " ")} pattern - this is a
            starting point, not a diagnosis.
          </Muted>
        )}
      </ScrollView>
    </Screen>
  );
}

// A tappable dashboard tile: icon + title (+ optional badge) up top with a
// chevron to signal it opens the full section, whatever summary content
// below. Every section on Home should use this so the whole card - not just
// a small text link - is the tap target.
function SectionCard({
  icon,
  iconColor,
  title,
  badge,
  onPress,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  badge?: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.cardPressed]}>
      <Card>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name={icon} size={18} color={iconColor} />
            <H2>{title}</H2>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {badge && <Muted>{badge}</Muted>}
            <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
          </View>
        </View>
        {children}
      </Card>
    </Pressable>
  );
}

function DietRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: space.sm }}>
      <Muted>{label}</Muted>
      <Body>{value}</Body>
    </View>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  cardPressed: { opacity: 0.85 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.sm,
  },
  flagBox: {
    marginTop: space.sm,
    backgroundColor: colors.noticeSoft,
    padding: space.sm,
    borderRadius: 12,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.secondarySoft,
    padding: space.sm,
    borderRadius: 12,
    marginBottom: space.sm,
  },
  habitRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
});

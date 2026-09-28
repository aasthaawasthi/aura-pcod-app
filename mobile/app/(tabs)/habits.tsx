import { useCallback, useState } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { habitsApi, Habit, HabitCalendar } from "../../lib/api";
import { Screen, H1, Body, Muted, Card, PrimaryButton, ErrorText } from "../../components/ui";
import { MonthStreakRing } from "../../components/MonthStreakRing";
import { colors, space } from "../../lib/theme";
import { todayLocalStr, addDaysToDateStr } from "../../lib/date";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

// "Today", "Yesterday", or a short "Sep 27" - whichever reads most
// naturally for how far back the viewed day is.
function dayLabel(dateStr: string, todayStr: string) {
  if (dateStr === todayStr) return "Today";
  if (dateStr === addDaysToDateStr(todayStr, -1)) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Habits() {
  const real = todayParts();
  const todayStr = todayLocalStr();

  const [viewYear, setViewYear] = useState(real.year);
  const [viewMonth, setViewMonth] = useState(real.month);

  // The date whose checklist is on screen - defaults to today, but the day
  // arrows below let the user look back at past days. Only today's date is
  // ever editable (the backend enforces this too - see habits.controller).
  const [checklistDate, setChecklistDate] = useState(todayStr);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [pendingDone, setPendingDone] = useState<Record<number, boolean>>({});
  const [editable, setEditable] = useState(true);
  const [calendar, setCalendar] = useState<HabitCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (date: string, year: number, month: number) => {
    try {
      const [h, cal] = await Promise.all([habitsApi.forDate(date), habitsApi.calendar(year, month)]);
      setHabits(h.habits);
      setPendingDone(Object.fromEntries(h.habits.map((x) => [x.id, x.done])));
      setEditable(h.editable);
      setCalendar(cal);
    } catch (err: any) {
      setError(err?.message || "Could not load habits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(checklistDate, viewYear, viewMonth);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  const changeMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
    setLoading(true);
    load(checklistDate, y, m);
  };

  const changeDay = (delta: number) => {
    const next = addDaysToDateStr(checklistDate, delta);
    if (next > todayStr) return; // can't look ahead of today
    setChecklistDate(next);
    setLoading(true);
    load(next, viewYear, viewMonth);
  };

  const toggle = (habitId: number) => {
    if (!editable) return;
    setPendingDone((prev) => ({ ...prev, [habitId]: !prev[habitId] }));
  };

  const isDirty = editable && habits.some((h) => pendingDone[h.id] !== h.done);
  const isViewingCurrentMonth = viewYear === real.year && viewMonth === real.month;
  const isToday = checklistDate === todayStr;

  const saveChanges = async () => {
    if (!editable) return;
    setError(null);
    setSaving(true);
    try {
      const logs = habits.map((h) => ({ habitId: h.id, completed: !!pendingDone[h.id] }));
      await habitsApi.saveBatch(checklistDate, logs);
      await load(checklistDate, viewYear, viewMonth);
    } catch (err: any) {
      setError(err?.message || "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.lg, gap: space.xs }}>
        <H1 style={{ fontSize: 24 }}>Habits</H1>

        <View style={styles.monthHeader}>
          <Pressable onPress={() => changeMonth(-1)} hitSlop={12}>
            <Ionicons name="chevron-back" size={18} color={colors.inkMuted} />
          </Pressable>
          <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 13 }}>
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </Body>
          <Pressable onPress={() => changeMonth(1)} hitSlop={12}>
            <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
          </Pressable>
        </View>

        <View style={{ alignItems: "center", marginVertical: space.xs }}>
          {calendar && (
            <MonthStreakRing
              daysInMonth={calendar.daysInMonth}
              completedDays={calendar.completedDays}
              streak={calendar.streak}
              todayDayNumber={isViewingCurrentMonth ? real.day : undefined}
            />
          )}
        </View>

        <View style={styles.dayHeader}>
          <Pressable onPress={() => changeDay(-1)} hitSlop={12}>
            <Ionicons name="chevron-back" size={18} color={colors.inkMuted} />
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 14 }}>
              {dayLabel(checklistDate, todayStr)}
            </Body>
            {!isToday && <Muted style={{ fontSize: 11 }}>{checklistDate}</Muted>}
          </View>
          <Pressable onPress={() => changeDay(1)} hitSlop={12} disabled={isToday}>
            <Ionicons name="chevron-forward" size={18} color={isToday ? colors.border : colors.inkMuted} />
          </Pressable>
        </View>

        {!editable && (
          <View style={styles.readOnlyBanner}>
            <Ionicons name="lock-closed-outline" size={13} color={colors.inkMuted} />
            <Muted style={{ fontSize: 12 }}>Past days are read-only - only today can be edited.</Muted>
          </View>
        )}

        <View style={{ gap: space.xs, marginTop: space.xs }}>
          {habits.map((h) => {
            const done = !!pendingDone[h.id];
            return (
              <Pressable key={h.id} onPress={() => toggle(h.id)} disabled={!editable}>
                <Card style={[styles.row, !editable && styles.rowReadOnly]}>
                  <Ionicons
                    name={done ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={done ? colors.secondary : colors.inkMuted}
                  />
                  <Body style={{ flex: 1, fontFamily: "Manrope_700Bold", fontSize: 14 }}>{h.name}</Body>
                  {h.streak > 0 && (
                    <View style={styles.streakRow}>
                      <Ionicons name="flame" size={11} color={colors.gold} />
                      <Muted style={{ fontSize: 11 }}>{h.streak}</Muted>
                    </View>
                  )}
                </Card>
              </Pressable>
            );
          })}
        </View>

        <ErrorText>{error}</ErrorText>

        {editable && (
          <PrimaryButton
            title={saving ? "Saving..." : isDirty ? "Save changes" : "Saved"}
            onPress={saveChanges}
            loading={saving}
            disabled={!isDirty}
            style={{ marginTop: space.xs }}
          />
        )}

        <Card
          style={{
            backgroundColor: colors.secondarySoft,
            borderColor: colors.secondarySoft,
            padding: space.sm,
          }}
        >
          <Muted style={{ textAlign: "center" }}>
            Complete every habit in a day to fill it in on the ring above.
          </Muted>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.sm,
  },
  rowReadOnly: {
    opacity: 0.7,
  },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    marginTop: space.sm,
  },
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: space.xs,
  },
});

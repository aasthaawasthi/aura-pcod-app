import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { dietApi, DietDay, DietMonth } from "../lib/api";
import { Screen, H1, Body, Muted, Card, ErrorText } from "../components/ui";
import { colors, space } from "../lib/theme";
import { todayLocalStr, addDaysToDateStr } from "../lib/date";

const MEALS: { key: "breakfast" | "lunch" | "snack" | "dinner"; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "breakfast", label: "Breakfast", icon: "sunny-outline" },
  { key: "lunch", label: "Lunch", icon: "restaurant-outline" },
  { key: "snack", label: "Snack", icon: "cafe-outline" },
  { key: "dinner", label: "Dinner", icon: "moon-outline" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDayLabel(dateStr: string, todayStr: string) {
  if (dateStr === todayStr) return "Today";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

// One meal's text plus an "alternative" swap button - the recommendation
// engine's suggestion is never the only option.
function MealRow({
  meal,
  onSwap,
  swapping,
}: {
  meal: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; value: string };
  onSwap: () => void;
  swapping: boolean;
}) {
  return (
    <View style={styles.mealRow}>
      <Ionicons name={meal.icon} size={16} color={colors.secondary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Muted>{meal.label}</Muted>
        <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 14 }}>{meal.value}</Body>
      </View>
      <Pressable onPress={onSwap} disabled={swapping} hitSlop={10} style={styles.swapBtn}>
        {swapping ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="shuffle-outline" size={16} color={colors.primary} />
        )}
      </Pressable>
    </View>
  );
}

export default function DietPlan() {
  const todayStr = todayLocalStr();
  const [view, setView] = useState<"week" | "month">("week");
  const [error, setError] = useState<string | null>(null);

  // --- Week view ---
  const [weekStart, setWeekStart] = useState(todayStr);
  const [weekDays, setWeekDays] = useState<DietDay[] | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null); // "date:meal"

  const loadWeek = useCallback(async (start: string) => {
    try {
      const days = await dietApi.week(start);
      setWeekDays(days);
    } catch (err: any) {
      setError(err?.message || "Could not load this week's plate.");
    }
  }, []);

  useEffect(() => {
    if (view === "week") loadWeek(weekStart);
  }, [view, weekStart, loadWeek]);

  const changeWeek = (deltaWeeks: number) => {
    setWeekDays(null);
    setWeekStart((prev) => addDaysToDateStr(prev, deltaWeeks * 7));
  };

  // --- Month view ---
  const [monthYear, setMonthYear] = useState(new Date().getFullYear());
  const [monthMonth, setMonthMonth] = useState(new Date().getMonth() + 1);
  const [monthData, setMonthData] = useState<DietMonth | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);
  // The date the account was created (YYYY-MM-DD) - there's no plate
  // history before this, so it comes from the server (which knows it)
  // rather than being guessed on the client. Starts null until the first
  // month response arrives; it never changes after that.
  const [joinedDate, setJoinedDate] = useState<string | null>(null);

  const loadMonth = useCallback(async (year: number, month: number) => {
    try {
      const data = await dietApi.month(year, month);
      setMonthData(data);
      if (data.joinedDate) setJoinedDate(data.joinedDate);
    } catch (err: any) {
      setError(err?.message || "Could not load this month's plate.");
    }
  }, []);

  useEffect(() => {
    if (view === "month") loadMonth(monthYear, monthMonth);
  }, [view, monthYear, monthMonth, loadMonth]);

  // Whenever the visible month changes, jump the selection to the most
  // useful date in it rather than leaving whatever was selected before
  // (which usually isn't even in the new month, hence "no data shown"):
  // - this month -> today
  // - a future month -> its 1st, for planning ahead
  // - a past month -> its last day, so you land on the most recent entry
  // Clamped so nothing before the account's join date is ever selected;
  // if the whole month predates the account, nothing is selected at all.
  useEffect(() => {
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const today = new Date();
    const isCurrentMonth = monthYear === today.getFullYear() && monthMonth === today.getMonth() + 1;
    const monthStartStr = `${monthYear}-${pad2(monthMonth)}-01`;
    const lastDay = new Date(monthYear, monthMonth, 0).getDate();
    const monthEndStr = `${monthYear}-${pad2(monthMonth)}-${pad2(lastDay)}`;

    let candidate: string;
    if (isCurrentMonth) candidate = todayStr;
    else if (monthStartStr > todayStr) candidate = monthStartStr;
    else candidate = monthEndStr;

    if (joinedDate && monthEndStr < joinedDate) {
      setSelectedDate(null);
      return;
    }
    if (joinedDate && candidate < joinedDate) candidate = joinedDate;
    setSelectedDate(candidate);
  }, [monthYear, monthMonth, joinedDate, todayStr]);

  const changeMonth = (delta: number) => {
    let m = monthMonth + delta;
    let y = monthYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonthData(null);
    setMonthYear(y);
    setMonthMonth(m);
  };

  const swapMeal = async (date: string, meal: "breakfast" | "lunch" | "snack" | "dinner") => {
    const swapKey = `${date}:${meal}`;
    setSwapping(swapKey);
    try {
      const updated = await dietApi.swap(date, meal);
      if (view === "week") {
        setWeekDays((prev) => prev && prev.map((d) => (d.date === date ? { ...d, ...updated } : d)));
      } else {
        setMonthData((prev) =>
          prev
            ? { ...prev, days: prev.days.map((d) => (d.date === date ? { ...d, ...updated } : d)) }
            : prev
        );
      }
    } catch (err: any) {
      setError(err?.message || "Could not swap this item.");
    } finally {
      setSwapping(null);
    }
  };

  const selectedMonthDay = monthData?.days.find((d) => d.date === selectedDate);

  const daysInMonth = monthData?.daysInMonth || new Date(monthYear, monthMonth, 0).getDate();
  const firstWeekday = new Date(monthYear, monthMonth - 1, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl, gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <H1 style={{ fontSize: 22 }}>Your plate</H1>
        </View>
        <Muted>Plan your meals ahead so you know what to buy for the week - swap anything you don't like.</Muted>

        <View style={styles.viewToggle}>
          <Pressable
            onPress={() => setView("week")}
            style={[styles.viewToggleBtn, view === "week" && styles.viewToggleBtnActive]}
          >
            <Body style={[styles.viewToggleText, view === "week" && styles.viewToggleTextActive]}>Week</Body>
          </Pressable>
          <Pressable
            onPress={() => setView("month")}
            style={[styles.viewToggleBtn, view === "month" && styles.viewToggleBtnActive]}
          >
            <Body style={[styles.viewToggleText, view === "month" && styles.viewToggleTextActive]}>Month</Body>
          </Pressable>
        </View>

        <ErrorText>{error}</ErrorText>

        {view === "week" && (
          <View style={{ gap: space.sm }}>
            <View style={styles.weekHeader}>
              <Pressable onPress={() => changeWeek(-1)} hitSlop={12}>
                <Ionicons name="chevron-back" size={18} color={colors.inkMuted} />
              </Pressable>
              <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 13 }}>
                {formatDayLabel(weekStart, todayStr)} - {formatDayLabel(addDaysToDateStr(weekStart, 6), todayStr)}
              </Body>
              <Pressable onPress={() => changeWeek(1)} hitSlop={12}>
                <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
              </Pressable>
            </View>

            {!weekDays ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: space.lg }} />
            ) : (
              weekDays.map((day) => (
                <Card key={day.date}>
                  <Body style={{ fontFamily: "Manrope_700Bold", marginBottom: space.xs }}>
                    {formatDayLabel(day.date, todayStr)}
                  </Body>
                  <View style={{ gap: space.xs }}>
                    {MEALS.map((m) => (
                      <MealRow
                        key={m.key}
                        meal={{ ...m, value: (day as any)[m.key] }}
                        onSwap={() => swapMeal(day.date, m.key)}
                        swapping={swapping === `${day.date}:${m.key}`}
                      />
                    ))}
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {view === "month" && (
          <View style={{ gap: space.sm }}>
            <Card>
              <View style={styles.weekHeader}>
                <Pressable onPress={() => changeMonth(-1)} hitSlop={12}>
                  <Ionicons name="chevron-back" size={18} color={colors.inkMuted} />
                </Pressable>
                <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 13 }}>
                  {MONTH_NAMES[monthMonth - 1]} {monthYear}
                </Body>
                <Pressable onPress={() => changeMonth(1)} hitSlop={12}>
                  <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
                </Pressable>
              </View>

              {!monthData ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: space.lg }} />
              ) : (
                <View>
                  {weeks.map((week, wi) => (
                    <View key={wi} style={{ flexDirection: "row" }}>
                      {week.map((day, di) => {
                        if (day === null) return <View key={di} style={styles.monthCell} />;
                        const dateKey = `${monthYear}-${pad(monthMonth)}-${pad(day)}`;
                        const isToday = dateKey === todayStr;
                        const isSelected = dateKey === selectedDate;
                        // No plate history exists from before the account
                        // was created - mirrors how future dates are
                        // already kept un-clickable on the check-in page.
                        const isBeforeJoin = !!joinedDate && dateKey < joinedDate;
                        return (
                          <Pressable
                            key={di}
                            style={styles.monthCell}
                            disabled={isBeforeJoin}
                            onPress={() => setSelectedDate(dateKey)}
                          >
                            <View
                              style={[
                                styles.monthDayBadge,
                                isToday && styles.monthDayBadgeToday,
                                isSelected && styles.monthDayBadgeSelected,
                              ]}
                            >
                              <Body style={{ fontSize: 12, opacity: isBeforeJoin ? 0.3 : 1 }}>{day}</Body>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {monthData && selectedMonthDay && selectedMonthDay.breakfast && (
              <Card>
                <Body style={{ fontFamily: "Manrope_700Bold", marginBottom: space.xs }}>
                  {formatDayLabel(selectedMonthDay.date, todayStr)}
                </Body>
                <View style={{ gap: space.xs }}>
                  {MEALS.map((m) => (
                    <MealRow
                      key={m.key}
                      meal={{ ...m, value: (selectedMonthDay as any)[m.key] }}
                      onSwap={() => swapMeal(selectedMonthDay.date, m.key)}
                      swapping={swapping === `${selectedMonthDay.date}:${m.key}`}
                    />
                  ))}
                </View>
              </Card>
            )}

            {monthData && (!selectedDate || !selectedMonthDay?.breakfast) && (
              <Card>
                <Muted>
                  {joinedDate
                    ? `No plate history here - your history starts from ${formatDayLabel(joinedDate, todayStr)}.`
                    : "No check-ins yet for this month."}
                </Muted>
              </Card>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSunken,
    borderRadius: 999,
    padding: 4,
  },
  viewToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  viewToggleBtnActive: {
    backgroundColor: colors.surface,
  },
  viewToggleText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
    color: colors.inkMuted,
  },
  viewToggleTextActive: {
    color: colors.primary,
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginBottom: space.xs,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
  },
  swapBtn: {
    padding: 4,
  },
  monthCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthDayBadge: {
    width: "78%",
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  monthDayBadgeToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  monthDayBadgeSelected: {
    backgroundColor: colors.surfaceSunken,
  },
});

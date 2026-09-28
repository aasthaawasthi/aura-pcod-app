import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, type, space } from "../lib/theme";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

type Props = {
  year: number;
  month: number; // 1-12
  markedDates: Set<string>;
  todayKey: string;
  onToggleDate: (date: string) => void;
  onChangeMonth: (delta: number) => void;
};

export function PeriodCalendar({ year, month, markedDates, todayKey, onToggleDate, onChangeMonth }: Props) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={() => onChangeMonth(-1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={18} color={colors.inkMuted} />
        </Pressable>
        <Text style={styles.headerLabel}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <Pressable onPress={() => onChangeMonth(1)} hitSlop={12}>
          <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((w, i) => (
          <Text key={i} style={styles.weekdayLabel}>
            {w}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (day === null) return <View key={di} style={styles.cell} />;
            const key = dateKey(year, month, day);
            const isMarked = markedDates.has(key);
            const isToday = key === todayKey;
            const isFuture = key > todayKey;
            return (
              <View key={di} style={styles.cell}>
                <Pressable
                  onPress={() => !isFuture && onToggleDate(key)}
                  disabled={isFuture}
                  style={[
                    styles.dayBadge,
                    isMarked && styles.dayBadgeMarked,
                    isToday && !isMarked && styles.dayBadgeToday,
                    isFuture && styles.dayBadgeFuture,
                  ]}
                >
                  <Text style={[styles.dayText, isMarked && styles.dayTextMarked, isFuture && styles.dayTextFuture]}>
                    {day}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginBottom: space.sm,
  },
  headerLabel: {
    fontFamily: type.bodySemi,
    fontSize: 14,
    color: colors.ink,
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: type.bodyRegular,
    fontSize: 11,
    color: colors.inkMuted,
  },
  weekRow: {
    flexDirection: "row",
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBadge: {
    width: "78%",
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBadgeMarked: {
    backgroundColor: colors.primary,
  },
  dayBadgeToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayText: {
    fontFamily: type.body,
    fontSize: 13,
    color: colors.ink,
  },
  dayTextMarked: {
    color: colors.white,
    fontFamily: type.bodySemi,
  },
  dayBadgeFuture: {
    opacity: 0.3,
  },
  dayTextFuture: {
    color: colors.inkMuted,
  },
});

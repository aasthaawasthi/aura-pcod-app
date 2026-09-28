import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, type, space, periodColorScale, periodFlowSizes } from "../lib/theme";
import { PeriodDay } from "../lib/api";

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
  days: PeriodDay[];
  todayKey: string;
  onChangeMonth: (delta: number) => void;
  selectedKey?: string;
  onSelectDate?: (date: string) => void;
};

// Read-only monthly summary: marks logged period days with a dot whose
// SIZE encodes flow (light/medium/heavy) and whose COLOR is the shade the
// user actually logged for that day (dark brown .. bright red).
export function PeriodSummaryCalendar({ year, month, days, todayKey, onChangeMonth, selectedKey, onSelectDate }: Props) {
  const dayMap = new Map(days.map((d) => [d.log_date, d]));

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={{ alignSelf: "stretch" }}>
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
            const logged = dayMap.get(key);
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            const dotSize = logged ? periodFlowSizes[logged.flow] : 0;
            const dotColor = logged ? periodColorScale[logged.color] : undefined;

            return (
              <Pressable key={di} style={styles.cell} onPress={() => onSelectDate?.(key)} disabled={!onSelectDate}>
                <View
                  style={[
                    styles.dayBadge,
                    isToday && styles.dayBadgeToday,
                    isSelected && styles.dayBadgeSelected,
                  ]}
                >
                  {logged ? (
                    <View style={[styles.periodDot, { width: dotSize, height: dotSize, borderRadius: dotSize, backgroundColor: dotColor }]}>
                      <Text style={styles.periodDotText}>{day}</Text>
                    </View>
                  ) : (
                    <Text style={styles.dayText}>{day}</Text>
                  )}
                </View>
              </Pressable>
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
    width: "82%",
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBadgeToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayBadgeSelected: {
    backgroundColor: colors.surfaceSunken,
  },
  dayText: {
    fontFamily: type.body,
    fontSize: 12,
    color: colors.ink,
  },
  periodDot: {
    minWidth: 14,
    minHeight: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  periodDotText: {
    fontFamily: type.bodySemi,
    fontSize: 9.5,
    color: colors.white,
  },
});

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, type } from "../lib/theme";

type Props = {
  daysInMonth: number;
  completedDays: number[]; // day-of-month numbers, e.g. [1, 2, 5, 9]
  streak: number;
  todayDayNumber?: number; // only set when viewing the actual current month
  size?: number;
};

// Arranges day-of-month numbers around a circle (like a clock face), with
// the current streak shown in the center. Day 1 sits at 12 o'clock and days
// proceed clockwise. Pure View + trigonometry - no SVG dependency needed.
export function MonthStreakRing({
  daysInMonth,
  completedDays,
  streak,
  todayDayNumber,
  size = 300,
}: Props) {
  const completedSet = new Set(completedDays);
  const badgeSize = daysInMonth > 28 ? 25 : 26;
  const center = size / 2;
  const radius = center - badgeSize / 2 - 4;

  const badges = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const angleDeg = ((day - 1) / daysInMonth) * 360 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = center + radius * Math.cos(angleRad) - badgeSize / 2;
    const y = center + radius * Math.sin(angleRad) - badgeSize / 2;

    const isDone = completedSet.has(day);
    const isToday = day === todayDayNumber;
    const isFuture = todayDayNumber !== undefined && day > todayDayNumber;

    badges.push(
      <View
        key={day}
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            left: x,
            top: y,
          },
          isDone && styles.badgeDone,
          isToday && styles.badgeToday,
          isFuture && !isDone && styles.badgeFuture,
        ]}
      >
        {isDone ? (
          <Ionicons name="checkmark" size={badgeSize * 0.6} color={colors.white} />
        ) : (
          <Text
            style={[
              styles.badgeText,
              isFuture ? styles.badgeTextFuture : styles.badgeTextOpen,
              isToday && styles.badgeTextToday,
            ]}
          >
            {day}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.track,
          {
            width: size - badgeSize,
            height: size - badgeSize,
            borderRadius: (size - badgeSize) / 2,
            left: badgeSize / 2,
            top: badgeSize / 2,
          },
        ]}
      />
      {badges}
      <View style={styles.centerWrap} pointerEvents="none">
        <Ionicons name="flame" size={24} color={colors.gold} />
        <Text style={styles.streakNumber}>{streak}</Text>
        <Text style={styles.streakLabel}>{streak === 1 ? "day streak" : "day streak"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeDone: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  badgeToday: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  badgeFuture: {
    backgroundColor: "transparent",
    borderColor: colors.border,
    opacity: 0.5,
  },
  badgeText: {
    fontFamily: type.bodySemi,
    fontSize: 12,
  },
  badgeTextOpen: {
    color: colors.ink,
  },
  badgeTextFuture: {
    color: colors.inkMuted,
  },
  badgeTextToday: {
    color: colors.primary,
  },
  centerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  streakNumber: {
    fontFamily: type.display,
    fontSize: 42,
    color: colors.ink,
    marginTop: 1,
  },
  streakLabel: {
    fontFamily: type.bodyRegular,
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: -2,
  },
});

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CYCLE_PHASES, phaseColors, colors, type, space } from "../lib/theme";

type Props = {
  currentPhase?: string;
};

// A single horizontal bar split into the 4 cycle phases (sized roughly to
// how much of a typical cycle each one takes up), so a user can see at a
// glance both where they are now and how many phases exist in total.
export function CyclePhaseTimeline({ currentPhase }: Props) {
  return (
    <View>
      <View style={styles.bar}>
        {CYCLE_PHASES.map((phase) => {
          const p = phaseColors[phase];
          const isCurrent = phase === currentPhase;
          return (
            <View
              key={phase}
              style={[
                styles.segment,
                { flex: p.fraction, backgroundColor: isCurrent ? p.fg : p.bg },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.labelRow}>
        {CYCLE_PHASES.map((phase) => {
          const p = phaseColors[phase];
          const isCurrent = phase === currentPhase;
          return (
            <View key={phase} style={[styles.labelWrap, { flex: p.fraction }]}>
              <Text
                style={[styles.label, isCurrent && { color: p.fg, fontFamily: type.bodySemi }]}
                numberOfLines={1}
              >
                {p.shortLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  segment: {
    height: "100%",
  },
  labelRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  labelWrap: {
    alignItems: "center",
  },
  label: {
    fontFamily: type.bodyRegular,
    fontSize: 10,
    color: colors.inkMuted,
    textAlign: "center",
  },
});

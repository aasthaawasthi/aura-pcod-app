import { useEffect, useState } from "react";
import { View, ScrollView, Image, Pressable, Linking, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { exerciseApi, Exercise, ApiError } from "../../lib/api";
import { Screen, H1, Body, Muted, PrimaryButton, ErrorText } from "../../components/ui";
import { colors, space, radius } from "../../lib/theme";

const GOAL_LABELS: Record<string, string> = {
  regular_cycle: "Regularize periods",
  sleep_cycle: "Regularize sleep",
  weight_loss: "Manage weight",
  facial_hair: "Facial hair",
  hairfall: "Hairfall control",
  skin_balance: "Balance skin",
  mood_mental_health: "Mood & mental health",
  insulin_balance: "Balance insulin",
  fertility: "Fertility",
  thyroid: "Thyroid",
};

// The suggestions list on Home already has the full exercise object, so
// it's passed straight through as a `data` param - no extra round trip.
// A direct/shared link without that param (or a stale one from an old
// app version) falls back to fetching today's suggestions and finding it
// there, which covers the common case without needing a public lookup
// endpoint for every possible id.
export default function ExerciseDetail() {
  const { id, data } = useLocalSearchParams<{ id: string; data?: string }>();
  const [exercise, setExercise] = useState<Exercise | null>(() => {
    if (!data) return null;
    try {
      return JSON.parse(data) as Exercise;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!exercise);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exercise) return;
    (async () => {
      try {
        const todays = await exerciseApi.today();
        const found = todays.find((e) => e.id === id) || null;
        setExercise(found);
        if (!found) setError("Couldn't find that exercise.");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load this exercise.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const watchOnYoutube = () => {
    if (exercise) Linking.openURL(exercise.watchUrl);
  };

  if (loading) {
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!exercise) {
    return (
      <Screen style={{ padding: space.lg }}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <ErrorText>{error || "Exercise not found."}</ErrorText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xl }}>
        <Pressable onPress={() => watchOnYoutube()} style={styles.thumbWrap}>
          <Image source={{ uri: exercise.thumbnailUrl }} style={styles.thumb} />
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={26} color={colors.white} style={{ marginLeft: 3 }} />
            </View>
          </View>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.white} />
        </Pressable>

        <View style={{ padding: space.lg, gap: space.sm }}>
          <H1 style={{ fontSize: 22 }}>{exercise.name}</H1>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={13} color={colors.primary} />
              <Muted style={{ fontSize: 12.5 }}>{exercise.durationLabel}</Muted>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="bar-chart-outline" size={13} color={colors.primary} />
              <Muted style={{ fontSize: 12.5 }}>{exercise.level}</Muted>
            </View>
          </View>

          <Body style={{ marginTop: space.xs }}>{exercise.description}</Body>

          {exercise.goals?.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.xs }}>
              {exercise.goals.map((g) => (
                <View key={g} style={styles.goalTag}>
                  <Muted style={{ fontSize: 11 }}>{GOAL_LABELS[g] || g}</Muted>
                </View>
              ))}
            </View>
          )}

          <PrimaryButton
            title="Watch on YouTube"
            onPress={watchOnYoutube}
            style={{ marginTop: space.md }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  thumbWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceSunken,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    position: "absolute",
    top: space.xl,
    left: space.md,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  goalTag: {
    backgroundColor: colors.surfaceSunken,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
  },
});

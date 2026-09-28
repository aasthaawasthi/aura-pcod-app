import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { dailyLogApi, ApiError } from "../../lib/api";
import { Screen, H1, H2, Muted, Chip, Input, PrimaryButton, ErrorText } from "../../components/ui";
import { colors, space } from "../../lib/theme";

const MOODS = [
  { key: "great", label: "Great" },
  { key: "okay", label: "Okay" },
  { key: "low", label: "Low" },
  { key: "irritable", label: "Irritable" },
  { key: "anxious", label: "Anxious" },
];

const ENERGY_LEVELS = [1, 2, 3, 4, 5];

const SYMPTOMS = [
  "fatigue",
  "cravings",
  "acne",
  "bloating",
  "cramps",
  "headache",
  "hair fall",
  "mood swings",
];

export default function CheckIn() {
  const [mood, setMood] = useState<string | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    try {
      const today = await dailyLogApi.today();
      if (today) {
        setMood(today.mood);
        setEnergy(today.energy);
        setSymptoms(today.symptoms || []);
        setNote(today.note || "");
        setSaved(true);
      }
    } catch {
      // fine to start blank
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadToday();
    }, [loadToday])
  );

  const toggleSymptom = (s: string) => {
    setSaved(false);
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const onSave = async () => {
    setError(null);
    setLoading(true);
    try {
      await dailyLogApi.save({ mood: mood || undefined, energy: energy || undefined, symptoms, note });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your check-in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl, gap: space.lg }}>
        <View>
          <H1>How are you today?</H1>
          <Muted>A minute of logging sharpens every prediction and diet swap.</Muted>
        </View>

        <View>
          <H2 style={{ marginBottom: space.sm }}>Mood</H2>
          <View style={styles.wrap}>
            {MOODS.map((m) => (
              <Chip
                key={m.key}
                label={m.label}
                selected={mood === m.key}
                onPress={() => {
                  setSaved(false);
                  setMood(m.key);
                }}
              />
            ))}
          </View>
        </View>

        <View>
          <H2 style={{ marginBottom: space.sm }}>Energy</H2>
          <View style={styles.wrap}>
            {ENERGY_LEVELS.map((lvl) => (
              <Chip
                key={lvl}
                label={String(lvl)}
                selected={energy === lvl}
                onPress={() => {
                  setSaved(false);
                  setEnergy(lvl);
                }}
              />
            ))}
          </View>
        </View>

        <View>
          <H2 style={{ marginBottom: space.sm }}>Symptoms</H2>
          <View style={styles.wrap}>
            {SYMPTOMS.map((s) => (
              <Chip key={s} label={s} selected={symptoms.includes(s)} onPress={() => toggleSymptom(s)} />
            ))}
          </View>
        </View>

        <View>
          <H2 style={{ marginBottom: space.sm }}>Anything else?</H2>
          <Input
            placeholder="Optional note"
            value={note}
            onChangeText={(t) => {
              setSaved(false);
              setNote(t);
            }}
            multiline
            style={{ minHeight: 80, textAlignVertical: "top" }}
          />
        </View>

        <ErrorText>{error}</ErrorText>

        <PrimaryButton title={saved ? "Saved for today ✓" : "Save check-in"} onPress={onSave} loading={loading} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});

import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { profileApi, ApiError } from "../../lib/api";
import { Screen, H1, H2, Body, Muted, Input, PrimaryButton, SecondaryButton, Chip, ErrorText } from "../../components/ui";
import { colors, space } from "../../lib/theme";

type PhenotypeAnswers = {
  weightGainAroundBelly: boolean;
  sugarCravings: boolean;
  darkSkinPatches: boolean;
  familyDiabetesHistory: boolean;
  highStressLevels: boolean;
  wiredButTired: boolean;
  thinBuildWithSymptoms: boolean;
  acneOrInflammation: boolean;
  digestiveIssues: boolean;
  jointOrBodyPain: boolean;
  recentlyStoppedBirthControl: boolean;
};

const QUIZ_QUESTIONS: { key: keyof PhenotypeAnswers; label: string }[] = [
  { key: "weightGainAroundBelly", label: "Weight tends to gain around your belly" },
  { key: "sugarCravings", label: "Frequent sugar or carb cravings" },
  { key: "darkSkinPatches", label: "Dark, velvety skin patches (neck, underarms)" },
  { key: "familyDiabetesHistory", label: "Family history of diabetes" },
  { key: "highStressLevels", label: "You'd describe your day-to-day as high stress" },
  { key: "wiredButTired", label: "Often feel 'wired but tired'" },
  { key: "acneOrInflammation", label: "Persistent acne or skin inflammation" },
  { key: "digestiveIssues", label: "Frequent bloating or digestive issues" },
  { key: "jointOrBodyPain", label: "Unexplained joint or body pain" },
  { key: "recentlyStoppedBirthControl", label: "Stopped hormonal birth control in the last year" },
];

const GOALS = [
  { key: "regular_cycle", label: "Regularize periods cycle" },
  { key: "sleep_cycle", label: "Regularize sleep cycle" },
  { key: "weight_loss", label: "Manage weight" },
  { key: "facial_hair", label: "Manage facial hair" },
  { key: "hairfall", label: "Hairfall control" },
  { key: "skin_balance", label: "Balance skin" },
  { key: "mood_mental_health", label: "Mood & mental health" },
  { key: "insulin_balance", label: "Balance insulin" },
  { key: "fertility", label: "Increase fertility" },
  { key: "thyroid", label: "Thyroid imbalance" },
];

const REGIONS = [
  { key: "north", label: "North Indian" },
  { key: "south", label: "South Indian" },
  { key: "east", label: "East Indian" },
  { key: "west", label: "West Indian" },
];

export default function Onboarding() {
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [hasPcod, setHasPcod] = useState<boolean | null>(null);

  const [goals, setGoals] = useState<string[]>([]);
  const [foodPreference, setFoodPreference] = useState<"veg" | "non_veg" | null>(null);
  const [regions, setRegions] = useState<string[]>([]);

  const [answers, setAnswers] = useState<Partial<PhenotypeAnswers>>({});

  const totalSteps = 4;

  const toggleAnswer = (key: keyof PhenotypeAnswers) =>
    setAnswers((prev) => ({ ...prev, [key]: !prev[key] }));

  const canContinue = () => {
    if (step === 0) return age && heightCm && weightKg && hasPcod !== null;
    if (step === 1) return goals.length > 0;
    if (step === 2) return !!foodPreference && regions.length > 0;
    return true;
  };

  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const back = () => (step === 0 ? router.back() : setStep((s) => s - 1));

  const finish = async () => {
    setError(null);
    setLoading(true);
    try {
      await profileApi.save({
        age: Number(age),
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        has_pcod: hasPcod,
        goals,
        food_preference: foodPreference,
        regions,
        phenotype_answers: answers,
        onboarding_complete: true,
      });
      await refreshProfile();
      router.replace("/(tabs)/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl, flexGrow: 1 }}>
        <View style={styles.dots}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>

        {step === 0 && (
          <View>
            <H1 style={{ marginBottom: space.xs }}>The basics</H1>
            <Muted style={{ marginBottom: space.lg }}>
              This helps size portions and pick relevant nudges — nothing here is shared anywhere.
            </Muted>
            <View style={{ gap: space.sm }}>
              <Input placeholder="Age" keyboardType="number-pad" value={age} onChangeText={setAge} />
              <Input placeholder="Height (cm)" keyboardType="number-pad" value={heightCm} onChangeText={setHeightCm} />
              <Input placeholder="Weight (kg)" keyboardType="number-pad" value={weightKg} onChangeText={setWeightKg} />
            </View>
            <H2 style={{ marginTop: space.lg, marginBottom: space.sm }}>Have you been diagnosed with PCOD/PCOS?</H2>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Chip label="Yes" selected={hasPcod === true} onPress={() => setHasPcod(true)} />
              <Chip label="Not diagnosed, but suspect it" selected={hasPcod === false} onPress={() => setHasPcod(false)} />
            </View>
          </View>
        )}

        {step === 1 && (
          <View>
            <H1 style={{ marginBottom: space.xs }}>What matters most right now?</H1>
            <Muted style={{ marginBottom: space.lg }}>Pick as many as apply - you can change these anytime from your profile.</Muted>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {GOALS.map((g) => (
                <Chip
                  key={g.key}
                  label={g.label}
                  selected={goals.includes(g.key)}
                  onPress={() => setGoals((prev) => (prev.includes(g.key) ? prev.filter((k) => k !== g.key) : [...prev, g.key]))}
                />
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View>
            <H1 style={{ marginBottom: space.xs }}>Your food</H1>
            <Muted style={{ marginBottom: space.lg }}>So your diet plan actually looks like food you'd eat.</Muted>
            <H2 style={{ marginBottom: space.sm }}>Preference</H2>
            <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.lg }}>
              <Chip label="Vegetarian" selected={foodPreference === "veg"} onPress={() => setFoodPreference("veg")} />
              <Chip label="Non-vegetarian" selected={foodPreference === "non_veg"} onPress={() => setFoodPreference("non_veg")} />
            </View>
            <H2 style={{ marginBottom: space.sm }}>Regional cuisine</H2>
            <Muted style={{ marginBottom: space.sm }}>Pick all you enjoy.</Muted>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {REGIONS.map((r) => (
                <Chip
                  key={r.key}
                  label={r.label}
                  selected={regions.includes(r.key)}
                  onPress={() => setRegions((prev) => (prev.includes(r.key) ? prev.filter((k) => k !== r.key) : [...prev, r.key]))}
                />
              ))}
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <H1 style={{ marginBottom: space.xs }}>Quick pattern check</H1>
            <Muted style={{ marginBottom: space.lg }}>
              Tap anything that's been true for you lately. This is a starting point, not a diagnosis —
              we'll refine it as you log more.
            </Muted>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {QUIZ_QUESTIONS.map((q) => (
                <Chip
                  key={q.key}
                  label={q.label}
                  selected={!!answers[q.key]}
                  onPress={() => toggleAnswer(q.key)}
                />
              ))}
            </View>
          </View>
        )}

        <ErrorText>{error}</ErrorText>

        <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xl }}>
          <SecondaryButton title="Back" onPress={back} style={{ flex: 1 }} />
          {step < totalSteps - 1 ? (
            <PrimaryButton title="Continue" onPress={next} disabled={!canContinue()} style={{ flex: 1 }} />
          ) : (
            <PrimaryButton title="Finish setup" onPress={finish} loading={loading} style={{ flex: 1 }} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", gap: 6, marginBottom: space.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 20 },
});

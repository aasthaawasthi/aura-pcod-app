import { useEffect, useRef, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert, Image, Pressable, Modal, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../lib/auth-context";
import { profileApi, ApiError } from "../../lib/api";
import { Screen, H1, Body, Muted, Card, Chip, Input, PrimaryButton, ErrorText } from "../../components/ui";
import { colors, space, radius } from "../../lib/theme";

const GOALS = [
  { key: "regular_cycle", label: "Regularize periods" },
  { key: "sleep_cycle", label: "Regularize sleep" },
  { key: "weight_loss", label: "Manage weight" },
  { key: "facial_hair", label: "Facial hair" },
  { key: "hairfall", label: "Hairfall control" },
  { key: "skin_balance", label: "Balance skin" },
  { key: "mood_mental_health", label: "Mood & mental health" },
  { key: "insulin_balance", label: "Balance insulin" },
  { key: "fertility", label: "Fertility" },
  { key: "thyroid", label: "Thyroid" },
];

const REGIONS = [
  { key: "north", label: "North Indian" },
  { key: "south", label: "South Indian" },
  { key: "east", label: "East Indian" },
  { key: "west", label: "West Indian" },
];

const GENDERS = ["Female", "Male", "Other", "Prefer not to say"];

function toggleInList(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

function initials(name: string, email: string) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function formatPhenotype(type: string) {
  if (type === "unclassified") return "Not yet classified";
  return type.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

// Height is stored/saved as height_cm (matches the backend column and
// what the diet/habit logic expects), but people think in feet & inches,
// so we convert for display and back again on save.
function cmToFeetInches(cm: number) {
  const totalInches = cm / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

function feetInchesToCm(feet: number, inches: number) {
  return Math.round(((feet || 0) * 12 + (inches || 0)) * 2.54 * 10) / 10;
}

// A single tappable-to-edit row: label on the left, a borderless right-
// aligned input on the right. This is the compact "iOS settings row"
// pattern - it fits far more fields per screen than a stacked label +
// boxed input does, without hiding that the field is editable.
function FieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  suffix,
  last,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad" | "decimal-pad";
  suffix?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.fieldRow, !last && styles.fieldRowDivider]}>
      <Muted style={styles.fieldLabel}>{label}</Muted>
      <View style={styles.fieldValueWrap}>
        <Input
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
          style={[styles.rowInput, suffix ? styles.rowInputWithSuffix : null]}
        />
        {!!suffix && <Muted style={styles.unitText}>{suffix}</Muted>}
      </View>
    </View>
  );
}

// Height gets its own row - two small ft/in inputs instead of one field,
// since that's how people actually think about and enter their height.
function HeightRow({
  feet,
  onFeetChange,
  inches,
  onInchesChange,
}: {
  feet: string;
  onFeetChange: (v: string) => void;
  inches: string;
  onInchesChange: (v: string) => void;
}) {
  return (
    <View style={[styles.fieldRow, styles.fieldRowDivider]}>
      <Muted style={styles.fieldLabel}>Height</Muted>
      <View style={styles.fieldValueWrap}>
        <Input
          value={feet}
          onChangeText={onFeetChange}
          placeholder="5"
          keyboardType="number-pad"
          style={[styles.rowInput, styles.heightInput]}
        />
        <Muted style={styles.unitText}>ft</Muted>
        <Input
          value={inches}
          onChangeText={onInchesChange}
          placeholder="6"
          keyboardType="number-pad"
          style={[styles.rowInput, styles.heightInput, { marginLeft: space.sm }]}
        />
        <Muted style={styles.unitText}>in</Muted>
      </View>
    </View>
  );
}

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(!profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"about" | "goals">("about");
  const [photoSaving, setPhotoSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);

  const [goals, setGoals] = useState<string[]>([]);
  const [foodPreference, setFoodPreference] = useState("veg");
  const [regions, setRegions] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) {
      refreshProfile().finally(() => setLoading(false));
    }
  }, []);

  // Populate the form from the server's profile ONLY the first time it
  // becomes available. Refreshing `profile` later (e.g. the photo picker's
  // own save-then-refresh) must NOT re-run this - otherwise it silently
  // overwrites whatever the user is mid-typing in other fields (like their
  // name) with the older server value, and the next "Save changes" then
  // re-saves that stale data right back.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (profile && !hydratedRef.current) {
      hydratedRef.current = true;
      setName(profile.name || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
      setProfilePicture(profile.profile_picture || "");
      setAge(profile.age != null ? String(profile.age) : "");
      setGender(profile.gender || "");
      if (profile.height_cm != null) {
        const { feet, inches } = cmToFeetInches(profile.height_cm);
        setHeightFt(String(feet));
        setHeightIn(String(inches));
      } else {
        setHeightFt("");
        setHeightIn("");
      }
      setWeightKg(profile.weight_kg != null ? String(profile.weight_kg) : "");
      setGoals(profile.goals || []);
      setFoodPreference(profile.food_preference || "veg");
      setRegions(profile.regions || []);
    }
  }, [profile]);

  const save = async () => {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await profileApi.save({
        name: name.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
        // profile_picture deliberately left out here: the photo picker
        // already saves it separately the instant a new photo is chosen
        // (see pickAndSavePhoto below), so resending it on every ordinary
        // "Save changes" tap only means re-uploading a ~100-200KB base64
        // blob unchanged, every time - which is slow and, on a weak Wi-Fi
        // connection, exactly what was timing out this save.
        age: age ? parseInt(age, 10) : null,
        gender: gender || null,
        height_cm: heightFt || heightIn ? feetInchesToCm(parseInt(heightFt, 10) || 0, parseInt(heightIn, 10) || 0) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        goals,
        food_preference: foodPreference,
        regions,
      });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const pickAndSavePhoto = async (source: "camera" | "gallery") => {
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(source === "camera" ? "Camera permission is needed to take a photo." : "Photo library permission is needed to choose a photo.");
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      };

      const result =
        source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets?.[0]?.base64) return;

      const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setError(null);
      setPhotoSaving(true);
      setProfilePicture(dataUri);
      await profileApi.save({ profile_picture: dataUri });
      await refreshProfile();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update your photo.");
    } finally {
      setPhotoSaving(false);
    }
  };

  const choosePhoto = () => {
    Alert.alert("Profile picture", "Take a new photo or choose one from your gallery.", [
      { text: "Take Photo", onPress: () => pickAndSavePhoto("camera") },
      { text: "Choose from Gallery", onPress: () => pickAndSavePhoto("gallery") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const confirmSignOut = () => {
    Alert.alert("Log out?", "You can log back in anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/login");
        },
      },
    ]);
  };

  if (loading || !profile) {
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Header: soft band + overlapping avatar, compact identity block */}
      <View style={styles.headerBand}>
        <View style={styles.avatarWrap}>
          <Pressable
            onPress={() => profilePicture && setPhotoPreviewOpen(true)}
            disabled={!profilePicture}
          >
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 22, color: colors.primary }}>
                  {initials(name, email)}
                </Body>
              </View>
            )}
          </Pressable>
          {photoSaving && (
            <View style={styles.avatarLoadingOverlay}>
              <ActivityIndicator color={colors.white} size="small" />
            </View>
          )}
          <Pressable style={styles.avatarEditBadge} onPress={choosePhoto} hitSlop={8} disabled={photoSaving}>
            <Ionicons name="camera" size={13} color={colors.white} />
          </Pressable>
        </View>
        <H1 style={{ fontSize: 19, marginTop: space.sm }}>{name || "Your profile"}</H1>
        <Muted style={{ fontSize: 12.5 }}>{email}</Muted>
      </View>

      <View style={styles.tabRow}>
        <Pressable onPress={() => setTab("about")} style={[styles.tabBtn, tab === "about" && styles.tabBtnActive]}>
          <Body style={[styles.tabText, tab === "about" && styles.tabTextActive]}>About</Body>
        </Pressable>
        <Pressable onPress={() => setTab("goals")} style={[styles.tabBtn, tab === "goals" && styles.tabBtnActive]}>
          <Body style={[styles.tabText, tab === "goals" && styles.tabTextActive]}>Goals & Diet</Body>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.sm }}>
        {tab === "about" ? (
          <>
            <Card style={styles.listCard}>
              <FieldRow label="Name" value={name} onChangeText={setName} placeholder="Your name" />
              <FieldRow label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
              <FieldRow label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
              <FieldRow label="Age" value={age} onChangeText={setAge} placeholder="Years" keyboardType="number-pad" suffix="yrs" />
              <HeightRow feet={heightFt} onFeetChange={setHeightFt} inches={heightIn} onInchesChange={setHeightIn} />
              <FieldRow label="Weight" value={weightKg} onChangeText={setWeightKg} placeholder="kg" keyboardType="decimal-pad" suffix="kg" last />
            </Card>

            <Card style={styles.listCard}>
              <Muted style={{ marginBottom: 6 }}>Gender</Muted>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {GENDERS.map((g) => (
                  <Chip key={g} label={g} selected={gender === g} onPress={() => setGender(g)} />
                ))}
              </View>
            </Card>

            <Pressable style={styles.logoutRow} onPress={confirmSignOut}>
              <Ionicons name="log-out-outline" size={17} color={colors.notice} />
              <Body style={{ color: colors.notice, fontFamily: "Manrope_700Bold", fontSize: 14 }}>Log out</Body>
            </Pressable>

            <Pressable style={styles.logoutRow} onPress={() => router.push("/account-delete")}>
              <Ionicons name="trash-outline" size={17} color={colors.notice} />
              <Body style={{ color: colors.notice, fontFamily: "Manrope_700Bold", fontSize: 14 }}>Delete account</Body>
            </Pressable>
          </>
        ) : (
          <>
            <Card style={styles.listCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 14 }}>{formatPhenotype(profile.profile_type)}</Body>
              </View>
              <Muted style={{ fontSize: 11.5, marginTop: 4 }}>
                A starting point from your onboarding quiz, refined as you log more - not a diagnosis.
              </Muted>
            </Card>

            <Card style={styles.listCard}>
              <Muted style={{ marginBottom: 6 }}>Goals - pick as many as apply</Muted>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {GOALS.map((g) => (
                  <Chip
                    key={g.key}
                    label={g.label}
                    selected={goals.includes(g.key)}
                    onPress={() => setGoals((prev) => toggleInList(prev, g.key))}
                  />
                ))}
              </View>
            </Card>

            <Card style={styles.listCard}>
              <Muted style={{ marginBottom: 6 }}>Food preference</Muted>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: space.sm }}>
                <Chip label="Vegetarian" selected={foodPreference === "veg"} onPress={() => setFoodPreference("veg")} />
                <Chip label="Non-vegetarian" selected={foodPreference === "non_veg"} onPress={() => setFoodPreference("non_veg")} />
              </View>
              <Muted style={{ marginBottom: 6 }}>Regional cuisine - pick all you enjoy</Muted>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {REGIONS.map((r) => (
                  <Chip
                    key={r.key}
                    label={r.label}
                    selected={regions.includes(r.key)}
                    onPress={() => setRegions((prev) => toggleInList(prev, r.key))}
                  />
                ))}
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      {/* Footer stays visible without scrolling to the bottom of the list */}
      <View style={styles.footer}>
        <ErrorText>{error}</ErrorText>
        {saved && !error && <Muted style={{ color: colors.secondary, textAlign: "center", marginBottom: 4 }}>Saved!</Muted>}
        <PrimaryButton title="Save changes" onPress={save} loading={saving} />
      </View>

      {/* Fullscreen photo preview - tap the avatar to see it larger, tap
          anywhere (or the close button) to dismiss, WhatsApp-style. */}
      <Modal
        visible={photoPreviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPreviewOpen(false)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setPhotoPreviewOpen(false)}>
          {profilePicture ? (
            <Image source={{ uri: profilePicture }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
          <Pressable style={styles.previewCloseBtn} onPress={() => setPhotoPreviewOpen(false)} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.white} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBand: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    paddingTop: space.xl,
    paddingBottom: space.md,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  avatarWrap: {
    width: 68,
    height: 68,
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surface,
  },
  avatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  tabRow: {
    flexDirection: "row",
    marginHorizontal: space.lg,
    marginTop: space.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 999,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: colors.surface,
  },
  tabText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
    color: colors.inkMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  listCard: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
  },
  fieldRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldLabel: {
    width: 68,
    fontSize: 12.5,
  },
  rowInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 14,
    textAlign: "right",
    minHeight: 0,
  },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: space.sm,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fieldValueWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  rowInputWithSuffix: {
    flex: 0,
    minWidth: 30,
  },
  heightInput: {
    flex: 0,
    minWidth: 20,
  },
  unitText: {
    fontSize: 12.5,
    marginLeft: 3,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "92%",
    height: "70%",
  },
  previewCloseBtn: {
    position: "absolute",
    top: 54,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});

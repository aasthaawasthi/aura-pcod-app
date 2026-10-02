import { useState } from "react";
import { View, ScrollView, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { File, Directory, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useAuth } from "../lib/auth-context";
import { accountApi, API_BASE_URL, getToken, ApiError } from "../lib/api";
import { Screen, H1, Body, Muted, Card, Chip, Input, PrimaryButton, SecondaryButton, ErrorText } from "../components/ui";
import { colors, space } from "../lib/theme";

const REASONS = [
  { key: "not_useful", label: "Not useful for me" },
  { key: "found_alternative", label: "Found another app" },
  { key: "privacy_concerns", label: "Privacy concerns" },
  { key: "too_many_notifications", label: "Too many notifications" },
  { key: "other", label: "Other" },
];

const WHAT_IS_LOST = [
  "Your profile and goals",
  "Every check-in, mood and symptom log",
  "Your full cycle and period history",
  "Your habits and their streaks",
  "Your saved diet plans",
];

type Step = "warning" | "export" | "reason" | "otp";

export default function AccountDelete() {
  const { signOut } = useAuth();
  const [step, setStep] = useState<Step>("warning");

  // --- Export ---
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);

  // --- Reason (optional, feeds the anonymous deletion_feedback row) ---
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // --- OTP re-verification ---
  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  // --- Final delete ---
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Downloads the ZIP-of-CSVs export straight from the authenticated
  // endpoint and hands it to the system share sheet, so it works the
  // same whether the person wants to save it, AirDrop it, or email it to
  // themselves - this is their only chance at this data, so it has to
  // come before the point of no return.
  const doExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const token = await getToken();
      const file = await File.downloadFileAsync(
        `${API_BASE_URL}/account/export`,
        new Directory(Paths.cache),
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined, idempotent: true }
      );
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, { mimeType: "application/zip", dialogTitle: "Save your Aura data" });
      } else {
        Alert.alert("Export ready", `Saved to ${file.uri}`);
      }
      setExported(true);
    } catch (err: any) {
      setExportError(err?.message || "Could not prepare your export. Check your connection and try again.");
    } finally {
      setExporting(false);
    }
  };

  const sendOtp = async () => {
    setOtpSending(true);
    setOtpError(null);
    try {
      const data = await accountApi.requestDeleteOtp();
      setPhone(data.phone);
    } catch (err: any) {
      setOtpError(err?.message || "Could not send the verification code.");
    } finally {
      setOtpSending(false);
    }
  };

  const goToOtpStep = () => {
    setStep("otp");
    sendOtp();
  };

  // Verifies the OTP and, on success, permanently deletes the account.
  // "alreadyDeleted: true" is also a success - it just means an earlier
  // call already went through and this is (or looks like) a retry.
  const doDelete = async () => {
    if (!otp.trim()) {
      setDeleteError("Enter the code sent to your phone.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await accountApi.confirmDelete(otp.trim(), reasonCode || undefined, note.trim() || undefined);
      await signOut();
      Alert.alert("Account deleted", "Your Aura account and all its data have been permanently deleted.");
      router.replace("/login");
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 0) {
        // A network-level failure after the request was already sent -
        // it may well have succeeded on the server even though the
        // response never arrived. Don't invite a blind "just tap it
        // again"; the account's auth token stops working the instant
        // deletion actually happens, so reopening the app is the real
        // way to find out.
        setDeleteError(
          "We couldn't confirm whether this went through - check your connection. If it did, you'll be signed out automatically; try reopening the app to check."
        );
      } else {
        setDeleteError(err?.message || "Could not delete your account. Please try again.");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl, gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <H1 style={{ fontSize: 22 }}>Delete account</H1>
        </View>

        {step === "warning" && (
          <>
            <Card>
              <Body style={{ fontFamily: "Manrope_700Bold", marginBottom: space.xs }}>
                This permanently deletes:
              </Body>
              <View style={{ gap: 4 }}>
                {WHAT_IS_LOST.map((t) => (
                  <View key={t} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <Ionicons name="close-circle" size={15} color={colors.notice} style={{ marginTop: 2 }} />
                    <Body style={{ flex: 1, fontSize: 13.5 }}>{t}</Body>
                  </View>
                ))}
              </View>
              <Muted style={{ marginTop: space.sm, fontSize: 12.5 }}>
                This can&apos;t be undone - there&apos;s no recovery window once it&apos;s confirmed.
              </Muted>
            </Card>
            <PrimaryButton title="Continue" onPress={() => setStep("export")} />
            <SecondaryButton title="Cancel" onPress={() => router.back()} />
          </>
        )}

        {step === "export" && (
          <>
            <Card>
              <Body style={{ fontFamily: "Manrope_700Bold", marginBottom: space.xs }}>
                Download your data first?
              </Body>
              <Muted style={{ fontSize: 12.5, marginBottom: space.sm }}>
                Get a copy of your check-ins and cycle history as a ZIP of spreadsheet-friendly CSV
                files - this is your only chance, since it can&apos;t be recovered after deletion.
              </Muted>
              {exported && (
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginBottom: space.sm }}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.secondary} />
                  <Muted style={{ fontSize: 12.5, color: colors.secondary }}>Export ready</Muted>
                </View>
              )}
              <ErrorText>{exportError}</ErrorText>
              <SecondaryButton
                title={exporting ? "Preparing..." : exported ? "Download again" : "Export my data"}
                onPress={doExport}
              />
            </Card>
            <PrimaryButton title="Continue" onPress={() => setStep("reason")} />
          </>
        )}

        {step === "reason" && (
          <>
            <Card>
              <Body style={{ fontFamily: "Manrope_700Bold", marginBottom: space.xs }}>
                Mind telling us why? (optional)
              </Body>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: space.sm }}>
                {REASONS.map((r) => (
                  <Chip
                    key={r.key}
                    label={r.label}
                    selected={reasonCode === r.key}
                    onPress={() => setReasonCode(reasonCode === r.key ? null : r.key)}
                  />
                ))}
              </View>
              <Input
                placeholder="Anything else? (optional)"
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />
            </Card>
            <PrimaryButton title="Continue" onPress={goToOtpStep} />
          </>
        )}

        {step === "otp" && (
          <>
            <Card>
              <Body style={{ fontFamily: "Manrope_700Bold", marginBottom: space.xs }}>Verify it&apos;s you</Body>
              <Muted style={{ fontSize: 12.5, marginBottom: space.sm }}>
                {phone
                  ? `Enter the code we sent to ${phone}.`
                  : otpSending
                  ? "Sending a verification code..."
                  : "Enter the verification code."}
              </Muted>
              <Input
                placeholder="6-digit code"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Pressable onPress={sendOtp} disabled={otpSending} hitSlop={8} style={{ marginTop: space.sm }}>
                <Muted style={{ fontSize: 12.5, color: colors.primary }}>
                  {otpSending ? "Sending..." : "Resend code"}
                </Muted>
              </Pressable>
              <ErrorText>{otpError}</ErrorText>
            </Card>
            <ErrorText>{deleteError}</ErrorText>
            <PrimaryButton
              title={deleting ? "Deleting..." : "Delete my account permanently"}
              onPress={doDelete}
              loading={deleting}
              style={{ backgroundColor: colors.notice }}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

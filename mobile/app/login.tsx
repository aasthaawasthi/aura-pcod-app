import { useState } from "react";
import { View, KeyboardAvoidingView, Platform, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth-context";
import { ApiError } from "../lib/api";
import { Screen, H1, H2, Body, Muted, Input, PrimaryButton, ErrorText } from "../components/ui";
import { colors, space, radius } from "../lib/theme";

// Single phone+OTP screen that covers both login and signup - verifying a
// code for a new number registers it, verifying one for an existing
// number logs it in. There's nothing left for a separate signup screen to
// do, so it's gone; this replaces login.tsx + signup.tsx.
export default function Login() {
  const { requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOtp = async () => {
    setError(null);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid phone number.");
      return;
    }
    setLoading(true);
    try {
      const { devOtp: dev } = await requestOtp(phone.trim());
      setDevOtp(dev || null);
      setOtp("");
      setStep("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the OTP.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError(null);
    setOtp("");
    setLoading(true);
    try {
      const { devOtp: dev } = await requestOtp(phone.trim());
      setDevOtp(dev || null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend the OTP.");
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async () => {
    setError(null);
    if (otp.trim().length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(phone.trim(), otp.trim());
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify the code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {step === "phone" ? (
            <>
              <H1 style={{ marginBottom: space.xs }}>Welcome back</H1>
              <Muted style={{ marginBottom: space.xl }}>
                Log in or create an account with your phone number - we'll text you a one-time code.
              </Muted>

              <View style={styles.phoneRow}>
                <Input
                  placeholder="Phone number"
                  keyboardType="phone-pad"
                  autoFocus
                  value={phone}
                  onChangeText={setPhone}
                  style={styles.phoneInput}
                  onSubmitEditing={sendOtp}
                  returnKeyType="go"
                />
                <Pressable
                  onPress={sendOtp}
                  disabled={loading}
                  style={({ pressed }) => [styles.arrowBtn, (loading || pressed) && { opacity: 0.85 }]}
                >
                  <Ionicons name="arrow-forward" size={20} color={colors.white} />
                </Pressable>
              </View>

              <ErrorText>{error}</ErrorText>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Muted style={{ fontSize: 12, marginHorizontal: 10 }}>or</Muted>
                <View style={styles.dividerLine} />
              </View>

              <Pressable disabled style={styles.googleBtn}>
                <Ionicons name="logo-google" size={17} color={colors.inkMuted} />
                <Body style={{ color: colors.inkMuted, fontFamily: "Manrope_700Bold", fontSize: 14 }}>
                  Continue with Google
                </Body>
              </Pressable>
              <Muted style={{ textAlign: "center", fontSize: 11, marginTop: 6 }}>Coming soon</Muted>
            </>
          ) : (
            <>
              <H1 style={{ marginBottom: space.xs }}>Enter the code</H1>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: space.xl, gap: 4 }}>
                <Muted>We sent a 6-digit code to {phone.trim()}.</Muted>
                <Body
                  onPress={() => {
                    setStep("phone");
                    setError(null);
                  }}
                  style={{ textDecorationLine: "underline", fontSize: 13 }}
                >
                  Edit number
                </Body>
              </View>

              {devOtp && (
                <View style={styles.devBanner}>
                  <Muted style={{ fontSize: 12, textAlign: "center" }}>
                    Dev mode - no SMS provider connected yet. Your code is:
                  </Muted>
                  <H2 style={{ marginTop: 2, letterSpacing: 4 }}>{devOtp}</H2>
                </View>
              )}

              <Input
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                value={otp}
                onChangeText={setOtp}
                style={{ textAlign: "center", letterSpacing: 8, fontSize: 20 }}
                onSubmitEditing={confirmOtp}
                returnKeyType="go"
              />

              <ErrorText>{error}</ErrorText>

              <PrimaryButton
                title="Verify & continue"
                onPress={confirmOtp}
                loading={loading}
                style={{ marginTop: space.lg }}
              />

              <Pressable onPress={resendOtp} disabled={loading} style={{ marginTop: space.lg, alignItems: "center" }}>
                <Body style={{ fontSize: 13, textDecorationLine: "underline" }}>Resend code</Body>
              </Pressable>
            </>
          )}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  phoneInput: {
    flex: 1,
  },
  arrowBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.xl,
    marginBottom: space.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    opacity: 0.6,
  },
  devBanner: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: space.sm,
    alignItems: "center",
    marginBottom: space.md,
  },
});

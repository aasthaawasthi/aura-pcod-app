import { useState } from "react";
import { View, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { ApiError } from "../lib/api";
import { Screen, H1, Body, Muted, Input, PrimaryButton, ErrorText } from "../components/ui";
import { space } from "../lib/theme";

export default function Signup() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const onSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("That doesn't look like a valid email address (e.g. name@example.com).");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim() || undefined);
      router.replace("/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.lg }}>
          <H1 style={{ marginBottom: space.xs }}>Let's set you up</H1>
          <Muted style={{ marginBottom: space.xl }}>
            A few basics first — the details that shape your plan come next.
          </Muted>

          <View style={{ gap: space.sm }}>
            <Input placeholder="Name (optional)" value={name} onChangeText={setName} />
            <Input
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          </View>

          <ErrorText>{error}</ErrorText>

          <PrimaryButton title="Create account" onPress={onSubmit} loading={loading} style={{ marginTop: space.lg }} />

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: space.lg, gap: 6 }}>
            <Body>Already have an account?</Body>
            <Link href="/login">
              <Body style={{ textDecorationLine: "underline" }}>Log in</Body>
            </Link>
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

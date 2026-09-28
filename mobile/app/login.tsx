import { useState } from "react";
import { View, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { ApiError } from "../lib/api";
import { Screen, H1, Body, Muted, Input, PrimaryButton, ErrorText } from "../components/ui";
import { space } from "../lib/theme";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.lg }}>
          <H1 style={{ marginBottom: space.xs }}>Welcome back</H1>
          <Muted style={{ marginBottom: space.xl }}>
            Log in to pick up your cycle, habits and diet plan where you left off.
          </Muted>

          <View style={{ gap: space.sm }}>
            <Input
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <ErrorText>{error}</ErrorText>

          <PrimaryButton title="Log in" onPress={onSubmit} loading={loading} style={{ marginTop: space.lg }} />

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: space.lg, gap: 6 }}>
            <Body>New here?</Body>
            <Link href="/signup">
              <Body style={{ textDecorationLine: "underline" }}>Create an account</Body>
            </Link>
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth/AuthContext";
import { Button, Field } from "../src/components/ui";
import { API_URL } from "../src/config";
import { colors, spacing } from "../src/theme";

export default function LoginScreen() {
  const { mode, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (mode === "platform") return <Redirect href="/(platform)" />;
  if (mode === "firm") return <Redirect href="/(firm)" />;
  if (mode === "client") return <Redirect href="/(client)" />;

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Enter email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      Alert.alert("Sign in failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.brand}>
          <Text style={styles.brandName}>LexFlow</Text>
          <Text style={styles.brandTag}>Firm · Client · Platform</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Sign in</Text>
          <Text style={styles.hint}>
            One app for firm staff, clients, and platform superadmins. Access is role-based.
          </Text>
          <Field
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@firm.ch"
          />
          <Field
            label="Password"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
          />
          <Button title="Sign in" onPress={() => void onSubmit()} loading={loading} />
          <Text style={styles.api}>API: {API_URL}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  wrap: { flex: 1, justifyContent: "center", padding: spacing.lg },
  brand: { marginBottom: spacing.lg },
  brandName: {
    fontSize: 40,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  brandTag: { color: "rgba(255,255,255,0.75)", marginTop: 6, fontSize: 15 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: spacing.lg,
  },
  heading: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 6 },
  hint: { color: colors.muted, marginBottom: spacing.md, fontSize: 14, lineHeight: 20 },
  api: { marginTop: spacing.md, fontSize: 11, color: colors.muted, textAlign: "center" },
});

import { Alert, Text, View } from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { trpc } from "../../src/api/trpc";
import { Button, Card, Muted, Screen, Title } from "../../src/components/ui";
import { API_URL } from "../../src/config";
import { colors } from "../../src/theme";

export default function ClientProfile() {
  const { meName, user, logout } = useAuth();
  const branding = trpc.firm.branding.useQuery();

  return (
    <Screen>
      <Title>Profile</Title>
      <Card>
        <Text style={{ fontWeight: "700", color: colors.text, fontSize: 16 }}>{meName}</Text>
        <Muted>{user?.email}</Muted>
        <Muted>Role: client</Muted>
      </Card>
      <Card>
        <Text style={{ fontWeight: "600", color: colors.text }}>{branding.data?.name || "Your firm"}</Text>
        <Muted>{branding.data?.email || API_URL}</Muted>
      </Card>
      <View style={{ marginTop: 8 }}>
        <Button
          title="Sign out"
          variant="danger"
          onPress={() => {
            Alert.alert("Sign out", "End this session on this device?", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => void logout() },
            ]);
          }}
        />
      </View>
    </Screen>
  );
}

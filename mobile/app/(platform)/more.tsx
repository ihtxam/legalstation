import { Alert, Text, View } from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { Button, Card, Muted, Screen, Title } from "../../src/components/ui";
import { API_URL } from "../../src/config";
import { colors } from "../../src/theme";

export default function PlatformMore() {
  const { meName, user, logout } = useAuth();

  return (
    <Screen>
      <Title>Account</Title>
      <Card>
        <Text style={{ fontWeight: "700", color: colors.text, fontSize: 16 }}>{meName}</Text>
        <Muted>{user?.email}</Muted>
        <Muted>Role: platform superadmin</Muted>
      </Card>
      <Card>
        <Muted>
          Full firm provisioning, impersonation, and billing edits stay on the web console. This
          mobile view is for overview and monitoring on the go.
        </Muted>
        <Muted>API {API_URL}</Muted>
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

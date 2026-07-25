import { Alert, Text, View } from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { Button, Card, Muted, Screen, Title } from "../../src/components/ui";
import { API_URL } from "../../src/config";
import { colors } from "../../src/theme";

export default function FirmMore() {
  const { meName, firmName, firmRole, capabilities, logout } = useAuth();

  return (
    <Screen>
      <Title>Account</Title>
      <Card>
        <Text style={{ fontWeight: "700", color: colors.text, fontSize: 16 }}>{meName}</Text>
        <Muted>
          {firmName} · {firmRole}
        </Muted>
      </Card>
      <Card>
        <Text style={{ fontWeight: "600", marginBottom: 8, color: colors.text }}>Capabilities</Text>
        <Muted>Create invoices: {capabilities?.canCreateInvoice ? "yes" : "no"}</Muted>
        <Muted>Invite clients: {capabilities?.canInviteClients ? "yes" : "no"}</Muted>
        <Muted>Firm-wide cases: {capabilities?.canSeeFirmWideCases ? "yes" : "no"}</Muted>
      </Card>
      <Card>
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

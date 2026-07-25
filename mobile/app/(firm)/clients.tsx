import { FlatList, Text, View } from "react-native";
import { trpc } from "../../src/api/trpc";
import { Badge, Card, Empty, Loading, Muted, Screen, Title } from "../../src/components/ui";
import { colors } from "../../src/theme";

function clientName(c: any) {
  if (c.type === "company") return c.companyName || "Company";
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "Client";
}

export default function FirmClients() {
  const clients = trpc.clients.list.useQuery({});

  if (clients.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Clients</Title>
      <Muted>People and companies linked to your firm.</Muted>
      <FlatList
        style={{ marginTop: 12 }}
        data={clients.data || []}
        keyExtractor={(item: any) => String(item.id)}
        ListEmptyComponent={<Empty message="No clients yet." />}
        renderItem={({ item }: { item: any }) => (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>{clientName(item)}</Text>
                <Muted>{item.email || "No email"}</Muted>
              </View>
              <Badge label={item.status || item.type || "active"} />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

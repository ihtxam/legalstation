import { FlatList, Text, View } from "react-native";
import { trpc } from "../../src/api/trpc";
import { Badge, Card, Empty, Loading, Muted, Screen, Title } from "../../src/components/ui";
import { colors } from "../../src/theme";

export default function PlatformLeads() {
  const leads = trpc.leads.list.useQuery(undefined);

  if (leads.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (leads.isError) {
    return (
      <Screen>
        <Title>Leads</Title>
        <Empty message={leads.error?.message || "Could not load leads."} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Leads</Title>
      <Muted>Inbound interest from the marketing site / signup.</Muted>
      <FlatList
        style={{ marginTop: 12 }}
        data={leads.data || []}
        keyExtractor={(item: any) => String(item.id)}
        ListEmptyComponent={<Empty message="No leads yet." />}
        renderItem={({ item }: { item: any }) => (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  {item.name || item.companyName || item.email || `Lead #${item.id}`}
                </Text>
                <Muted>{item.email || "—"}</Muted>
                {item.message ? <Muted>{String(item.message).slice(0, 120)}</Muted> : null}
              </View>
              <Badge label={item.status || "new"} tone="warn" />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

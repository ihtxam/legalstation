import { FlatList, Text, View } from "react-native";
import { trpc } from "../../src/api/trpc";
import { Badge, Card, Empty, Loading, Muted, Screen, Title } from "../../src/components/ui";
import { colors } from "../../src/theme";

function money(n: unknown) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(Number(n || 0));
}

export default function ClientInvoices() {
  const invoices = trpc.invoices.list.useQuery({});

  if (invoices.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Invoices</Title>
      <Muted>Invoices shared with your account (drafts are hidden).</Muted>
      <FlatList
        style={{ marginTop: 12 }}
        data={invoices.data || []}
        keyExtractor={(item: any) => String(item.id)}
        ListEmptyComponent={<Empty message="No invoices yet." />}
        renderItem={({ item }: { item: any }) => (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  {item.invoiceNumber || `INV-${item.id}`}
                </Text>
                <Muted>{money(item.total)}</Muted>
              </View>
              <Badge
                label={item.status || "sent"}
                tone={item.status === "paid" ? "ok" : item.status === "overdue" ? "warn" : "neutral"}
              />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

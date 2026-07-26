import { useMemo, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { trpc } from "../../src/api/trpc";
import { Badge, Card, Empty, Loading, Muted, Screen, Title } from "../../src/components/ui";
import { colors, spacing } from "../../src/theme";

export default function PlatformFirms() {
  const firms = trpc.superadmin.listFirms.useQuery();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const list = firms.data || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (f: any) =>
        String(f.name || "").toLowerCase().includes(needle) ||
        String(f.email || "").toLowerCase().includes(needle) ||
        String(f.slug || "").toLowerCase().includes(needle)
    );
  }, [firms.data, q]);

  if (firms.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Firms</Title>
      <Muted>All law firms on the LexFlow platform.</Muted>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search name, email, slug…"
        placeholderTextColor={colors.muted}
        style={{
          marginTop: spacing.sm,
          marginBottom: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: "#fff",
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 12,
          color: colors.text,
        }}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item: any) => String(item.id)}
        ListEmptyComponent={<Empty message="No firms match." />}
        renderItem={({ item }: { item: any }) => (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>{item.name}</Text>
                <Muted>
                  {item.slug || "—"} · {item.email}
                </Muted>
              </View>
              <Badge
                label={item.subscription?.status || "none"}
                tone={item.subscription?.status === "active" ? "ok" : "neutral"}
              />
            </View>
            <Muted>
              {`Domain: ${item.subdomainStatus || "none"}${item.phone ? ` · ${item.phone}` : ""}`}
            </Muted>
          </Card>
        )}
      />
    </Screen>
  );
}

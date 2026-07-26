import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { trpc } from "../../src/api/trpc";
import { Card, Loading, Muted, Screen, Subtitle, Title } from "../../src/components/ui";
import { colors, spacing } from "../../src/theme";

export default function PlatformHome() {
  const { meName } = useAuth();
  const firms = trpc.superadmin.listFirms.useQuery();
  const leads = trpc.leads.list.useQuery(undefined);

  if (firms.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const list = firms.data || [];
  const active = list.filter((f: any) => f.subscription?.status === "active").length;
  const pendingDomain = list.filter((f: any) => f.subdomainStatus === "pending").length;
  const leadCount = (leads.data || []).length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Title>Platform</Title>
        <Muted>Superadmin · {meName || "LexFlow"}</Muted>

        <View style={styles.grid}>
          <Stat label="Firms" value={String(list.length)} />
          <Stat label="Active subs" value={String(active)} />
          <Stat label="Domain pending" value={String(pendingDomain)} />
          <Stat label="Leads" value={leads.isLoading ? "…" : String(leadCount)} />
        </View>

        <Subtitle>Recent firms</Subtitle>
        {list.slice(0, 8).map((f: any) => (
          <Card key={f.id}>
            <Text style={styles.name}>{f.name}</Text>
            <Muted>
              {f.slug || "—"} · {f.subscription?.status || "no plan"} · {f.subdomainStatus || "none"}
            </Muted>
            <Muted>{f.email}</Muted>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  stat: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.navy },
  statLabel: { marginTop: 4, color: colors.muted, fontSize: 13 },
  name: { fontWeight: "700", color: colors.text, marginBottom: 2 },
});

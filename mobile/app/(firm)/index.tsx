import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { trpc } from "../../src/api/trpc";
import { Badge, Card, Loading, Muted, Screen, Subtitle, Title } from "../../src/components/ui";
import { colors, spacing } from "../../src/theme";

export default function FirmHome() {
  const { meName, firmName, firmRole } = useAuth();
  const stats = trpc.dashboard.lawyerStats.useQuery();
  const cases = trpc.cases.list.useQuery({});

  if (stats.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const s = stats.data;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Title>{firmName || "LexFlow"}</Title>
        <Muted>
          {meName} · {firmRole || "staff"}
        </Muted>

        <View style={styles.grid}>
          <Stat label="Open cases" value={String(s?.openCases ?? cases.data?.length ?? "—")} />
          <Stat label="Pending" value={String(s?.pendingCases ?? "—")} />
          <Stat label="Invoices due" value={String(s?.pendingInvoices ?? "—")} />
          <Stat label="Paid revenue" value={formatMoney(s?.totalRevenue)} />
        </View>

        <Subtitle>Recent cases</Subtitle>
        {(cases.data || []).slice(0, 5).map((c: any) => (
          <Link key={c.id} href={`/(firm)/case/${c.id}`} asChild>
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.caseTitle}>{c.title}</Text>
                  <Muted>{c.reference || `Case #${c.id}`}</Muted>
                </View>
                <Badge label={c.status || "open"} tone={c.status === "closed" ? "neutral" : "ok"} />
              </View>
            </Card>
          </Link>
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

function formatMoney(n: unknown) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(Number(n));
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
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  caseTitle: { fontWeight: "700", color: colors.text, marginBottom: 2 },
});

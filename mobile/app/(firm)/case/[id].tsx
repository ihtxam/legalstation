import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { trpc } from "../../../src/api/trpc";
import { DocumentUploader } from "../../../src/components/DocumentUploader";
import { Badge, Card, Empty, Loading, Muted, Screen, Subtitle, Title } from "../../../src/components/ui";
import { colors } from "../../../src/theme";

export default function FirmCaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = Number(id);
  const caseQuery = trpc.cases.get.useQuery({ id: caseId }, { enabled: Number.isFinite(caseId) });
  const docs = trpc.documents.list.useQuery({ caseId }, { enabled: Number.isFinite(caseId) });
  const messages = trpc.messages.list.useQuery({ caseId }, { enabled: Number.isFinite(caseId) });

  if (caseQuery.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  const c = caseQuery.data;
  if (!c) {
    return (
      <Screen>
        <Empty message="Case not found." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Title>{c.title}</Title>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <Badge label={c.status || "open"} tone="ok" />
          <Badge label={c.type || "matter"} />
        </View>
        <Muted>{c.reference || `Case #${c.id}`}</Muted>
        {c.description ? (
          <Card>
            <Text style={{ color: colors.text, lineHeight: 20 }}>{c.description}</Text>
          </Card>
        ) : null}

        <Subtitle>Documents</Subtitle>
        <Card>
          <DocumentUploader caseId={caseId} onUploaded={() => void docs.refetch()} />
        </Card>
        {(docs.data || []).length === 0 ? (
          <Empty message="No documents yet." />
        ) : (
          (docs.data || []).map((d: any) => (
            <Card key={d.id}>
              <Text style={{ fontWeight: "600", color: colors.text }}>{d.name}</Text>
              <Muted>
                {d.mimeType || "file"} · {d.visibility || "shared"}
              </Muted>
            </Card>
          ))
        )}

        <Subtitle>Messages</Subtitle>
        {(messages.data || []).length === 0 ? (
          <Empty message="No messages yet." />
        ) : (
          (messages.data || []).slice(0, 20).map((m: any) => (
            <Card key={m.id}>
              <Muted>{m.senderName || "User"}</Muted>
              <Text style={{ color: colors.text, marginTop: 4 }}>{m.content}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

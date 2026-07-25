import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { trpc } from "../../../src/api/trpc";
import { DocumentUploader } from "../../../src/components/DocumentUploader";
import {
  Badge,
  Button,
  Card,
  Empty,
  Loading,
  Muted,
  Screen,
  Subtitle,
  Title,
} from "../../../src/components/ui";
import { colors, spacing } from "../../../src/theme";

export default function ClientCaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = Number(id);
  const [message, setMessage] = useState("");

  const caseQuery = trpc.cases.get.useQuery({ id: caseId }, { enabled: Number.isFinite(caseId) });
  const docs = trpc.documents.list.useQuery({ caseId }, { enabled: Number.isFinite(caseId) });
  const messages = trpc.messages.list.useQuery({ caseId }, { enabled: Number.isFinite(caseId) });
  const requests = trpc.documentRequests.list.useQuery(
    { caseId },
    { enabled: Number.isFinite(caseId) }
  );
  const sendMessage = trpc.messages.send.useMutation({
    onSuccess: () => {
      setMessage("");
      void messages.refetch();
    },
    onError: (e: Error) => Alert.alert("Could not send", e.message),
  });

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

  const openRequests = (requests.data || []).filter((r: any) => r.status === "pending" || r.status === "open");

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Title>{c.title}</Title>
        <Badge label={c.status || "open"} tone="ok" />
        <Muted>{c.reference || `Case #${c.id}`}</Muted>

        {openRequests.length > 0 ? (
          <>
            <Subtitle>Document requests</Subtitle>
            {openRequests.map((r: any) => (
              <Card key={r.id}>
                <Text style={{ fontWeight: "700", color: colors.text }}>{r.title}</Text>
                {r.description ? <Muted>{r.description}</Muted> : null}
                <Muted>Upload a scan below to fulfill this request.</Muted>
              </Card>
            ))}
          </>
        ) : null}

        <Subtitle>Upload / scan</Subtitle>
        <Card>
          <DocumentUploader
            caseId={caseId}
            onUploaded={() => {
              void docs.refetch();
              void requests.refetch();
            }}
          />
        </Card>

        <Subtitle>Documents</Subtitle>
        {(docs.data || []).length === 0 ? (
          <Empty message="No shared documents yet." />
        ) : (
          (docs.data || []).map((d: any) => (
            <Card key={d.id}>
              <Text style={{ fontWeight: "600", color: colors.text }}>{d.name}</Text>
              <Muted>{d.mimeType || "file"}</Muted>
            </Card>
          ))
        )}

        <Subtitle>Messages</Subtitle>
        {(messages.data || []).slice(0, 30).map((m: any) => (
          <Card key={m.id}>
            <Muted>{m.senderName || "User"}</Muted>
            <Text style={{ color: colors.text, marginTop: 4 }}>{m.content}</Text>
          </Card>
        ))}

        <Card>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Write a message to your lawyer…"
            placeholderTextColor={colors.muted}
            multiline
            style={{
              minHeight: 80,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              padding: 12,
              marginBottom: spacing.sm,
              color: colors.text,
              textAlignVertical: "top",
            }}
          />
          <Button
            title="Send message"
            loading={sendMessage.isPending}
            onPress={() => {
              if (!message.trim()) return;
              sendMessage.mutate({ caseId, content: message.trim() });
            }}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

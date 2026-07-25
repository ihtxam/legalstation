import { FlatList, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { trpc } from "../../src/api/trpc";
import { Badge, Empty, Loading, Muted, Screen, Title } from "../../src/components/ui";
import { colors } from "../../src/theme";

export default function FirmCases() {
  const cases = trpc.cases.list.useQuery({});

  if (cases.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingTop: 8 }}>
      <Title>Cases</Title>
      <Muted>Matters you can access with your firm role.</Muted>
      <FlatList
        style={{ marginTop: 12 }}
        data={cases.data || []}
        keyExtractor={(item: any) => String(item.id)}
        ListEmptyComponent={<Empty message="No cases yet." />}
        renderItem={({ item }: { item: any }) => (
          <Link href={`/(firm)/case/${item.id}`} asChild>
            <Pressable
              style={{
                backgroundColor: colors.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", color: colors.text }}>{item.title}</Text>
                  <Muted>{item.reference || `Case #${item.id}`}</Muted>
                </View>
                <Badge label={item.status || "open"} />
              </View>
            </Pressable>
          </Link>
        )}
      />
    </Screen>
  );
}

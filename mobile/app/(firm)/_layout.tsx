import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { Loading, Screen } from "../../src/components/ui";
import { colors } from "../../src/theme";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: focused ? "700" : "500", color: focused ? colors.navy : colors.muted }}>
      {label}
    </Text>
  );
}

export default function FirmLayout() {
  const { mode } = useAuth();
  if (mode === "loading") {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (mode === "guest") return <Redirect href="/login" />;
  if (mode === "client") return <Redirect href="/(client)" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: "#fff",
        tabBarActiveTintColor: colors.navy,
        tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 8 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cases"
        options={{
          title: "Cases",
          tabBarIcon: ({ focused }) => <TabIcon label="Cases" focused={focused} />,
        }}
      />
      <Tabs.Screen name="case/[id]" options={{ href: null, title: "Case" }} />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clients",
          tabBarIcon: ({ focused }) => <TabIcon label="Clients" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: "Invoices",
          tabBarIcon: ({ focused }) => <TabIcon label="Billing" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ focused }) => <TabIcon label="More" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

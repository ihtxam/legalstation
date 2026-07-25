import { Redirect } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";
import { Loading, Screen } from "../src/components/ui";

export default function Index() {
  const { mode } = useAuth();

  if (mode === "loading") {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (mode === "firm") return <Redirect href="/(firm)" />;
  if (mode === "client") return <Redirect href="/(client)" />;
  return <Redirect href="/login" />;
}

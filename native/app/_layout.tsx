import { useSettingsStore } from "@/stores/settings";
import { Stack } from "expo-router";
import { useEffect } from "react";

export default function RootLayout() {
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, []);
  return <Stack />;
}

import type { ExtendedTheme } from "@/constants/themes/types";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type StartupScreenProps =
  | {
      mode: "loading";
    }
  | {
      mode: "error";
      message: string;
    };

export default function StartupScreen(props: StartupScreenProps) {
  const styles = useStyles(createStyles);

  return (
    <View style={styles.splash}>
      <Text style={styles.title}>Keeper</Text>
      {props.mode === "loading" ? (
        <ActivityIndicator size="large" style={styles.activityIndicator} />
      ) : (
        <Text style={styles.errorText}>{props.message}</Text>
      )}
    </View>
  );
}

function createStyles(theme: ExtendedTheme) {
  return StyleSheet.create({
    splash: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: 32,
      fontWeight: "bold",
      color: theme.colors.primary,
    },
    activityIndicator: {
      marginTop: 16,
      color: theme.colors.primary,
    },
    errorText: {
      marginTop: 16,
      paddingHorizontal: 24,
      textAlign: "center",
      color: theme.colors.text,
    },
  });
}

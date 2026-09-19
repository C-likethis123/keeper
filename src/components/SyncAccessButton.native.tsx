import { signInToSync } from "@/services/sync/cloudflareAccessAuth";
import { showToast } from "@/services/toast";
import { useState } from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Pressable, Text } from "react-native";

export function SyncAccessButton({
	style,
	textStyle,
}: {
	style?: StyleProp<ViewStyle>;
	textStyle?: StyleProp<TextStyle>;
}) {
	const [isSigningIn, setIsSigningIn] = useState(false);

	return (
		<Pressable
			style={style}
			disabled={isSigningIn}
			onPress={() => {
				setIsSigningIn(true);
				void signInToSync()
					.then(() => showToast("Sync sign-in complete"))
					.catch((error) =>
						showToast(
							`Sync sign-in failed: ${
								error instanceof Error ? error.message : String(error)
							}`,
							8000,
						),
					)
					.finally(() => setIsSigningIn(false));
			}}
			accessibilityRole="button"
			accessibilityLabel="Sign in to sync"
		>
			<Text style={textStyle}>
				{isSigningIn ? "Signing in…" : "Sign in to sync"}
			</Text>
		</Pressable>
	);
}

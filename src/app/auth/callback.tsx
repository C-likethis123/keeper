import { Redirect } from "expo-router";

/**
 * Handles the native Cloudflare Access OAuth redirect after AuthSession has
 * consumed its authorization parameters. Without this route Expo Router shows
 * its unmatched-route screen for native://auth/callback.
 */
export default function SyncAuthCallback() {
	return <Redirect href="/" />;
}

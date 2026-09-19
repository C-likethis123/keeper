import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { getSyncServerUrl } from "@/services/sync/config";

const STORAGE_KEY = "keeper.cloudflare-access-auth";
const APP_REDIRECT_URI = "native://auth/callback";

type Discovery = AuthSession.DiscoveryDocument & {
	registrationEndpoint?: string;
};

type ProtectedResourceMetadata = {
	resource?: string;
	authorization_servers?: string[];
};

type StoredAuth = {
	clientId: string;
	discovery: Discovery;
	token: AuthSession.TokenResponseConfig;
};

async function readAuth(): Promise<StoredAuth | null> {
	const raw = await SecureStore.getItemAsync(STORAGE_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as StoredAuth;
	} catch {
		await SecureStore.deleteItemAsync(STORAGE_KEY);
		return null;
	}
}

async function saveAuth(value: StoredAuth): Promise<void> {
	await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(value));
}

function getResourceUrl(): string {
	const value = getSyncServerUrl();
	if (!value?.startsWith("https://")) {
		throw new Error("Cloudflare Access sync URL must use HTTPS");
	}
	return value;
}

function isCloudflareAccessSyncConfigured(): boolean {
	return Boolean(process.env.EXPO_PUBLIC_SYNC_ACCESS_RESOURCE_URL?.trim());
}

function getResourceMetadataUrl(wwwAuthenticate: string): string {
	const match = /resource_metadata="([^"]+)"/.exec(wwwAuthenticate);
	if (!match?.[1]) {
		throw new Error("Cloudflare Access did not provide OAuth resource metadata");
	}
	return match[1];
}

async function discover(resourceUrl: string): Promise<{
	resource: string;
	discovery: Discovery;
}> {
	const protectedResourceResponse = await fetch(resourceUrl);
	const wwwAuthenticate = protectedResourceResponse.headers.get("www-authenticate");
	if (!wwwAuthenticate) {
		throw new Error("Cloudflare Access OAuth is not enabled for the sync URL");
	}

	const metadataResponse = await fetch(getResourceMetadataUrl(wwwAuthenticate));
	if (!metadataResponse.ok) {
		throw new Error("Cloudflare Access resource metadata request failed");
	}
	const metadata =
		(await metadataResponse.json()) as ProtectedResourceMetadata;
	const authorizationServer = metadata.authorization_servers?.[0];
	if (!authorizationServer || !metadata.resource) {
		throw new Error("Cloudflare Access resource metadata is incomplete");
	}

	const response = await fetch(
		`${authorizationServer.replace(/\/+$/, "")}/.well-known/oauth-authorization-server`,
	);
	if (!response.ok) throw new Error("Cloudflare Access OAuth discovery failed");
	const document = (await response.json()) as {
		authorization_endpoint?: string;
		token_endpoint?: string;
		registration_endpoint?: string;
		revocation_endpoint?: string;
	};
	return {
		resource: metadata.resource,
		discovery: {
			authorizationEndpoint: document.authorization_endpoint,
			tokenEndpoint: document.token_endpoint,
			registrationEndpoint: document.registration_endpoint,
			revocationEndpoint: document.revocation_endpoint,
		},
	};
}

async function registerClient(
	discoveryDocument: Discovery,
	resource: string,
): Promise<string> {
	if (!discoveryDocument.registrationEndpoint) {
		throw new Error("Cloudflare Access client registration is unavailable");
	}
	const response = await fetch(discoveryDocument.registrationEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			redirect_uris: [APP_REDIRECT_URI],
			response_types: ["code"],
			grant_types: ["authorization_code"],
			token_endpoint_auth_method: "none",
			resource,
		}),
	});
	if (!response.ok) throw new Error("Cloudflare Access client registration failed");
	const body = (await response.json()) as { client_id?: string };
	if (!body.client_id) throw new Error("Cloudflare Access did not return a client ID");
	return body.client_id;
}

export async function signInToSync(): Promise<void> {
	if (!isCloudflareAccessSyncConfigured()) {
		throw new Error("Cloudflare Access sync URL is not configured");
	}
	const resourceUrl = getResourceUrl();
	const { resource, discovery: discoveryDocument } = await discover(resourceUrl);
	const clientId = await registerClient(discoveryDocument, resource);
	const request = new AuthSession.AuthRequest({
		clientId,
		redirectUri: APP_REDIRECT_URI,
		responseType: AuthSession.ResponseType.Code,
		usePKCE: true,
		extraParams: { resource },
	});
	const authorizationUrl = await request.makeAuthUrlAsync(discoveryDocument);
	const result = await WebBrowser.openAuthSessionAsync(
		authorizationUrl,
		APP_REDIRECT_URI,
	);
	if (result.type !== "success") throw new Error("Cloudflare Access sign-in was cancelled");
	const parsed = request.parseReturnUrl(result.url);
	if (parsed.type !== "success" || !parsed.params.code) {
		throw new Error(parsed.params.error_description ?? "Cloudflare Access sign-in failed");
	}
	const token = await AuthSession.exchangeCodeAsync(
		{
			clientId,
			code: parsed.params.code,
			redirectUri: APP_REDIRECT_URI,
			extraParams: { code_verifier: request.codeVerifier ?? "" },
		},
		discoveryDocument,
	);
	await saveAuth({
		clientId,
		discovery: discoveryDocument,
		token: token.getRequestConfig(),
	});
}

export async function signOutOfSync(): Promise<void> {
	await SecureStore.deleteItemAsync(STORAGE_KEY);
}

export async function getSyncAuthorizationHeaders(): Promise<
	Record<string, string>
> {
	if (!isCloudflareAccessSyncConfigured()) return {};
	const stored = await readAuth();
	if (!stored) return {};
	let token = new AuthSession.TokenResponse(stored.token);
	if (!AuthSession.TokenResponse.isTokenFresh(token, -60)) {
		if (!token.refreshToken) {
			await signOutOfSync();
			return {};
		}
		token = await AuthSession.refreshAsync(
			{ clientId: stored.clientId, refreshToken: token.refreshToken },
			stored.discovery,
		);
		await saveAuth({ ...stored, token: token.getRequestConfig() });
	}
	return { Authorization: `Bearer ${token.accessToken}` };
}

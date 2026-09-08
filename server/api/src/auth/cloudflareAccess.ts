import { createRemoteJWKSet, jwtVerify } from "jose";

export type CloudflareAccessConfig = {
	audience: string;
	teamDomain: string;
};

export type CloudflareAccessVerifier = (token: string) => Promise<void>;

export function createCloudflareAccessVerifier({
	audience,
	teamDomain,
}: CloudflareAccessConfig): CloudflareAccessVerifier {
	const issuer = new URL(teamDomain).origin;
	const jwks = createRemoteJWKSet(
		new URL("/cdn-cgi/access/certs", issuer),
	);

	return async (token) => {
		await jwtVerify(token, jwks, { audience, issuer });
	};
}

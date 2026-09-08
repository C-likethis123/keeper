import assert from "node:assert/strict";
import { test } from "node:test";
import { createCloudflareAccessVerifier } from "./cloudflareAccess.js";

test("Cloudflare Access verifier rejects an invalid token", async () => {
	const verify = createCloudflareAccessVerifier({
		audience: "keeper-audience",
		teamDomain: "https://keeper.cloudflareaccess.com",
	});

	await assert.rejects(() => verify("not-a-jwt"));
});

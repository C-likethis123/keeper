export default {
	async fetch(request, env) {
		const incomingUrl = new URL(request.url);
		const targetUrl = new URL(
			`http://api:8787${incomingUrl.pathname}${incomingUrl.search}`,
		);
		const headers = new Headers(request.headers);
		// Cloudflare does not guarantee cf-* request headers survive every Worker
		// service-binding/VPC hop. Preserve the verified Access assertion under an
		// application-owned name for the private API.
		const accessAssertion =
			headers.get("x-keeper-access-jwt-assertion") ??
			headers.get("cf-access-jwt-assertion");
		if (accessAssertion) {
			headers.set("x-keeper-access-jwt-assertion", accessAssertion);
		}
		headers.delete("origin");
		headers.set("x-keeper-private-proxy-token", env.KEEPER_PRIVATE_PROXY_TOKEN);

		const upstream = new Request(targetUrl, {
			body: request.body,
			headers,
			method: request.method,
		});
		return env.PRIVATE_API.fetch(upstream);
	},
};

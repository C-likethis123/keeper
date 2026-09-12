export default {
	async fetch(request, env) {
		const incomingUrl = new URL(request.url);
		const targetUrl = new URL(
			`http://api:8787${incomingUrl.pathname}${incomingUrl.search}`,
		);
		const headers = new Headers(request.headers);
		headers.delete("cf-access-jwt-assertion");
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

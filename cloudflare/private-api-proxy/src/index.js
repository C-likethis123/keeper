export default {
	async fetch(request, env) {
		const headers = new Headers(request.headers);
		headers.delete("cf-access-jwt-assertion");
		headers.delete("origin");
		headers.set(
			"x-keeper-private-proxy-token",
			env.KEEPER_PRIVATE_PROXY_TOKEN,
		);

		const upstream = new Request(request, { headers });
		return env.PRIVATE_API.fetch(upstream);
	},
};

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (!url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		url.pathname = url.pathname.slice("/api".length) || "/";
		return env.PRIVATE_API_PROXY.fetch(new Request(url, request));
	},
};

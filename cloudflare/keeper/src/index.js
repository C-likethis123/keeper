export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.pathname === "/auth/callback") {
			return new Response(
				`<!doctype html><meta name="viewport" content="width=device-width"><script>location.replace("native://auth/callback" + location.search)</script>`,
				{
					headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
				},
			);
		}
		if (!url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		url.pathname = url.pathname.slice("/api".length) || "/";
		return env.PRIVATE_API_PROXY.fetch(new Request(url, request));
	},
};

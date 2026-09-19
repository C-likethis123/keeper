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

		const headers = new Headers(request.headers);
		// Service bindings can remove Cloudflare-owned cf-* headers. Copy the
		// assertion injected by Access before the first internal hop. Delete any
		// caller-controlled value of the application-owned header first.
		headers.delete("x-keeper-access-jwt-assertion");
		const accessAssertion = headers.get("cf-access-jwt-assertion");
		if (accessAssertion) {
			headers.set("x-keeper-access-jwt-assertion", accessAssertion);
		}
		url.pathname = url.pathname.slice("/api".length) || "/";
		return env.PRIVATE_API_PROXY.fetch(
			new Request(url, {
				body: request.body,
				headers,
				method: request.method,
			}),
		);
	},
};

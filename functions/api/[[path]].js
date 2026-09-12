export async function onRequest(context) {
	const url = new URL(context.request.url);
	url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";

	const request = new Request(url, context.request);
	return context.env.PRIVATE_API_PROXY.fetch(request);
}

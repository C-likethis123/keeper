import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(server: FastifyInstance) {
	server.get(
		"/health",
		{
			config: {
				rateLimit: false,
			},
		},
		async () => ({
			ok: true,
		}),
	);
}

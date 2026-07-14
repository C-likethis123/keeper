import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { GitHubSeedService } from "../github/seedService.js";
import type { SyncRepository } from "../sync/types.js";

const seedRequestSchema = z.object({
	repository: z.string().min(1),
	ref: z.string().min(1),
	sha: z.string().min(1),
	proceedIfDbHasData: z.boolean().default(false),
});

export type GitHubRouteDependencies = {
	syncRepository: SyncRepository;
	seedToken: string;
	seedService: GitHubSeedService;
};

export function registerGitHubRoutes(
	server: FastifyInstance,
	dependencies: GitHubRouteDependencies,
) {
	server.post("/github/seed", async (request, reply) => {
		const authorization = request.headers.authorization ?? "";
		if (authorization !== `Bearer ${dependencies.seedToken}`) {
			return reply.code(401).send({ error: "unauthorized" });
		}

		const parsed = seedRequestSchema.safeParse(request.body);
		if (!parsed.success) {
			return reply.code(400).send({
				error: "invalid_github_seed",
				issues: parsed.error.issues,
			});
		}

		if (
			!parsed.data.proceedIfDbHasData &&
			(await dependencies.syncRepository.hasNotes())
		) {
			return reply.code(409).send({
				error: "server_db_has_data",
				message:
					"Server DB already has notes. Re-run with proceedIfDbHasData=true to seed anyway.",
			});
		}

		const result = await dependencies.seedService.seed(parsed.data);
		request.log.info(
			{
				accepted: result.accepted.length,
				duplicateCount: result.duplicates.length,
				noteCount: result.noteCount,
				repository: parsed.data.repository,
				sha: parsed.data.sha,
			},
			"github seed completed",
		);

		return reply.code(202).send(result);
	});
}

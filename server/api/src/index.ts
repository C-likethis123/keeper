import { createServer } from "./server.js";
import { createPgSyncRepository } from "./sync/pgSyncRepository.js";

const port = Number(process.env.PORT ?? 8787);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is required");
}

const server = createServer({
	syncRepository: createPgSyncRepository(databaseUrl),
});

await server.listen({ host: "0.0.0.0", port });

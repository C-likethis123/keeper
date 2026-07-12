import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ClusterRepository, ClustersJson } from "../clusters/types.js";
import type { ServerJob } from "../jobs/types.js";

const execFileAsync = promisify(execFile);

type MocWorkerConfig = {
	notesRoot: string;
	pipelinePath: string;
	pythonBin?: string;
	clusterRepository: ClusterRepository;
};

function requiredString(value: unknown, name: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${name} is required`);
	}
	return value;
}

async function exportFeedback(
	notesRoot: string,
	clusterRepository: ClusterRepository,
): Promise<void> {
	const feedback = await clusterRepository.listFeedback();
	await mkdir(notesRoot, { recursive: true });
	await writeFile(
		path.join(notesRoot, ".moc_feedback.json"),
		JSON.stringify(
			{
				version: 1,
				events: feedback.map((event) => ({
					cluster_id: event.clusterId,
					event_type: event.eventType,
					event_data: event.eventData,
					created_at: event.createdAt,
				})),
			},
			null,
			2,
		),
		"utf8",
	);
}

export function createMocClassificationProcessor(config: MocWorkerConfig) {
	return async function processMocClassification(_job: ServerJob): Promise<void> {
		await exportFeedback(config.notesRoot, config.clusterRepository);
		await execFileAsync(config.pythonBin ?? "python3", [
			config.pipelinePath,
			config.notesRoot,
		]);

		const raw = await readFile(
			path.join(config.notesRoot, ".moc_clusters.json"),
			"utf8",
		);
		const parsed = JSON.parse(raw) as ClustersJson;
		if (!Array.isArray(parsed.clusters)) {
			throw new Error("MOC pipeline output missing clusters");
		}
		await config.clusterRepository.importClusters(parsed);
	};
}

export function createMocClassificationProcessorFromEnv(
	clusterRepository: ClusterRepository,
) {
	return createMocClassificationProcessor({
		notesRoot: requiredString(process.env.SERVER_GIT_REPO_DIR, "SERVER_GIT_REPO_DIR"),
		pipelinePath:
			process.env.MOC_PIPELINE_PATH ??
			path.resolve(process.cwd(), "../../scripts/moc_pipeline/pipeline.py"),
		pythonBin: process.env.PYTHON_BIN ?? "python3",
		clusterRepository,
	});
}

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ClusterRepository, ClustersJson } from "../clusters/types.js";
import type { ServerJob } from "../jobs/types.js";

const execFileAsync = promisify(execFile);

type MocWorkerConfig = {
	notesRoot: string;
	artifactsRoot?: string;
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
	feedbackPath: string,
	clusterRepository: ClusterRepository,
): Promise<void> {
	const feedback = await clusterRepository.listFeedback();
	await mkdir(path.dirname(feedbackPath), { recursive: true });
	await writeFile(
		feedbackPath,
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
		const artifactsRoot = config.artifactsRoot ?? config.notesRoot;
		const feedbackPath = path.join(artifactsRoot, ".moc_feedback.json");
		const outputPath = path.join(artifactsRoot, ".moc_clusters.json");
		await exportFeedback(feedbackPath, config.clusterRepository);
		await execFileAsync(
			config.pythonBin ?? "python3",
			[config.pipelinePath, config.notesRoot],
			{
				env: {
					...process.env,
					MOC_CACHE_DIR: path.join(artifactsRoot, ".moc_cache"),
					MOC_FEEDBACK_PATH: feedbackPath,
					MOC_OUTPUT_PATH: outputPath,
				},
			},
		);

		const raw = await readFile(outputPath, "utf8");
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
		artifactsRoot: process.env.MOC_ARTIFACTS_DIR ?? "/data/moc",
		pipelinePath:
			process.env.MOC_PIPELINE_PATH ??
			path.resolve(process.cwd(), "../../scripts/moc_pipeline/pipeline.py"),
		pythonBin: process.env.PYTHON_BIN ?? "python3",
		clusterRepository,
	});
}

type StartupTelemetryValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| Record<string, unknown>
	| unknown[];

type StartupTelemetryPayload = Record<string, StartupTelemetryValue>;

const STARTUP_TRACE_RUN_ID_KEY = "__keeperStartupTraceRunId";

function shouldLogStartupTrace(): boolean {
	return typeof __DEV__ === "undefined" ? false : __DEV__;
}

function logStartupTrace(payload: StartupTelemetryPayload): void {
	if (!shouldLogStartupTrace()) return;
	console.log("[StartupTrace]", payload);
}

function getExecutionContext(): "server" | "client" {
	return typeof window === "undefined" || typeof document === "undefined"
		? "server"
		: "client";
}

function currentTimestampMs(): number {
	return Math.round(performance.now());
}

function createRunId(): string {
	return `startup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getOrCreateRunId(): string {
	const globalState = globalThis as typeof globalThis & {
		[STARTUP_TRACE_RUN_ID_KEY]?: string;
	};
	const existing = globalState[STARTUP_TRACE_RUN_ID_KEY];
	if (existing) {
		return existing;
	}

	const runId = createRunId();
	globalState[STARTUP_TRACE_RUN_ID_KEY] = runId;
	return runId;
}

function serializeError(error: unknown): StartupTelemetryPayload {
	if (error instanceof Error) {
		return {
			errorName: error.name,
			errorMessage: error.message,
		};
	}

	return {
		errorMessage: String(error),
	};
}

export interface StartupTelemetry {
	runId: string;
	runtime: string;
	trace(event: string, payload?: StartupTelemetryPayload): void;
	stepStarted(step: string, payload?: StartupTelemetryPayload): number;
	stepCompleted(
		step: string,
		startedAt: number,
		payload?: StartupTelemetryPayload,
	): void;
	stepFailed(
		step: string,
		startedAt: number,
		error: unknown,
		payload?: StartupTelemetryPayload,
	): void;
}

export function traceStartupBootstrapEvent(
	event: string,
	payload: StartupTelemetryPayload = {},
): void {
	logStartupTrace({
		runId: getOrCreateRunId(),
		runtime: "bootstrap",
		event,
		timestampMs: currentTimestampMs(),
		executionContext: getExecutionContext(),
		...payload,
	});
}

function createTelemetry(
	runtime: string,
	traceImpl: (event: string, payload?: StartupTelemetryPayload) => void,
): StartupTelemetry {
	return {
		runId: createRunId(),
		runtime,
		trace: traceImpl,
		stepStarted(step, payload = {}) {
			const startedAt = performance.now();
			traceImpl("step_started", {
				step,
				...payload,
			});
			return startedAt;
		},
		stepCompleted(step, startedAt, payload = {}) {
			traceImpl("step_completed", {
				step,
				durationMs: Math.round(performance.now() - startedAt),
				...payload,
			});
		},
		stepFailed(step, startedAt, error, payload = {}) {
			traceImpl("step_failed", {
				step,
				durationMs: Math.round(performance.now() - startedAt),
				...serializeError(error),
				...payload,
			});
		},
	};
}

export function createStartupTelemetry(runtime: string): StartupTelemetry {
	const runId = getOrCreateRunId();

	return {
		runId,
			runtime,
			trace(event, payload = {}) {
				logStartupTrace({
					runId,
					runtime,
					event,
				timestampMs: currentTimestampMs(),
				executionContext: getExecutionContext(),
				...payload,
			});
			},
			stepStarted(step, payload = {}) {
				const startedAt = performance.now();
				logStartupTrace({
					runId,
					runtime,
					event: "step_started",
				step,
				timestampMs: currentTimestampMs(),
				executionContext: getExecutionContext(),
				...payload,
			});
			return startedAt;
			},
			stepCompleted(step, startedAt, payload = {}) {
				logStartupTrace({
					runId,
					runtime,
					event: "step_completed",
				step,
				durationMs: Math.round(performance.now() - startedAt),
				timestampMs: currentTimestampMs(),
				executionContext: getExecutionContext(),
				...payload,
			});
			},
			stepFailed(step, startedAt, error, payload = {}) {
				logStartupTrace({
					runId,
					runtime,
					event: "step_failed",
				step,
				durationMs: Math.round(performance.now() - startedAt),
				timestampMs: currentTimestampMs(),
				executionContext: getExecutionContext(),
				...serializeError(error),
				...payload,
			});
		},
	};
}

export function createNoopStartupTelemetry(
	runtime = "unknown",
): StartupTelemetry {
	return createTelemetry(runtime, () => {});
}

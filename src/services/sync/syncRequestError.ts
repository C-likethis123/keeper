export class SyncRequestError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly retryAfterMs: number | null = null,
	) {
		super(message);
		this.name = "SyncRequestError";
	}
}

export class SyncAuthRequiredError extends SyncRequestError {
	constructor(message: string, status: 401 | 403) {
		super(message, status);
		this.name = "SyncAuthRequiredError";
	}
}

export function parseRetryAfter(
	value: string | null,
	now = Date.now(),
): number | null {
	if (!value) return null;

	const seconds = Number(value);
	if (Number.isFinite(seconds) && seconds >= 0) {
		return Math.ceil(seconds * 1000);
	}

	const date = Date.parse(value);
	return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

export async function createSyncRequestError(
	response: Response,
	operation: string,
): Promise<SyncRequestError> {
	const body = await response.text().catch(() => "");
	const message = `${operation} failed with ${response.status}${body ? `: ${body}` : ""}`;
	if (response.status === 401 || response.status === 403) {
		return new SyncAuthRequiredError(message, response.status);
	}
	return new SyncRequestError(
		message,
		response.status,
		parseRetryAfter(response.headers.get("Retry-After")),
	);
}

export function isSyncAuthRequiredError(
	error: unknown,
): error is SyncAuthRequiredError {
	return error instanceof SyncAuthRequiredError;
}

export function isSyncRequestError(error: unknown): error is SyncRequestError {
	return error instanceof SyncRequestError;
}

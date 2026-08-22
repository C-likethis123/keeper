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
	return new SyncRequestError(
		`${operation} failed with ${response.status}${body ? `: ${body}` : ""}`,
		response.status,
		parseRetryAfter(response.headers.get("Retry-After")),
	);
}

export function isSyncRequestError(error: unknown): error is SyncRequestError {
	return error instanceof SyncRequestError;
}

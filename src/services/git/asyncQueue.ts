export class AsyncQueue {
	private queue: Promise<void> = Promise.resolve();

	async run<T>(task: () => Promise<T>): Promise<T> {
		const result = (async () => {
			await this.queue;
			return task();
		})();

		this.queue = result.then(
			() => {},
			() => {},
		);

		return result;
	}
}

/**
 * Generic request batching utility that collects multiple rapid calls within a
 * configurable time window (debounce/microtask buffer) and executes them in a
 * single batch request.
 */

export type BatcherOptions<TItem> = {
	/** Debounce wait time (ms) after the last item is queued before flushing (default: 300ms) */
	delayMs?: number;
	/** Max wait time (ms) since the first queued item before forcing a flush (default: 1200ms) */
	maxWaitMs?: number;
	/** Max number of items before triggering an immediate flush (default: 100) */
	maxBatchSize?: number;
	/** Optional key function to deduplicate requests in the same batch window (latest state wins) */
	getKey?: (item: TItem) => string;
};

export class RequestBatcher<TItem, TResult = unknown> {
	private queue: Array<{
		item: TItem;
		resolve: (val: TResult) => void;
		reject: (err: unknown) => void;
	}> = [];
	private timer: ReturnType<typeof setTimeout> | null = null;
	private firstItemTime: number | null = null;
	private batchFn: (items: TItem[]) => Promise<TResult[] | TResult>;
	private delayMs: number;
	private maxWaitMs: number;
	private maxBatchSize: number;
	private getKey?: (item: TItem) => string;

	constructor(
		batchFn: (items: TItem[]) => Promise<TResult[] | TResult>,
		options?: BatcherOptions<TItem>,
	) {
		this.batchFn = batchFn;
		this.delayMs = options?.delayMs ?? 300;
		this.maxWaitMs = options?.maxWaitMs ?? 1200;
		this.maxBatchSize = options?.maxBatchSize ?? 100;
		this.getKey = options?.getKey;
	}

	/**
	 * Schedule an item to be processed in the next batch.
	 * Returns a Promise that resolves when the entire batch completes.
	 */
	schedule(item: TItem): Promise<TResult> {
		return new Promise<TResult>((resolve, reject) => {
			if (this.getKey) {
				const getKeyFn = this.getKey;
				const key = getKeyFn(item);
				const existingIndex = this.queue.findIndex(
					(entry) => getKeyFn(entry.item) === key,
				);
				if (existingIndex !== -1) {
					// Replace with latest payload, and chain resolvers
					const prev = this.queue[existingIndex];
					this.queue[existingIndex] = {
						item,
						resolve: (val) => {
							prev.resolve(val);
							resolve(val);
						},
						reject: (err) => {
							prev.reject(err);
							reject(err);
						},
					};
					this.scheduleTimer();
					return;
				}
			}

			this.queue.push({ item, resolve, reject });

			if (this.queue.length >= this.maxBatchSize) {
				void this.flush();
			} else {
				this.scheduleTimer();
			}
		});
	}

	private scheduleTimer(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		const now = Date.now();
		if (!this.firstItemTime) {
			this.firstItemTime = now;
		}

		const timeSinceFirst = now - this.firstItemTime;
		const remainingMaxWait = Math.max(0, this.maxWaitMs - timeSinceFirst);
		const waitTime = Math.min(this.delayMs, remainingMaxWait);

		this.timer = setTimeout(() => {
			void this.flush();
		}, waitTime);
	}

	/**
	 * Immediately flush any currently queued items.
	 */
	async flush(): Promise<void> {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.firstItemTime = null;

		if (this.queue.length === 0) return;

		const currentBatch = this.queue;
		this.queue = [];

		const items = currentBatch.map((entry) => entry.item);

		try {
			const result = await this.batchFn(items);
			if (Array.isArray(result) && result.length === currentBatch.length) {
				for (let i = 0; i < currentBatch.length; i++) {
					currentBatch[i].resolve(result[i]);
				}
			} else {
				for (const entry of currentBatch) {
					entry.resolve(result as TResult);
				}
			}
		} catch (error) {
			for (const entry of currentBatch) {
				entry.reject(error);
			}
		}
	}

	/**
	 * Clear any pending items in the queue without processing them.
	 */
	clear(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.firstItemTime = null;
		this.queue = [];
	}
}

export function createBatcher<TItem, TResult = unknown>(
	batchFn: (items: TItem[]) => Promise<TResult[] | TResult>,
	options?: BatcherOptions<TItem>,
): RequestBatcher<TItem, TResult> {
	return new RequestBatcher(batchFn, options);
}

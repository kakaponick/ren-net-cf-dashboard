const DYNADOT_MIN_INTERVAL_MS = 1000;

const dynadotQueueByAccount = new Map<string, Promise<unknown>>();
const dynadotLastRequestAtByAccount = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runDynadotRateLimitedRequest<T>(
	accountId: string,
	task: () => Promise<T>
): Promise<T> {
	const previous = dynadotQueueByAccount.get(accountId) ?? Promise.resolve();

	const next = previous
		.catch(() => undefined)
		.then(async () => {
			const lastRequestAt = dynadotLastRequestAtByAccount.get(accountId) ?? 0;
			const elapsed = Date.now() - lastRequestAt;
			const waitMs = Math.max(0, DYNADOT_MIN_INTERVAL_MS - elapsed);

			if (waitMs > 0) {
				await sleep(waitMs);
			}

			dynadotLastRequestAtByAccount.set(accountId, Date.now());
			return task();
		});

	dynadotQueueByAccount.set(accountId, next.catch(() => undefined));
	return next;
}

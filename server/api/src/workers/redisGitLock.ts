import net from "node:net";

function encodeCommand(parts: string[]): string {
	return `*${parts.length}\r\n${parts
		.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
		.join("")}`;
}

async function redisCommand(redisUrl: string, parts: string[]): Promise<string> {
	const url = new URL(redisUrl);
	const socket = net.createConnection({
		host: url.hostname,
		port: Number(url.port || 6379),
	});

	return new Promise((resolve, reject) => {
		let data = "";
		socket.setTimeout(5000);
		socket.on("connect", () => socket.write(encodeCommand(parts)));
		socket.on("data", (chunk) => {
			data += chunk.toString("utf8");
			socket.end();
		});
		socket.on("end", () => resolve(data));
		socket.on("timeout", () => {
			socket.destroy();
			reject(new Error("Redis lock command timed out"));
		});
		socket.on("error", reject);
	});
}

export async function withRedisGitLock<T>(
	redisUrl: string | undefined,
	task: () => Promise<T>,
): Promise<T> {
	if (!redisUrl) return task();

	const token = `${process.pid}:${Date.now()}:${Math.random().toString(36)}`;
	const response = await redisCommand(redisUrl, [
		"SET",
		"keeper:git-lock",
		token,
		"NX",
		"PX",
		"120000",
	]);
	if (!response.startsWith("+OK")) {
		throw new Error("Git sync lock is already held");
	}

	try {
		return await task();
	} finally {
		await redisCommand(redisUrl, [
			"EVAL",
			"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
			"1",
			"keeper:git-lock",
			token,
		]);
	}
}

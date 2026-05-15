import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const CACHE_PATH = join(homedir(), ".scalekit", "cache", "version-check.json");
const DEFAULT_TTL = 8 * 60 * 60 * 1000; // 8 hours

function ttl(): number {
	const env = process.env.SCALEKIT_CHECK_TTL;
	if (env) {
		const ms = Number(env);
		if (Number.isFinite(ms) && ms > 0) return ms;
	}
	return DEFAULT_TTL;
}

interface CacheEntry {
	value: unknown;
	checkedAt: string;
}

type CacheData = Record<string, CacheEntry>;

async function readCache(): Promise<CacheData> {
	try {
		const raw = await readFile(CACHE_PATH, "utf-8");
		return JSON.parse(raw) as CacheData;
	} catch {
		return {};
	}
}

async function writeCache(data: CacheData): Promise<void> {
	await mkdir(dirname(CACHE_PATH), { recursive: true });
	await writeFile(CACHE_PATH, JSON.stringify(data, null, 2));
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
	const data = await readCache();
	const entry = data[key];
	if (!entry) return undefined;

	const age = Date.now() - new Date(entry.checkedAt).getTime();
	if (age > ttl()) return undefined;

	return entry.value as T;
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
	const data = await readCache();
	data[key] = { value, checkedAt: new Date().toISOString() };
	await writeCache(data);
}

export async function cacheInvalidate(key: string): Promise<void> {
	const data = await readCache();
	delete data[key];
	await writeCache(data);
}

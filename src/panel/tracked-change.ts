import type { HostClient } from "@openchamber/sdk";

const prefix = "session-change:";
const readBatchSize = 32;

export async function readTrackedChange(
  host: HostClient,
  sessionId: string,
): Promise<string | null> {
  const value = await host.storage.get(`${prefix}${sessionId}`);
  return value && typeof value === "object" && "change" in value && typeof value.change === "string"
    ? value.change
    : null;
}

export async function saveTrackedChange(
  host: HostClient,
  sessionId: string,
  change: string,
  current: () => boolean,
) {
  try {
    const keys = (await host.storage.keys()).filter((key) => key.startsWith(prefix));
    if (keys.length >= 1900) {
      const choices: { key: string; savedAt: number }[] = [];
      // Instance storage uses one host request per key; bound the in-flight reads.
      for (let i = 0; i < keys.length; i += readBatchSize) {
        if (!current()) return false;
        const batch = keys.slice(i, i + readBatchSize);
        const values = await Promise.all(
          batch.map(async (key) => ({ key, value: await host.storage.get(key) })),
        );
        for (const { key, value } of values) {
          if (
            value &&
            typeof value === "object" &&
            "savedAt" in value &&
            typeof value.savedAt === "number" &&
            Number.isFinite(value.savedAt)
          )
            choices.push({ key, savedAt: value.savedAt });
        }
      }
      choices.sort((left, right) => left.savedAt - right.savedAt);
      for (const { key } of choices.slice(0, 100)) {
        if (!current()) return false;
        await host.storage.delete(key);
      }
    }
    if (!current()) return false;
    await host.storage.set(`${prefix}${sessionId}`, { change, savedAt: Date.now() });
    return true;
  } catch (caught) {
    console.warn("Could not save the tracked OpenSpec change.", caught);
    return false;
  }
}

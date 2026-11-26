import { CORE_WORKFLOWS, type Workflow } from "../contracts.js";
import type { Client } from "./client.js";

export { CORE_WORKFLOWS };

export async function loadWorkflows(
  client: Client,
  directory: string,
): Promise<ReadonlySet<Workflow>> {
  try {
    return new Set(await client.workflows(directory));
  } catch (caught) {
    console.warn("Could not read OpenSpec workflows; using the core workflows.", caught);
    return new Set(CORE_WORKFLOWS);
  }
}

export function planningWorkflow(set: ReadonlySet<Workflow>) {
  return set.has("ff") ? "ff" : set.has("continue") ? "continue" : "propose";
}

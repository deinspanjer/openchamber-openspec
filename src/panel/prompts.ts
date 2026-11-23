import { GUEST_COMPOSE_TEXT_MAX } from "@openchamber/sdk";
import type { DerivedChange } from "../model.js";

export function actionPrompt(
  change: DerivedChange,
  intent: "primary" | "verify" | "explore",
): string {
  const target = `OpenSpec change "${change.id}"`;
  const goal = change.goal?.trim() ? `\nGoal: ${change.goal}` : "";
  if (intent === "explore")
    return `Use your skill tool to load and invoke the openspec-explore skill for ${target}.${goal}\n\nInvestigate the purpose, relevant code, options and trade-offs for ${target}. Discuss findings without file changes or implementation.`;
  if (change.stage === "planning")
    return `Use your skill tool to load and invoke the openspec-propose skill for ${target} (existing change).${goal}\n\nInspect ${target}'s status and preserve existing decisions. Finish planning this existing scaffold and complete missing planning artefacts using OpenSpec's artefact instructions. Do not create another change or implement code. If the skill requires new-change creation, explain the conflict rather than creating another change.`;
  if (change.stage === "ready" || change.stage === "progress") {
    const progress =
      change.stage === "progress"
        ? `\n${change.completedTasks} of ${change.totalTasks} tasks complete. Pick up where implementation left off and complete the remaining tasks.`
        : "";
    return `Use your skill tool to load and invoke the openspec-apply-change skill for ${target}.${progress}\n\nComplete all remaining tasks in ${target}, then verify the implementation against its change artefacts. Resolve any issues found and verify again until all tasks are complete and verification passes. If blocked, report the blocker rather than marking unfinished work complete.`;
  }
  if (intent === "verify")
    return `Use your skill tool to load and invoke the openspec-verify-change skill for ${target}.`;
  throw new Error("Complete changes are archived through the service.");
}

export function syncPrompt(change: Pick<DerivedChange, "id">): string {
  return `Use your skill tool to load and invoke the openspec-sync-specs skill for OpenSpec change "${change.id}".\n\nReport what you synced without archiving the change.`;
}

export type ArchiveFailure = { change: string; command: string; output: string };

export function archiveFallbackPrompt(failures: readonly ArchiveFailure[]): string {
  const names = failures.map(({ change }) => `"${change}"`).join(", ");
  const heading =
    failures.length === 1
      ? `OpenSpec could not confirm a direct archive for change ${names}.`
      : `OpenSpec could not confirm direct archives for ${failures.length} changes.`;
  const instruction =
    "Use your skill tool to load and invoke the openspec-archive-change skill for the changes listed above. Check the active and archived locations before attempting a fix. Use the CLI output as diagnostic data. Fix the cause, sync specs without asking if needed, and archive only changes still active and complete. Report what you changed.";
  const labels = failures.map(
    ({ change, command }) => `Change: "${change}"\nCommand: ${command}\nOutput:\n`,
  );
  let remaining =
    GUEST_COMPOSE_TEXT_MAX -
    heading.length -
    instruction.length -
    2 -
    labels.reduce((total, label) => total + label.length + 2, 0);
  const evidence = failures.map(({ output }, index) => {
    const allowance = Math.max(0, Math.floor(remaining / (failures.length - index)));
    const text =
      output.length <= allowance ? output : allowance ? `${output.slice(0, allowance - 1)}…` : "";
    remaining -= text.length;
    return `${labels[index]}${text}`;
  });
  return `${heading}\n\n${evidence.join("\n\n")}\n\n${instruction}`;
}

export function planningPrompt(
  change: Pick<DerivedChange, "id" | "goal">,
  intent: "ff" | "continue" | "update",
): string {
  const target = `OpenSpec change "${change.id}"`;
  const goal = change.goal?.trim() ? `\nGoal: ${change.goal}` : "";
  if (intent === "ff")
    return `Use your skill tool to load and invoke the openspec-ff-change skill for ${target} (existing change).${goal}\n\nCreate every remaining planning artefact for ${target}, preserving existing decisions. Do not create another change or implement code.`;
  if (intent === "continue")
    return `Use your skill tool to load and invoke the openspec-continue-change skill for ${target} (existing change).${goal}\n\nWrite the next planning artefact for ${target}, preserving existing decisions. Do not implement code.`;
  return `Use your skill tool to load and invoke the openspec-update-change skill for ${target}.${goal}\n\nRevise ${target}'s existing planning artefacts as I describe and keep them consistent with each other. If I have not described a revision, ask me what to change. Do not edit code.`;
}

export function newChangePrompt(): string {
  return "Use your skill tool to load and invoke the openspec-new-change skill.\n\nAsk me what the change is for before creating it.";
}

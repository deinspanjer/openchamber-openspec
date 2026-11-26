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
  return `Use your skill tool to load and invoke the openspec-archive-change skill for ${target}.`;
}

export function planningPrompt(
  change: Pick<DerivedChange, "id" | "goal">,
  intent: "ff" | "continue",
): string {
  const target = `OpenSpec change "${change.id}"`;
  const goal = change.goal?.trim() ? `\nGoal: ${change.goal}` : "";
  if (intent === "ff")
    return `Use your skill tool to load and invoke the openspec-ff-change skill for ${target} (existing change).${goal}\n\nCreate every remaining planning artefact for ${target}, preserving existing decisions. Do not create another change or implement code.`;
  return `Use your skill tool to load and invoke the openspec-continue-change skill for ${target} (existing change).${goal}\n\nWrite the next planning artefact for ${target}, preserving existing decisions. Do not implement code.`;
}

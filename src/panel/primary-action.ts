import { mountButton, mountMenu } from "@openchamber/sdk/ui";
import type { Stage } from "../model.js";
import { workflowLabel } from "./workflow.js";

type PrimaryWorkflow = ReturnType<typeof workflowLabel>;
export type PrimaryIntent = PrimaryWorkflow | "worktree" | "skip-specs";
type State = {
  id: string;
  stage: Stage;
  workflow: PrimaryWorkflow;
  disabled: boolean;
  pending?: boolean;
  action: (intent: PrimaryIntent) => void;
};

export function mountPrimaryAction(root: HTMLElement, allowSkipSpecs = false) {
  const buttonRoot = document.createElement("span");
  const menuRoot = document.createElement("span");
  buttonRoot.className = "primary-action-button";
  menuRoot.className = "primary-action-menu";
  root.append(buttonRoot, menuRoot);
  let state: State | null = null;
  let opened: State | null = null;
  const button = mountButton(buttonRoot, {
    label: "propose",
    size: "sm",
    onClick: () => {
      if (state) state.action(state.workflow);
    },
  });
  const menu = mountMenu(menuRoot, {
    label: "apply",
    size: "sm",
    variant: "default",
    items: [],
    onSelect: (id) => {
      const captured = opened;
      opened = null;
      if (
        !captured ||
        captured.disabled ||
        state?.disabled ||
        captured.id !== state?.id ||
        captured.stage !== state?.stage ||
        ((id === "worktree" || id === "skip-specs") && state?.pending)
      )
        return;
      captured.action(id === "worktree" || id === "skip-specs" ? id : captured.workflow);
    },
  });
  const trigger = menuRoot.querySelector("button")!;
  const capture = () => {
    if (trigger.getAttribute("aria-expanded") !== "true") opened = state;
  };
  trigger.addEventListener("click", capture, true);
  return {
    update(next: State) {
      state = next;
      const apply = next.stage === "ready" || next.stage === "progress";
      const complete = next.stage === "complete";
      const splitArchive = complete && allowSkipSpecs;
      const disabled = next.disabled || (complete && !!next.pending);
      buttonRoot.hidden = apply;
      menuRoot.hidden = !apply && !splitArchive;
      root.classList.toggle("archive-split", splitArchive);
      button.update({ label: next.workflow, disabled });
      menu.update({
        label: splitArchive ? "⌄" : "apply",
        items: splitArchive
          ? [{ id: "skip-specs", label: "archive without sync", disabled }]
          : [
              { id: "current", label: "Prepare in current chat", disabled: next.disabled },
              {
                id: "worktree",
                label: "Run in new worktree",
                disabled: next.disabled || next.pending,
              },
            ],
      });
      if (splitArchive) trigger.setAttribute("aria-label", "More archive actions");
      else trigger.removeAttribute("aria-label");
      trigger.disabled = disabled;
    },
    dispose() {
      trigger.removeEventListener("click", capture, true);
      menu.dispose();
      button.dispose();
      buttonRoot.remove();
      menuRoot.remove();
      opened = state = null;
    },
  };
}

import { connectHost, HostRequestError, type GuestSessionsSnapshot } from "@openchamber/sdk";
import { applyHostReady, mountButton, mountPopoverAnchor } from "@openchamber/sdk/ui";
import type { ListingEntry, Task } from "./contracts.js";
import { deriveChange, taskWindow, type DerivedChange, type Stage } from "./model.js";
import { createClient, type Listing } from "./panel/client.js";
import { applyDevice } from "./panel/device.js";
import { findProject } from "./panel/project.js";
import { actionPrompt } from "./panel/prompts.js";
import {
  appendTrackedChange,
  readTrackedChanges,
  resolveSessionChanges,
  updateTrackedChanges,
} from "./panel/tracked-change.js";
import { stageLabel } from "./panel/workflow.js";

type View =
  | { kind: "empty" | "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; listing: Listing; cards: Card[] };
type Card = { id: string; change: DerivedChange; tasks: Task[] } | { id: string; message: string };
type ChangeFlyout = { kind: "change"; name: string; stage: Stage; goal: string | null };
type TaskFlyout = { kind: "task"; id: string; description: string };
type Flyout = ChangeFlyout | TaskFlyout;

const root = document.querySelector<HTMLElement>("#root");
if (!root) throw new Error("Status section root is missing");
const host = connectHost();
const client = createClient(host);
const panelRoot = root;

let directory: string | null = null;
let sessionId: string | null = null;
let turnStarted = false;
let epoch = 0;
let projectEpoch = 0;
let sessions: GuestSessionsSnapshot | null = null;
let offSessions: (() => void) | undefined;
let workspace: Promise<void> | undefined;
let disposed = false;
let reading = false;
let queued = false;
let selection: { active: Set<string>; saved: string[] | null; changes: string[] } | null = null;
let hasStatusControls = false;
let hasPopovers = false;
let popoverFrame = false;
let headerRequest = 0;
const notes = document.createElement("div");
const content = document.createElement("div");
content.className = "section-content";
const controls = document.createElement("div");
controls.className = "section-controls";
for (const element of [notes, content, controls]) element.hidden = true;
panelRoot.append(notes, content, controls);

const bodyRefresh = document.createElement("div");
const pickerRoot = document.createElement("div");
const picker = document.createElement("div");
picker.className = "section-picker";
picker.id = "section-picker";
picker.hidden = true;
const choices = document.createElement("ul");
choices.setAttribute("aria-label", "Changes");
const emptyChoices = document.createElement("p");
emptyChoices.className = "note";
emptyChoices.textContent = "No untracked changes.";
picker.append(choices, emptyChoices);
panelRoot.append(picker);
controls.append(bodyRefresh);
const refreshButton = mountButton(bodyRefresh, { label: "Refresh", size: "sm", onClick: refresh });
controls.append(pickerRoot);
const pickerButton = mountButton(pickerRoot, {
  label: "＋ Track a change",
  size: "sm",
  variant: "secondary",
  onClick: () => setPickerOpen(picker.hidden === true),
});
const pickerTrigger = pickerRoot.querySelector("button")!;
pickerTrigger.setAttribute("aria-controls", picker.id);
pickerTrigger.setAttribute("aria-expanded", "false");
let optionButtons: ReturnType<typeof mountButton>[] = [];
const cancelRoot = document.createElement("div");
picker.append(cancelRoot);
const cancelPicker = mountButton(cancelRoot, {
  label: "Cancel",
  size: "sm",
  variant: "secondary",
  onClick: () => setPickerOpen(false),
});
let pickerKey = "";
let viewKey = "";
const mountedCards = new Map<string, ReturnType<typeof mountTrackedCard>>();

function setPickerOpen(open: boolean, restoreFocus = true) {
  picker.hidden = !open;
  pickerTrigger.setAttribute("aria-expanded", String(open));
  if (open) choices.querySelector<HTMLElement>("button:enabled")?.focus();
  else if (restoreFocus) pickerTrigger.focus();
}

function escapePicker(event: KeyboardEvent) {
  if (event.key !== "Escape" || picker.hidden) return;
  event.preventDefault();
  event.stopPropagation();
  setPickerOpen(false);
}

panelRoot.addEventListener("keydown", escapePicker);

function captureContext() {
  const capturedEpoch = epoch;
  return () => !disposed && epoch === capturedEpoch;
}

function render(view: View) {
  const nextViewKey = JSON.stringify([epoch, view]);
  if (viewKey === nextViewKey) return;
  viewKey = nextViewKey;
  controls.hidden = view.kind === "empty" || view.kind === "loading";
  const cards = view.kind === "ready" ? view.cards : [];
  content.hidden = !cards.length;
  for (const [id, mounted] of mountedCards) {
    if (cards.some((card) => card.id === id)) continue;
    mounted.dispose();
    mountedCards.delete(id);
  }
  for (const [index, card] of cards.entries()) {
    let mounted = mountedCards.get(card.id);
    if (!mounted) {
      mounted = mountTrackedCard(card.id);
      mountedCards.set(card.id, mounted);
    }
    const previous = content.children.item(index);
    if (previous !== mounted.element) content.insertBefore(mounted.element, previous);
    mounted.update(card);
  }
  notes.replaceChildren();
  if (view.kind === "ready") {
    if (!sessionId) note("Start a session to track a change.");
    if (!view.listing.changes.length) note("No active changes.");
  } else if (view.kind === "error") {
    note(view.message, "alert");
  } else if (view.kind === "loading") {
    note("Loading OpenSpec change…", "status");
  }
  notes.hidden = !notes.childElementCount;
  pickerRoot.hidden = view.kind !== "ready";
  cancelRoot.hidden = !cards.length;
  if (view.kind === "ready")
    updatePicker(
      view.listing,
      cards.map(({ id }) => id),
    );
  else setPickerOpen(false, false);
}

function pickerPriority({ completedTasks, totalTasks }: ListingEntry) {
  if (!totalTasks) return 2;
  if (!completedTasks) return 1;
  return completedTasks < totalTasks ? 0 : 3;
}

function updatePicker(listing: Listing, tracked: string[]) {
  const items = [...listing.changes]
    .filter(({ id }) => !tracked.includes(id))
    .sort((left, right) => pickerPriority(left) - pickerPriority(right))
    .map(({ id }) => id);
  const nextKey = JSON.stringify([sessionId, items]);
  if (pickerKey === nextKey) return;
  pickerKey = nextKey;
  pickerButton.update({ disabled: !sessionId });
  emptyChoices.hidden = items.length !== 0;
  const focused = choices.contains(document.activeElement)
    ? document.activeElement?.textContent
    : null;
  for (const button of optionButtons) button.dispose();
  choices.replaceChildren();
  optionButtons = items.map((id) => {
    const row = document.createElement("li");
    choices.append(row);
    const button = mountButton(row, {
      label: id,
      size: "sm",
      variant: "secondary",
      onClick: () => {
        const session = sessionId;
        const current = captureContext();
        if (!session || !current()) return;
        setPickerOpen(false);
        void (async () => {
          const saved = await appendTrackedChange(host, session, id, current, seedTrackedChanges);
          if (!current()) return;
          if (saved) read();
          else await showError(current, null, "Could not save the tracked OpenSpec change.");
        })();
      },
    });
    if (focused === id) row.querySelector("button")?.focus();
    return button;
  });
  if (focused && !choices.contains(document.activeElement))
    (choices.querySelector<HTMLElement>("button:enabled") ?? pickerTrigger).focus();
}

function seedTrackedChanges() {
  return selection ? resolveSessionChanges(sessionId, sessions, null, selection.active) : [];
}

async function showError(current: () => boolean, caught: unknown, fallback: string) {
  if (!current()) return;
  await host
    .toast({
      kind: "error",
      message: caught instanceof HostRequestError ? caught.message : fallback,
    })
    .catch((error: unknown) => console.warn("Could not show the OpenSpec error.", error));
}

async function preparePrompt(change: DerivedChange, current: () => boolean) {
  if (!current()) return;
  const session = sessionId;
  try {
    await host.compose({ text: actionPrompt(change, "primary"), mode: "replace" });
    if (!current()) return;
    if (session) void appendTrackedChange(host, session, change.id, current, seedTrackedChanges);
    await host.toast({
      kind: "success",
      message: "Workflow prompt prepared in the open composer.",
    });
  } catch (caught) {
    await showError(current, caught, "The workflow prompt could not be prepared.");
  }
}

function mountTaskTitle() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "flyout-trigger task-title";
  const inline = document.createElement("div");
  inline.hidden = true;
  let task: Task | null = null;
  const flyout = mountFlyout(button, inline, () => (task ? taskFlyout(task) : null));
  return {
    button,
    inline,
    update(next: Task | null) {
      if (task?.id !== next?.id) flyout.reset();
      task = next;
      const title = task?.description.split("\n", 1)[0] ?? "";
      if (button.textContent !== title) button.textContent = title;
      if (task) flyout.update();
    },
    refreshAnchor: flyout.update,
    dispose: flyout.dispose,
  };
}

type TaskRow = {
  row: HTMLLIElement;
  checkbox: HTMLInputElement;
  title: ReturnType<typeof mountTaskTitle>;
};

function mountTrackedCard(id: string) {
  const element = document.createElement("article");
  element.className = "status-card";
  const heading = document.createElement("div");
  heading.className = "section-heading";
  const title = document.createElement("h1");
  const nameButton = document.createElement("button");
  nameButton.type = "button";
  nameButton.className = "flyout-trigger";
  nameButton.textContent = id;
  title.append(nameButton);
  heading.append(title);
  const inline = document.createElement("div");
  inline.hidden = true;
  let change: DerivedChange | null = null;
  const nameAnchor = mountFlyout(nameButton, inline, () => (change ? changeFlyout(change) : null));
  const count = document.createElement("span");
  heading.append(count);
  const meter = document.createElement("progress");
  meter.className = "section-progress";
  meter.setAttribute("aria-label", "Task completion");
  meter.max = 100;
  const disclosure = document.createElement("details");
  const summary = document.createElement("summary");
  const tasksLabel = document.createElement("span");
  tasksLabel.className = "tasks-label";
  tasksLabel.textContent = "Tasks:";
  const currentTask = mountTaskTitle();
  summary.append(tasksLabel, currentTask.button);
  const taskList = document.createElement("ul");
  taskList.className = "task-window";
  disclosure.append(summary, taskList);
  let taskKey: string | null = null;
  let taskRows = new Map<string, TaskRow>();
  const actions = document.createElement("div");
  actions.className = "card-actions";
  const primary = mountButton(actions, {
    label: "",
    size: "sm",
    onClick: () => {
      if (change) void preparePrompt(change, captureContext());
    },
  });
  const sync = mountButton(actions, {
    label: "sync",
    size: "sm",
    variant: "secondary",
    disabled: true,
    onClick: () => {},
  });
  const validate = mountButton(actions, {
    label: "validate",
    size: "sm",
    variant: "secondary",
    disabled: true,
    onClick: () => {},
  });
  const board = mountButton(actions, {
    label: "board",
    size: "sm",
    variant: "secondary",
    onClick: () => {
      const current = captureContext();
      void host
        .openSurface("plugin:openspec-board")
        .catch((caught: unknown) =>
          showError(current, caught, "Could not open the OpenSpec board."),
        );
    },
  });
  const details = document.createElement("div");
  details.className = "section-content";
  details.append(heading, inline, meter, disclosure, currentTask.inline, actions);
  const error = document.createElement("p");
  error.setAttribute("role", "alert");
  element.append(details, error);
  return {
    element,
    refreshAnchor() {
      nameAnchor.update();
      if (taskKey !== null) currentTask.refreshAnchor();
      for (const { title } of taskRows.values()) title.refreshAnchor();
    },
    update(card: Card) {
      details.hidden = "message" in card;
      error.hidden = !details.hidden;
      if ("message" in card) {
        error.textContent = card.message;
        change = null;
        return;
      }
      change = card.change;
      nameAnchor.update();
      primary.update({
        label:
          change.stage === "planning"
            ? "propose"
            : change.stage === "complete"
              ? "archive"
              : "apply",
      });
      const { completedTasks, totalTasks } = change;
      const percentage = totalTasks ? (100 * completedTasks) / totalTasks : 0;
      meter.value = percentage;
      meter.setAttribute("aria-valuenow", String(percentage));
      count.textContent = `${completedTasks}/${totalTasks}`;

      const next = card.tasks.find((task) => !task.done) ?? card.tasks.at(-1) ?? null;
      const nextKey = next?.id ?? null;
      if (nextKey !== taskKey) disclosure.open = false;
      taskKey = nextKey;
      disclosure.hidden = !next;
      currentTask.update(next);
      const rows = new Map<string, TaskRow>();
      for (const [index, task] of taskWindow(card.tasks).entries()) {
        let item = taskRows.get(task.id);
        if (!item) {
          const row = document.createElement("li");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.disabled = true;
          checkbox.setAttribute("aria-label", "Task completion");
          const title = mountTaskTitle();
          row.append(checkbox, title.button, title.inline);
          item = { row, checkbox, title };
        }
        item.checkbox.checked = task.done;
        item.title.update(task);
        rows.set(task.id, item);
        const previous = taskList.children.item(index);
        if (previous !== item.row) taskList.insertBefore(item.row, previous);
      }
      for (const [id, item] of taskRows) {
        if (rows.has(id)) continue;
        item.title.dispose();
        item.row.remove();
      }
      taskRows = rows;
    },
    dispose() {
      nameAnchor.dispose();
      currentTask.dispose();
      for (const { title } of taskRows.values()) title.dispose();
      for (const handle of [primary, sync, validate, board]) handle.dispose();
      element.remove();
    },
  };
}

const FLYOUT_DATA_LIMIT = 15_000;

function ellipsize(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function fitText(text: string, max: number, measure: (value: string) => number): string {
  const cut = ellipsize(text, max);
  if (measure(cut) <= FLYOUT_DATA_LIMIT) return cut;
  let low = 1;
  let high = cut.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(ellipsize(text, mid)) <= FLYOUT_DATA_LIMIT) low = mid;
    else high = mid - 1;
  }
  return ellipsize(text, low);
}

function changeFlyout(change: DerivedChange): ChangeFlyout {
  const data: ChangeFlyout = {
    kind: "change",
    name: change.id,
    stage: change.stage,
    goal: null,
  };
  if (change.goal) {
    data.goal = fitText(change.goal, 4_000, (goal) => JSON.stringify({ ...data, goal }).length);
  }
  return data;
}

function taskFlyout(task: Task): TaskFlyout {
  const data: TaskFlyout = { kind: "task", id: "", description: "" };
  data.id = fitText(
    task.id,
    FLYOUT_DATA_LIMIT,
    (id) => JSON.stringify({ ...data, id, description: "…" }).length,
  );
  data.description = fitText(
    task.description,
    4_000,
    (description) => JSON.stringify({ ...data, description }).length,
  );
  return data;
}

function decodeFlyout(value: unknown): Flyout | null {
  if (!value || typeof value !== "object" || !("kind" in value)) return null;
  if (value.kind === "task")
    return "id" in value &&
      typeof value.id === "string" &&
      "description" in value &&
      typeof value.description === "string"
      ? { kind: "task", id: value.id, description: value.description }
      : null;
  if (
    value.kind !== "change" ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !("goal" in value) ||
    (value.goal !== null && typeof value.goal !== "string") ||
    !("stage" in value) ||
    (value.stage !== "planning" &&
      value.stage !== "ready" &&
      value.stage !== "progress" &&
      value.stage !== "complete")
  )
    return null;
  return { kind: "change", name: value.name, goal: value.goal, stage: value.stage };
}

function renderFlyout(container: HTMLElement, data: Flyout, untrack?: () => void) {
  container.classList.add("flyout");
  if (data.kind === "task") {
    const description = document.createElement("p");
    description.textContent = data.description;
    container.replaceChildren(description);
    return;
  }
  const heading = document.createElement(container === panelRoot ? "h1" : "p");
  heading.className = "flyout-heading";
  heading.textContent = data.name;
  const stage = document.createElement("p");
  stage.textContent = stageLabel(data.stage);
  container.replaceChildren(heading, stage);
  if (data.goal) {
    const goal = document.createElement("p");
    goal.textContent = data.goal;
    container.append(goal);
  }
  if (untrack)
    return mountButton(container, {
      label: "Untrack",
      variant: "secondary",
      size: "sm",
      onClick: untrack,
    });
}

function mountFlyout(button: HTMLButtonElement, inline: HTMLElement, getData: () => Flyout | null) {
  let anchor: ReturnType<typeof mountPopoverAnchor> | undefined;
  let action: ReturnType<typeof mountButton> | undefined;
  function closeInline() {
    action?.dispose();
    action = undefined;
    inline.hidden = true;
    if (!anchor) button.setAttribute("aria-expanded", "false");
  }
  function onClick(event: MouseEvent) {
    const data = getData();
    if (!data) return;
    event.preventDefault();
    if (anchor) {
      if (button.getAttribute("aria-expanded") !== "true")
        button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    } else {
      if (!inline.hidden) return closeInline();
      inline.hidden = false;
      const session = sessionId;
      const current = captureContext();
      action = renderFlyout(
        inline,
        data,
        session && data.kind === "change"
          ? () =>
              void untrackChange(session, data.name, current, seedTrackedChanges, () => {
                closeInline();
                read();
              })
          : undefined,
      );
      button.setAttribute("aria-expanded", "true");
    }
  }
  button.addEventListener("click", onClick);
  return {
    reset() {
      anchor?.dispose();
      anchor = undefined;
      closeInline();
    },
    update() {
      if (anchor && !hasPopovers) {
        anchor.dispose();
        anchor = undefined;
      }
      if (!hasPopovers) {
        button.setAttribute("aria-expanded", String(!inline.hidden));
      } else if (!anchor) {
        closeInline();
        button.removeAttribute("aria-expanded");
        anchor = mountPopoverAnchor(button, {
          host,
          getData: () => {
            const data = getData();
            if (!data || JSON.stringify(data).length > FLYOUT_DATA_LIMIT)
              throw new Error("OpenSpec flyout data is unavailable.");
            return data;
          },
          width: 320,
          height: 160,
          side: "bottom",
        });
      }
    },
    dispose() {
      anchor?.dispose();
      anchor = undefined;
      closeInline();
      button.removeEventListener("click", onClick);
    },
  };
}

function note(text: string, role?: string) {
  const line = document.createElement("p");
  line.className = "note";
  if (role) line.setAttribute("role", role);
  line.textContent = text;
  notes.append(line);
}

async function untrackChange(
  session: string,
  change: string,
  current: () => boolean,
  seed: () => string[],
  onSaved: () => void,
) {
  const saved = await updateTrackedChanges(host, session, current, seed, (changes) =>
    changes.filter((name) => name !== change),
  );
  if (!current()) return;
  if (saved) onSaved();
  else await showError(current, null, "Could not untrack the OpenSpec change.");
}

function sameChanges(left: string[] | null, right: string[] | null) {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.length === right.length &&
      left.every((id, index) => id === right[index]))
  );
}

function read() {
  if (disposed || !directory) return;
  if (reading) {
    queued = true;
    return;
  }
  const capturedDirectory = directory;
  const capturedSession = sessionId;
  const capturedWorkspace = workspace;
  const capturedEpoch = epoch;
  const current = () => !disposed && epoch === capturedEpoch;
  reading = true;
  void (async () => {
    try {
      const listing = await client.list(capturedDirectory);
      if (!current()) return;
      const saved = capturedSession ? await readTrackedChanges(host, capturedSession) : null;
      if (!current()) return;
      if (capturedSession && saved === null) {
        await capturedWorkspace;
        if (!current()) return;
      }
      const byId = new Map(listing.changes.map((item) => [item.id, item]));
      const active = new Set(byId.keys());
      const changes = resolveSessionChanges(capturedSession, sessions, saved, active);
      selection = { active, saved, changes };
      const cards = await Promise.all(
        changes.map(async (id): Promise<Card> => {
          try {
            const summary = await client.summary(listing, id);
            if (!current()) return { id, message: "" };
            const tasks = await client.tasks(listing, id);
            return { id, change: deriveChange({ ...summary, ...byId.get(id)! }), tasks };
          } catch (caught) {
            return {
              id,
              message:
                caught instanceof Error ? caught.message : "Could not read the OpenSpec change.",
            };
          }
        }),
      );
      if (current()) render({ kind: "ready", listing, cards });
    } catch (caught) {
      if (current())
        render({
          kind: "error",
          message: caught instanceof Error ? caught.message : "Could not read the OpenSpec change.",
        });
    } finally {
      reading = false;
      if (queued) {
        queued = false;
        read();
      }
    }
  })();
}

function subscribeToProject(capturedDirectory: string) {
  const capturedProject = ++projectEpoch;
  const current = () => !disposed && projectEpoch === capturedProject;
  return (async () => {
    try {
      const project = await findProject(host, capturedDirectory);
      if (!current() || !project) return;
      const off = await host.onSessions(project.id, (snapshot) => {
        if (!current()) return;
        sessions = snapshot;
        if (
          selection &&
          !sameChanges(
            resolveSessionChanges(sessionId, sessions, selection.saved, selection.active),
            selection.changes,
          )
        ) {
          epoch++;
          selection = null;
          render({ kind: "loading" });
          read();
        }
      });
      if (current()) offSessions = off;
      else off();
    } catch (caught) {
      if (current()) console.warn("Could not inspect OpenSpec session metadata.", caught);
    }
  })();
}

function refresh() {
  read();
}

function publishRefreshControl() {
  const request = ++headerRequest;
  const showHeader = (visible: boolean) => {
    if (disposed || headerRequest !== request) return;
    bodyRefresh.hidden = visible;
  };
  showHeader(false);
  if (!directory || !hasStatusControls) return;
  void host
    .setStatusControls([{ kind: "button", id: "refresh", label: "Refresh" }])
    .then(() => showHeader(true))
    .catch((caught: unknown) => console.warn("Could not publish OpenSpec Refresh.", caught));
}

function updateContext(nextDirectory: string | null, nextSession: string | null) {
  const directoryChanged = nextDirectory !== directory;
  if (!directoryChanged && nextSession === sessionId) return;
  turnStarted = false;
  directory = nextDirectory;
  sessionId = nextSession;
  epoch++;
  selection = null;
  queued = false;
  render({ kind: directory ? "loading" : "empty" });
  if (directoryChanged) {
    publishRefreshControl();
    projectEpoch++;
    offSessions?.();
    offSessions = undefined;
    sessions = null;
    workspace = directory ? subscribeToProject(directory) : undefined;
  }
  read();
}

let lastHeight = 0;
let popoverSession: string | null = null;
let popoverAction: ReturnType<typeof mountButton> | undefined;
const resize = new ResizeObserver(() => {
  const height = Math.ceil(panelRoot.getBoundingClientRect().height);
  if (height === lastHeight) return;
  lastHeight = height;
  void host
    .setHeight(height)
    .catch((error: unknown) => console.warn("Could not resize the OpenSpec section.", error));
});
const offReady = host.onReady((ready) => {
  const nextStatusControls = ready.features?.statusControls === true;
  const statusControlsChanged = nextStatusControls !== hasStatusControls;
  const directoryChanged = ready.directory !== directory;
  hasStatusControls = nextStatusControls;
  applyHostReady(ready, document.documentElement);
  applyDevice(ready.device);
  if (ready.surface === "popover") {
    const nextSession = ready.session?.id ?? null;
    if (!popoverFrame) {
      popoverFrame = true;
      popoverSession = nextSession;
      panelRoot.replaceChildren();
      const data = decodeFlyout(ready.popover?.data);
      const popoverId = ready.popover?.id;
      if (data) {
        popoverAction = renderFlyout(
          panelRoot,
          data,
          nextSession && popoverId && data.kind === "change"
            ? () =>
                void untrackChange(
                  nextSession,
                  data.name,
                  () => !disposed && popoverSession === nextSession,
                  () => [data.name],
                  () =>
                    void host.closePopover(popoverId).catch((caught: unknown) => {
                      console.warn("Could not close the OpenSpec flyout.", caught);
                    }),
                )
            : undefined,
        );
      } else panelRoot.textContent = "OpenSpec details are unavailable.";
    } else if (nextSession !== popoverSession) {
      popoverSession = null;
      popoverAction?.update({ disabled: true });
    }
    resize.observe(panelRoot);
    return;
  }
  if (hasPopovers !== (ready.features?.popovers === true)) {
    hasPopovers = ready.features?.popovers === true;
    for (const card of mountedCards.values()) card.refreshAnchor();
  }
  updateContext(ready.directory, ready.session?.id ?? null);
  if (statusControlsChanged && !directoryChanged) publishRefreshControl();
  resize.observe(panelRoot);
});
const offDirectory = host.onDirectory((next) => {
  if (!popoverFrame) updateContext(next, sessionId);
});
const offSession = host.onSession((next) => {
  if (!popoverFrame) updateContext(directory, next?.id ?? null);
  else if (next?.id !== popoverSession) {
    popoverSession = null;
    popoverAction?.update({ disabled: true });
  }
});
const offLifecycle = host.onSessionLifecycle((event) => {
  if (event.sessionId !== sessionId) return;
  const completedTurn = turnStarted && event.phase === "completed";
  turnStarted = event.phase === "started";
  if (completedTurn) read();
});
const offStatusControl = host.onStatusControl(({ id }) => {
  if (id === "refresh") refresh();
});
const offPopover = host.onPopoverClosed(({ reason }) => {
  const session = sessionId;
  if (reason !== "closed" || !session || !selection) return;
  const current = captureContext();
  void readTrackedChanges(host, session)
    .then((saved) => {
      if (current() && selection && !sameChanges(saved, selection.saved)) read();
    })
    .catch((caught: unknown) => {
      console.warn("Could not check the tracked OpenSpec changes.", caught);
    });
});
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    resize.disconnect();
    offReady();
    offDirectory();
    offSession();
    offLifecycle();
    offStatusControl();
    offPopover();
    offSessions?.();
    popoverAction?.dispose();
    for (const card of mountedCards.values()) card.dispose();
    for (const handle of [refreshButton, pickerButton, cancelPicker, ...optionButtons])
      handle.dispose();
    panelRoot.removeEventListener("keydown", escapePicker);
    host.dispose();
  },
  { once: true },
);

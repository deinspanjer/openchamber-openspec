import { connectHost, HostRequestError, type GuestSessionsSnapshot } from "@openchamber/sdk";
import { applyHostReady, mountBadge, mountButton, mountProgress } from "@openchamber/sdk/ui";
import type { ListingEntry, Task } from "./contracts.js";
import {
  deriveChange,
  requiredArtifactIds,
  resolveTrackedChanges,
  type DerivedChange,
} from "./model.js";
import { createClient, type Listing } from "./panel/client.js";
import { applyDevice } from "./panel/device.js";
import { findProject } from "./panel/project.js";
import { actionPrompt } from "./panel/prompts.js";
import { readTrackedChange, saveTrackedChange } from "./panel/tracked-change.js";
import { stageLabel, workflowLabel } from "./panel/workflow.js";

type View =
  | { kind: "empty" | "loading" }
  | { kind: "error"; message: string }
  | { kind: "picker"; listing: Listing; staleSaved: string | null }
  | { kind: "tracked"; listing: Listing; change: DerivedChange; tasks: Task[] };

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
let selection: { listing: Listing; saved: string | null; change: string | null } | null = null;
let hasStatusControls = false;
let headerRequest = 0;
const notes = document.createElement("div");
const content = document.createElement("div");
content.className = "section-content";
const controls = document.createElement("div");
controls.className = "section-controls";
for (const element of [notes, content, controls]) element.hidden = true;
panelRoot.append(notes, content, controls);

const bodyRefresh = document.createElement("div");
const primaryRoot = document.createElement("div");
const verifyRoot = document.createElement("div");
const pickerRoot = document.createElement("div");
const picker = document.createElement("div");
picker.className = "section-picker";
picker.id = "section-picker";
picker.hidden = true;
const choices = document.createElement("ul");
choices.setAttribute("aria-label", "Changes");
picker.append(choices);
panelRoot.append(picker);
controls.append(bodyRefresh);
const refreshButton = mountButton(bodyRefresh, { label: "Refresh", size: "sm", onClick: refresh });
const openBoard = mountButton(controls, {
  label: "Open board",
  size: "sm",
  variant: "secondary",
  onClick: () => {
    const current = captureContext();
    void host
      .openSurface("plugin:openspec-board")
      .catch((caught: unknown) => showError(current, caught, "Could not open the OpenSpec board."));
  },
});
controls.append(primaryRoot, verifyRoot, pickerRoot);
let trackedChange: DerivedChange | null = null;
const primary = mountButton(primaryRoot, {
  label: "",
  size: "sm",
  onClick: () => {
    if (trackedChange) void preparePrompt(trackedChange, "primary", captureContext());
  },
});
const verify = mountButton(verifyRoot, {
  label: "verify",
  size: "sm",
  variant: "secondary",
  onClick: () => {
    if (trackedChange) void preparePrompt(trackedChange, "verify", captureContext());
  },
});
const pickerButton = mountButton(pickerRoot, {
  label: "",
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
  content.hidden = view.kind !== "tracked";
  trackedChange = view.kind === "tracked" ? view.change : null;
  primaryRoot.hidden = !trackedChange;
  verifyRoot.hidden = trackedChange?.stage !== "complete";
  notes.replaceChildren();
  if (view.kind === "tracked") {
    renderTracked(view.change, view.tasks);
    primary.update({ label: workflowLabel(view.change.stage) });
  } else if (view.kind === "picker") {
    if (view.staleSaved) note(`Saved change ${view.staleSaved} is no longer active.`);
    if (!sessionId) note("Start a session to choose a change.");
    if (!view.listing.changes.length) note("No active changes.");
  } else if (view.kind === "error") {
    note(view.message, "alert");
  } else if (view.kind === "loading") {
    note("Loading OpenSpec change…", "status");
  }
  notes.hidden = !notes.childElementCount;
  const listing = view.kind === "tracked" || view.kind === "picker" ? view.listing : null;
  pickerRoot.hidden = !listing?.changes.length;
  cancelRoot.hidden = view.kind !== "tracked";
  if (listing?.changes.length)
    updatePicker(listing, view.kind === "tracked" ? "Change…" : "Choose a change");
  else setPickerOpen(false, false);
  if (view.kind === "empty" || view.kind === "loading") {
    disclosure.open = false;
    taskKey = "";
  }
}

function pickerPriority({ completedTasks, totalTasks }: ListingEntry) {
  if (!totalTasks) return 2;
  if (!completedTasks) return 1;
  return completedTasks < totalTasks ? 0 : 3;
}

function updatePicker(listing: Listing, label: string) {
  const items = [...listing.changes]
    .sort((left, right) => pickerPriority(left) - pickerPriority(right))
    .map(({ id }) => ({ id, label: id, disabled: !sessionId }));
  const nextKey = JSON.stringify([label, items]);
  if (pickerKey === nextKey) return;
  pickerKey = nextKey;
  pickerButton.update({ label });
  const focused = choices.contains(document.activeElement)
    ? document.activeElement?.textContent
    : null;
  for (const button of optionButtons) button.dispose();
  choices.replaceChildren();
  optionButtons = items.map(({ id, label, disabled }) => {
    const row = document.createElement("li");
    choices.append(row);
    const button = mountButton(row, {
      label,
      disabled,
      size: "sm",
      variant: "secondary",
      onClick: () => {
        const session = sessionId;
        const current = captureContext();
        if (!session || !current()) return;
        setPickerOpen(false);
        void (async () => {
          const saved = await saveTrackedChange(host, session, id, current);
          if (!current()) return;
          if (saved) read();
          else await showError(current, null, "Could not save the tracked OpenSpec change.");
        })();
      },
    });
    if (focused === label) row.querySelector("button")?.focus();
    return button;
  });
  if (focused && !choices.contains(document.activeElement))
    (choices.querySelector<HTMLElement>("button:enabled") ?? pickerTrigger).focus();
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

async function preparePrompt(
  change: DerivedChange,
  intent: "primary" | "verify",
  current: () => boolean,
) {
  if (!current()) return;
  const session = sessionId;
  try {
    await host.compose({ text: actionPrompt(change, intent), mode: "replace" });
    if (!current()) return;
    if (session) void saveTrackedChange(host, session, change.id, current);
    await host.toast({
      kind: "success",
      message: "Workflow prompt prepared in the open composer.",
    });
  } catch (caught) {
    await showError(current, caught, "The workflow prompt could not be prepared.");
  }
}

const heading = document.createElement("div");
heading.className = "section-heading";
const title = document.createElement("h1");
heading.append(title);
const stage = mountBadge(heading, { label: "" });
const meter = document.createElement("div");
meter.className = "section-progress";
const progress = mountProgress(meter, { value: 0 });
meter.querySelector('[role="progressbar"]')?.setAttribute("aria-label", "Task completion");
const count = document.createElement("span");
meter.append(count);
const disclosure = document.createElement("details");
const summary = document.createElement("summary");
const description = document.createElement("p");
disclosure.append(summary, description);
let taskKey = "";
const artifacts = document.createElement("ul");
artifacts.className = "section-artefacts";
artifacts.setAttribute("aria-label", "Planning artefacts");
let artifactKey = "";
let artifactBadges: ReturnType<typeof mountBadge>[] = [];
content.append(heading, meter, disclosure, artifacts);

function renderTracked(change: DerivedChange, tasks: Task[]) {
  if (title.textContent !== change.id) title.textContent = change.id;
  stage.update({ label: stageLabel(change.stage) });
  const { completedTasks, totalTasks } = change;
  progress.update({ value: totalTasks ? (100 * completedTasks) / totalTasks : 0 });
  count.textContent = `${completedTasks}/${totalTasks}`;

  const next = completedTasks < totalTasks ? tasks.find((task) => !task.done) : undefined;
  const nextKey = next ? JSON.stringify([change.id, next.id]) : "";
  if (nextKey !== taskKey) disclosure.open = false;
  taskKey = nextKey;
  disclosure.hidden = !next;
  if (next) {
    if (summary.textContent !== next.description) summary.textContent = next.description;
    if (description.textContent !== next.description) description.textContent = next.description;
  }

  const required = requiredArtifactIds(change);
  const applicable = change.artifacts.filter(({ id }) => required.has(id));
  const nextArtifactKey = JSON.stringify(applicable.map(({ id, status }) => [id, status]));
  if (artifactKey === nextArtifactKey) return;
  artifactKey = nextArtifactKey;
  for (const badge of artifactBadges) badge.dispose();
  artifactBadges = [];
  artifacts.replaceChildren();
  artifacts.hidden = !applicable.length;
  for (const artifact of applicable) {
    const item = document.createElement("li");
    item.append(`${artifact.id} `);
    artifactBadges.push(mountBadge(item, { label: artifact.status }));
    artifacts.append(item);
  }
}

function note(text: string, role?: string) {
  const line = document.createElement("p");
  line.className = "note";
  if (role) line.setAttribute("role", role);
  line.textContent = text;
  notes.append(line);
}

function resolve(listing: Listing, saved: string | null) {
  const candidate = sessions?.sessions.find((item) => item.id === sessionId);
  const coverage = sessions?.coverage.find((item) => item.directory === candidate?.directory);
  const record = coverage?.state === "ready" ? candidate : undefined;
  // The single-choice storage format still falls back when the choice is stale.
  return resolveTrackedChanges({
    saved: saved !== null && listing.changes.some(({ id }) => id === saved) ? [saved] : null,
    items: record?.items ?? [],
    worktreeName: record?.worktree?.name ?? null,
    active: new Set(listing.changes.map(({ id }) => id)),
  });
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
      const saved = capturedSession ? await readTrackedChange(host, capturedSession) : null;
      if (!current()) return;
      if (capturedSession && !listing.changes.some(({ id }) => id === saved)) {
        await capturedWorkspace;
        if (!current()) return;
      }
      const change = resolve(listing, saved).changes[0] ?? null;
      selection = { listing, saved, change };
      if (change === null) {
        render({ kind: "picker", listing, staleSaved: saved });
      } else {
        const entry = listing.changes.find(({ id }) => id === change)!;
        const summary = await client.summary(listing, entry.id);
        if (!current()) return;
        const tasks = await client.tasks(listing, entry.id);
        if (!current()) return;
        render({ kind: "tracked", listing, change: deriveChange({ ...summary, ...entry }), tasks });
      }
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
          (resolve(selection.listing, selection.saved).changes[0] ?? null) !== selection.change
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
  updateContext(ready.directory, ready.session?.id ?? null);
  if (statusControlsChanged && !directoryChanged) publishRefreshControl();
  resize.observe(panelRoot);
});
const offDirectory = host.onDirectory((next) => updateContext(next, sessionId));
const offSession = host.onSession((next) => updateContext(directory, next?.id ?? null));
const offLifecycle = host.onSessionLifecycle((event) => {
  if (event.sessionId !== sessionId) return;
  const completedTurn = turnStarted && event.phase === "completed";
  turnStarted = event.phase === "started";
  if (completedTurn) read();
});
const offStatusControl = host.onStatusControl(({ id }) => {
  if (id === "refresh") refresh();
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
    offSessions?.();
    for (const handle of [
      refreshButton,
      openBoard,
      primary,
      verify,
      pickerButton,
      cancelPicker,
      stage,
      progress,
      ...artifactBadges,
      ...optionButtons,
    ])
      handle.dispose();
    panelRoot.removeEventListener("keydown", escapePicker);
    host.dispose();
  },
  { once: true },
);

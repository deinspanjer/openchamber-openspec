import { connectHost, HostRequestError, type GuestSessionsSnapshot } from "@openchamber/sdk";
import {
  applyHostReady,
  mountBadge,
  mountButton,
  mountMenu,
  mountProgress,
} from "@openchamber/sdk/ui";
import type { ListingEntry, Task } from "./contracts.js";
import {
  deriveChange,
  requiredArtifactIds,
  resolveTrackedChange,
  type DerivedChange,
} from "./model.js";
import { createClient, type Listing } from "./panel/client.js";
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
let epoch = 0;
let projectEpoch = 0;
let sessions: GuestSessionsSnapshot | null = null;
let offSessions: (() => void) | undefined;
let disposed = false;
let reading = false;
let queued = false;
let selection: { listing: Listing; saved: string | null; change: string | null } | null = null;
const handles: { dispose(): void }[] = [];

function render(view: View) {
  for (const handle of handles.splice(0)) handle.dispose();
  panelRoot.replaceChildren();
  if (view.kind === "empty") return;
  const controls = document.createElement("div");
  controls.className = "section-controls";
  handles.push(mountButton(controls, { label: "Refresh", size: "sm", onClick: refresh }));
  const capturedEpoch = epoch;
  const current = () => !disposed && epoch === capturedEpoch;
  handles.push(
    mountButton(controls, {
      label: "Open board",
      size: "sm",
      variant: "secondary",
      onClick: () =>
        void host
          .openSurface("plugin:openspec-board")
          .catch((caught: unknown) =>
            showError(current, caught, "Could not open the OpenSpec board."),
          ),
    }),
  );
  if (view.kind === "loading") {
    note("Loading OpenSpec change…", "status");
    return;
  }
  if (view.kind === "tracked") {
    renderTracked(view.change, view.tasks);
    const change = view.change;
    for (const action of change.stage === "complete"
      ? (["primary", "verify"] as const)
      : (["primary"] as const)) {
      handles.push(
        mountButton(controls, {
          label: action === "primary" ? workflowLabel(change.stage) : "verify",
          size: "sm",
          variant: action === "primary" ? "default" : "secondary",
          onClick: () => void preparePrompt(change, action, current),
        }),
      );
    }
    mountPicker(controls, view.listing, "Change…", current);
    panelRoot.append(controls);
    return;
  }
  if (view.kind === "picker") {
    if (view.staleSaved) note(`Saved change ${view.staleSaved} is no longer active.`);
    if (!sessionId) note("Start a session to choose a change.");
    if (!view.listing.changes.length) {
      note("No active changes.");
    } else {
      mountPicker(controls, view.listing, "Choose a change", current);
    }
    panelRoot.append(controls);
    return;
  }
  if (view.kind === "error") note(view.message, "alert");
  panelRoot.append(controls);
}

function pickerPriority({ completedTasks, totalTasks }: ListingEntry) {
  if (!totalTasks) return 2;
  if (!completedTasks) return 1;
  return completedTasks < totalTasks ? 0 : 3;
}

function mountPicker(
  controls: HTMLElement,
  listing: Listing,
  label: string,
  current: () => boolean,
) {
  const picker = document.createElement("div");
  controls.append(picker);
  handles.push(
    mountMenu(picker, {
      label,
      size: "sm",
      variant: "secondary",
      items: [...listing.changes]
        .sort((left, right) => pickerPriority(left) - pickerPriority(right))
        .map(({ id }) => ({ id, label: id, disabled: !sessionId })),
      onSelect: (id) => {
        const session = sessionId;
        if (!session || !current()) return;
        void (async () => {
          const saved = await saveTrackedChange(host, session, id, current);
          if (!current()) return;
          if (saved) read();
          else await showError(current, null, "Could not save the tracked OpenSpec change.");
        })();
      },
    }),
  );
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

function renderTracked(change: DerivedChange, tasks: Task[]) {
  const heading = document.createElement("div");
  heading.className = "section-heading";
  const title = document.createElement("h1");
  title.textContent = change.id;
  heading.append(title);
  handles.push(mountBadge(heading, { label: stageLabel(change.stage) }));
  panelRoot.append(heading);

  const meter = document.createElement("div");
  meter.className = "section-progress";
  const { completedTasks, totalTasks } = change;
  handles.push(
    mountProgress(meter, {
      value: totalTasks ? (100 * completedTasks) / totalTasks : 0,
    }),
  );
  meter.querySelector('[role="progressbar"]')?.setAttribute("aria-label", "Task completion");
  const count = document.createElement("span");
  count.textContent = `${completedTasks}/${totalTasks}`;
  meter.append(count);
  panelRoot.append(meter);

  const next = completedTasks < totalTasks ? tasks.find((task) => !task.done) : undefined;
  if (next) {
    const disclosure = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = next.description;
    const description = document.createElement("p");
    description.textContent = next.description;
    disclosure.append(summary, description);
    panelRoot.append(disclosure);
  }

  const required = requiredArtifactIds(change);
  const list = document.createElement("ul");
  list.className = "section-artefacts";
  list.setAttribute("aria-label", "Planning artefacts");
  for (const artifact of change.artifacts) {
    if (!required.has(artifact.id)) continue;
    const item = document.createElement("li");
    item.append(`${artifact.id} `);
    handles.push(mountBadge(item, { label: artifact.status }));
    list.append(item);
  }
  if (list.childElementCount) panelRoot.append(list);
}

function note(text: string, role?: string) {
  const line = document.createElement("p");
  line.className = "note";
  if (role) line.setAttribute("role", role);
  line.textContent = text;
  panelRoot.append(line);
}

function resolve(listing: Listing, saved: string | null) {
  const record = sessions?.sessions.find((item) => item.id === sessionId);
  return resolveTrackedChange({
    saved,
    items: record?.items ?? [],
    worktreeName: record?.worktree?.name ?? null,
    active: new Set(listing.changes.map(({ id }) => id)),
  });
}

function read() {
  if (disposed || !directory || sessions?.state !== "ready") return;
  if (reading) {
    queued = true;
    return;
  }
  const capturedDirectory = directory;
  const capturedSession = sessionId;
  const capturedEpoch = epoch;
  const current = () => !disposed && epoch === capturedEpoch;
  reading = true;
  void (async () => {
    try {
      const listing = await client.list(capturedDirectory);
      if (!current()) return;
      const saved = capturedSession ? await readTrackedChange(host, capturedSession) : null;
      if (!current()) return;
      const tracked = resolve(listing, saved);
      selection = { listing, saved, change: tracked.change };
      if (tracked.change === null) {
        render({ kind: "picker", listing, staleSaved: tracked.staleSaved });
      } else {
        const entry = listing.changes.find(({ id }) => id === tracked.change)!;
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
  const failed = (message: string) => {
    if (!current()) return;
    epoch++;
    selection = null;
    render({ kind: "error", message });
  };
  void (async () => {
    try {
      const project = await findProject(host, capturedDirectory);
      if (!current()) return;
      const off = await host.onSessions(project.id, (snapshot) => {
        if (!current()) return;
        const wasReady = sessions?.state === "ready";
        sessions = snapshot;
        if (snapshot.state === "error") {
          failed("Could not read project sessions.");
        } else if (snapshot.state === "ready") {
          if (!wasReady) read();
          else if (
            selection &&
            resolve(selection.listing, selection.saved).change !== selection.change
          ) {
            epoch++;
            selection = null;
            render({ kind: "loading" });
            read();
          }
        }
      });
      if (current()) offSessions = off;
      else off();
    } catch (caught) {
      failed(
        caught instanceof Error ? caught.message : "Could not identify the registered project.",
      );
    }
  })();
}

function refresh() {
  if (!directory) return;
  if (sessions?.state === "ready") read();
  else if (!offSessions) subscribeToProject(directory);
}

function updateContext(nextDirectory: string | null, nextSession: string | null) {
  const directoryChanged = nextDirectory !== directory;
  if (!directoryChanged && nextSession === sessionId) return;
  directory = nextDirectory;
  sessionId = nextSession;
  epoch++;
  selection = null;
  queued = false;
  render({ kind: directory ? "loading" : "empty" });
  if (directoryChanged) {
    projectEpoch++;
    offSessions?.();
    offSessions = undefined;
    sessions = null;
    if (directory) subscribeToProject(directory);
  } else {
    read();
  }
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
  applyHostReady(ready, document.documentElement);
  updateContext(ready.directory, ready.session?.id ?? null);
  resize.observe(panelRoot);
});
const offDirectory = host.onDirectory((next) => updateContext(next, sessionId));
const offSession = host.onSession((next) => updateContext(directory, next?.id ?? null));
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    resize.disconnect();
    offReady();
    offDirectory();
    offSession();
    offSessions?.();
    for (const handle of handles.splice(0)) handle.dispose();
    host.dispose();
  },
  { once: true },
);

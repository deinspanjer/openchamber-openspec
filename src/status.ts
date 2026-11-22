import { connectHost, type GuestSessionsSnapshot } from "@openchamber/sdk";
import { applyHostReady, mountMenu } from "@openchamber/sdk/ui";
import { resolveTrackedChange } from "./model.js";
import { createClient, type Listing } from "./panel/client.js";
import { findProject } from "./panel/project.js";
import { readTrackedChange } from "./panel/tracked-change.js";

type View =
  | { kind: "empty" | "loading" }
  | { kind: "error"; message: string }
  | { kind: "picker"; listing: Listing; staleSaved: string | null }
  | { kind: "tracked"; change: string };

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
let menu: ReturnType<typeof mountMenu> | undefined;

function render(view: View) {
  menu?.dispose();
  menu = undefined;
  panelRoot.replaceChildren();
  if (view.kind === "empty") return;
  if (view.kind === "tracked") {
    const title = document.createElement("h1");
    title.textContent = view.change;
    panelRoot.append(title);
    return;
  }
  if (view.kind === "picker") {
    if (view.staleSaved) note(`Saved change ${view.staleSaved} is no longer active.`);
    if (!sessionId) note("Start a session to choose a change.");
    if (!view.listing.changes.length) {
      note("No active changes.");
      return;
    }
    const picker = document.createElement("div");
    panelRoot.append(picker);
    menu = mountMenu(picker, {
      label: "Choose a change",
      size: "sm",
      items: view.listing.changes.map(({ id }) => ({ id, label: id, disabled: !sessionId })),
      onSelect: () => {},
    });
    return;
  }
  if (view.kind === "error") note(view.message, "alert");
  else note("Loading OpenSpec change…", "status");
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
      render(
        tracked.change === null
          ? { kind: "picker", listing, staleSaved: tracked.staleSaved }
          : { kind: "tracked", change: tracked.change },
      );
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
        } else if (
          snapshot.state === "ready" &&
          (!wasReady ||
            (selection && resolve(selection.listing, selection.saved).change !== selection.change))
        ) {
          read();
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
    menu?.dispose();
    host.dispose();
  },
  { once: true },
);

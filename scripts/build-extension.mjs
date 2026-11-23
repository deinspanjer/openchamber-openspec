import { copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const browser = { format: "iife", platform: "browser", target: "es2022" };
const bundles = {
  panel: { ...browser, entryPoints: ["src/panel.ts"], outfile: "panel/main.js" },
  status: { ...browser, entryPoints: ["src/status.ts"], outfile: "panel/status.js" },
  service: {
    format: "cjs",
    platform: "node",
    target: "node22",
    entryPoints: ["src/service.ts"],
    outfile: "service/main.js",
  },
};

function buildBundle(bundle, panelId, destination) {
  return build({
    ...bundle,
    absWorkingDir: root,
    outfile: join(destination, bundle.outfile),
    bundle: true,
    logLevel: "info",
    define: {
      __OPENSPEC_PANEL_ID__: JSON.stringify(panelId),
      __OPENSPEC_PANEL_SURFACE__: JSON.stringify(`plugin:${panelId}`),
    },
  });
}

async function statIfPresent(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

async function deployDev() {
  const id = "openspec-board-dev";
  const name = "OpenSpec (dev)";
  const slot = join(homedir(), ".local", "share", "openchamber-openspec-dev");
  const staticFiles = [
    "assets/openspec-logo.svg",
    "panel/index.html",
    "panel/status.html",
    "service/package.json",
  ];
  const files = [...staticFiles, ...Object.values(bundles).map((bundle) => bundle.outfile)];
  const directories = [...new Set(files.map(dirname))];
  const openchamber = structuredClone(manifest.openchamber);
  Object.assign(openchamber.contributes.panel, { id, name });
  openchamber.contributes.statusSection.title = name;
  const devManifest = {
    name: `${manifest.name}-dev`,
    version: manifest.version,
    description: manifest.description,
    type: manifest.type,
    openchamber,
  };

  const parent = dirname(slot);
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(join(parent, ".openspec-dev-"));
  try {
    for (const directory of directories) await mkdir(join(staging, directory));
    for (const file of staticFiles) await copyFile(join(root, file), join(staging, file));
    for (const bundle of Object.values(bundles)) await buildBundle(bundle, id, staging);
    await writeFile(join(staging, "package.json"), JSON.stringify(devManifest, null, 2) + "\n");

    const existing = await statIfPresent(slot);
    if (!existing) {
      await rename(staging, slot);
    } else {
      const packageFile = join(slot, "package.json");
      const previous =
        existing.isDirectory() && (await statIfPresent(packageFile))?.isFile()
          ? JSON.parse(await readFile(packageFile, "utf8"))
          : null;
      if (previous?.openchamber?.contributes?.panel?.id !== id) {
        throw new Error(`Not an OpenSpec dev slot: ${slot}`);
      }
      for (const directory of directories) {
        const path = join(slot, directory);
        const entry = await statIfPresent(path);
        if (entry && !entry.isDirectory()) throw new Error(`Not a dev package directory: ${path}`);
        if (!entry) await mkdir(path);
      }
      // Dev is disabled during redeploy. Replace each file without writing through symlinks.
      for (const file of [...files, "package.json"]) {
        await rename(join(staging, file), join(slot, file));
      }
    }
    console.log(`Deployed ${root} to ${slot}`);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

const target = process.argv[2];
if (target === "dev") {
  await deployDev();
} else {
  if (!Object.hasOwn(bundles, target)) throw new Error(`Unknown extension build target: ${target}`);
  await buildBundle(bundles[target], manifest.openchamber.contributes.panel.id, root);
}

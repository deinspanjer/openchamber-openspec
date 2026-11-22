import type { HostDevice } from "@openchamber/sdk";

export function applyDevice(device?: HostDevice) {
  document.documentElement.dataset.pointer =
    device?.pointer ?? (matchMedia("(pointer: coarse)").matches ? "coarse" : "fine");
}

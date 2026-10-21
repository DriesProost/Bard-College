import { pathToFileURL } from "node:url";
export function trustedSender(url: string, mainFile: string, dev: boolean) {
  try {
    const u = new URL(url);
    return dev
      ? u.origin === "http://127.0.0.1:5173"
      : u.href === pathToFileURL(mainFile).href;
  } catch {
    return false;
  }
}

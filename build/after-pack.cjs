const fs = require("node:fs/promises");
const path = require("node:path");
// Enumerate only files delivered by this build. Uninstall never recursively deletes
// an installation directory that might also contain a user's unrelated files.
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const files = [];
  const directories = [];
  async function visit(relative = "") {
    for (const entry of await fs.readdir(
      path.join(context.appOutDir, relative),
      { withFileTypes: true },
    )) {
      const next = path.join(relative, entry.name);
      if (entry.isSymbolicLink())
        throw Error("Unexpected symbolic link in Windows payload: " + next);
      if (entry.isDirectory()) {
        directories.push(next);
        await visit(next);
      } else files.push(next);
    }
  }
  await visit();
  const quote = (value) =>
    value
      .replaceAll("$", () => "$$")
      .replaceAll('"', '$\\"')
      .split(path.sep)
      .join("\\");
  const script = [
    "; Generated from the exact packaged Windows payload.",
    "!macro RemoveInstalledFiles",
    ...files.sort().map((file) => `  Delete "$INSTDIR\\${quote(file)}"`),
    ...directories
      .sort((a, b) => b.length - a.length)
      .map((dir) => `  RMDir "$INSTDIR\\${quote(dir)}"`),
    "!macroend",
    "",
  ].join("\n");
  await fs.writeFile(
    path.join(context.packager.projectDir, "release", "uninstall-files.nsh"),
    script,
    "utf8",
  );
};

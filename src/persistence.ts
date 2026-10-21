/** Draft and recording work that must settle before the desktop window closes. */
export const pendingSaves = new Set<() => Promise<unknown>>();

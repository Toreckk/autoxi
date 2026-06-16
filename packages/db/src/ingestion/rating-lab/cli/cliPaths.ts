import { isAbsolute, resolve } from "node:path";

export function resolveCliPath(path: string): string {
  if (isAbsolute(path)) return path;
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

import { profileTransfermarktSource } from "../sources/transfermarkt/transfermarktProfiler.js";
import { isCliEntrypoint } from "./cliEntrypoint.js";

export async function runTransfermarktMergePreview(): Promise<string> {
  const cwd = process.env.INIT_CWD ?? process.cwd();
  const profile = await profileTransfermarktSource(`${cwd}/data/sources/transfermarkt`);
  const overlayPlayers = profile.files.find((file) => file.file === "overlay/players_overlay.csv")?.rows ?? 0;
  const overlayValuations = profile.files.find((file) => file.file === "overlay/player_valuations_overlay.csv")?.rows ?? 0;
  return [
    "Transfermarkt merge preview.",
    `Files profiled: ${profile.files.length}`,
    `Total rows visible to loader: ${profile.totalRows}`,
    `Overlay players: ${overlayPlayers}`,
    `Overlay valuations: ${overlayValuations}`,
    profile.warnings.length ? `Warnings: ${profile.warnings.join(" | ")}` : "Warnings: none"
  ].join("\n");
}

if (isCliEntrypoint(import.meta.url)) {
  runTransfermarktMergePreview()
    .then((message) => console.log(message))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

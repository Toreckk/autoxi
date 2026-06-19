import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  estimateExceedsNeonFreePreviewLimits,
  estimatePreviewImportSize,
  type PreviewImportEstimate
} from "../db-preview/estimatePreviewImportSize.js";
import { writeDevPreviewCards, type DevPreviewWriteResult } from "../db-preview/writeDevPreviewCards.js";
import type { RatingLabSummary } from "../domain/types.js";
import { defaultPreviewPathForReport, writeRatingLabPreviewHtml } from "../reporting/previewHtmlWriter.js";
import { runCalibration, type RunCalibrationOptions } from "./runCalibration.js";

export type RunCalibrationLoopOptions = RunCalibrationOptions & {
  previewOutputPath?: string;
  maxPreviewCards?: number;
  writeDevPreview?: boolean;
  devPreviewConnectionString?: string;
  allowPreviewLimitOverride?: boolean;
};

export type RunCalibrationLoopResult = {
  reportPaths: string[];
  summaryPath: string;
  previewPath: string;
  gateStatus: RatingLabSummary["confidenceGateStatus"];
  gateReasons: string[];
  previewEstimate: PreviewImportEstimate;
  devPreviewWrite: DevPreviewWriteResult | null;
};

export async function runCalibrationLoop(options: RunCalibrationLoopOptions): Promise<RunCalibrationLoopResult> {
  const reportPaths = await runCalibration(options);
  const summaryPath = join(options.outputDir, "latest-summary.json");
  const summary = JSON.parse(await readFile(summaryPath, "utf8")) as RatingLabSummary;
  const previewPath = options.previewOutputPath ?? defaultPreviewPathForReport(summaryPath);
  await writeRatingLabPreviewHtml({ summary, outputPath: previewPath });

  const maxPreviewCards = options.maxPreviewCards ?? 500;
  const previewEstimate = estimatePreviewImportSize(summary, maxPreviewCards);
  const previewLimitFailures = estimateExceedsNeonFreePreviewLimits(previewEstimate, {
    maxCards: maxPreviewCards,
    allowOverride: options.allowPreviewLimitOverride
  });
  if (options.writeDevPreview && previewLimitFailures.length > 0) {
    throw new Error(`Refusing dev preview write: ${previewLimitFailures.join("; ")}`);
  }

  const devPreviewWrite = options.writeDevPreview
    ? await writeDevPreviewCards({
        summary,
        maxCards: maxPreviewCards,
        connectionString: options.devPreviewConnectionString
      })
    : null;

  return {
    reportPaths,
    summaryPath,
    previewPath,
    gateStatus: summary.confidenceGateStatus,
    gateReasons: summary.confidenceGateReasons,
    previewEstimate,
    devPreviewWrite
  };
}

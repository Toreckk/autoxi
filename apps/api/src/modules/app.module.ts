import { Module } from "@nestjs/common";
import { CardsModule } from "./cards/cards.module.js";
import { HealthController } from "./health/health.controller.js";
import { ConsoleErrorReportingAdapter } from "../observability/console-error-reporting.adapter.js";
import { ConsoleTelemetryAdapter } from "../observability/console-telemetry.adapter.js";

@Module({
  imports: [CardsModule],
  controllers: [HealthController],
  providers: [ConsoleTelemetryAdapter, ConsoleErrorReportingAdapter],
  exports: [ConsoleTelemetryAdapter, ConsoleErrorReportingAdapter]
})
export class AppModule {}

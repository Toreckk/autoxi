import { Controller, Get, Inject } from "@nestjs/common";
import { ConsoleTelemetryAdapter } from "../../observability/console-telemetry.adapter.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(ConsoleTelemetryAdapter) private readonly telemetry: ConsoleTelemetryAdapter) {}

  @Get()
  getHealth() {
    this.telemetry.increment("api.health.checked");
    return { status: "ok" };
  }
}

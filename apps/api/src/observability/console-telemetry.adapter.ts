import { Injectable } from "@nestjs/common";
import type { TelemetryAttributes, TelemetryPort } from "@autoxi/domain";

@Injectable()
export class ConsoleTelemetryAdapter implements TelemetryPort {
  async startSpan<A>(
    name: string,
    attributes: TelemetryAttributes,
    run: () => Promise<A>
  ): Promise<A> {
    const started = performance.now();
    try {
      const result = await run();
      this.histogram(`${name}.duration_ms`, performance.now() - started, attributes);
      return result;
    } catch (error) {
      this.increment(`${name}.error`, 1, attributes);
      throw error;
    }
  }

  increment(name: string, value = 1, attributes: TelemetryAttributes = {}): void {
    this.log("debug", "metric_counter", { metric: name, value, ...attributes });
  }

  histogram(name: string, value: number, attributes: TelemetryAttributes = {}): void {
    this.log("debug", "metric_histogram", { metric: name, value: Math.round(value), ...attributes });
  }

  log(level: "debug" | "info" | "warn" | "error", message: string, attributes: TelemetryAttributes = {}): void {
    const line = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...attributes
    };
    console[level](JSON.stringify(line));
  }
}

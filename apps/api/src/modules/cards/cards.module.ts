import { Module } from "@nestjs/common";
import { createDb } from "@autoxi/db";
import { CardsController } from "./cards.controller.js";
import { CardsService } from "./cards.service.js";
import { DB_TOKEN } from "./cards.tokens.js";
import { ConsoleTelemetryAdapter } from "../../observability/console-telemetry.adapter.js";

@Module({
  controllers: [CardsController],
  providers: [
    {
      provide: DB_TOKEN,
      useFactory: () => createDb()
    },
    ConsoleTelemetryAdapter,
    CardsService
  ]
})
export class CardsModule {}

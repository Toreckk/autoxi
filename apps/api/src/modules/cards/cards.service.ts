import { Inject, Injectable } from "@nestjs/common";
import { CardRepository, type AutoxiDb } from "@autoxi/db";
import type { CardFilterQuery } from "@autoxi/domain";
import { DB_TOKEN } from "./cards.tokens.js";
import { ConsoleTelemetryAdapter } from "../../observability/console-telemetry.adapter.js";

@Injectable()
export class CardsService {
  private readonly repository: CardRepository;

  constructor(
    @Inject(DB_TOKEN) db: AutoxiDb,
    @Inject(ConsoleTelemetryAdapter)
    private readonly telemetry: ConsoleTelemetryAdapter
  ) {
    this.repository = new CardRepository(db);
  }

  listCards(query: CardFilterQuery) {
    return this.telemetry.startSpan("cards.list", { endpoint: "GET /cards" }, () => this.repository.listCards(query));
  }

  getCardById(id: string) {
    return this.telemetry.startSpan("cards.get_by_id", { endpoint: "GET /cards/:id" }, () =>
      this.repository.getCardById(id)
    );
  }

  getFilterMetadata() {
    return this.telemetry.startSpan("cards.filter_metadata", { endpoint: "GET /cards/meta/filters" }, () =>
      this.repository.getFilterMetadata()
    );
  }
}

import { Controller, Get, Inject, NotFoundException, Param, Query } from "@nestjs/common";
import type { CardFilterQuery } from "@autoxi/domain";
import { CardsService } from "./cards.service.js";

@Controller("cards")
export class CardsController {
  constructor(@Inject(CardsService) private readonly cards: CardsService) {}

  @Get("meta/filters")
  getFilterMetadata() {
    return this.cards.getFilterMetadata();
  }

  @Get(":id")
  async getCardById(@Param("id") id: string) {
    const card = await this.cards.getCardById(id);
    if (!card) {
      throw new NotFoundException("Card not found");
    }
    return card;
  }

  @Get()
  listCards(@Query() query: CardFilterQuery) {
    return this.cards.listCards(query);
  }
}

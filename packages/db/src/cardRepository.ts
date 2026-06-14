import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type AnyColumn,
  type SQL
} from "drizzle-orm";
import {
  BROAD_LINES,
  CARD_ROLES,
  CARD_TIERS,
  SORT_OPTIONS,
  STAT_KEYS,
  VISIBLE_POSITIONS,
  animationLevelForTier,
  normalizeCardQuery,
  publicPlayerCardSchema,
  type CardFilterMetadataDto,
  type CardFilterQuery,
  type NormalizedCardFilterQuery,
  type PaginatedCardsDto,
  type PublicPlayerCardDto,
  type StatKey
} from "@autoxi/domain";
import type { AutoxiDb } from "./client.js";
import { nations, playerAliases, playerCards, playerCardStats, worldCupEditions } from "./schema.js";

const statColumns: Record<StatKey, AnyColumn> = {
  pace: playerCardStats.pace,
  shooting: playerCardStats.shooting,
  passing: playerCardStats.passing,
  dribbling: playerCardStats.dribbling,
  defending: playerCardStats.defending,
  physical: playerCardStats.physical,
  goalkeeping: playerCardStats.goalkeeping
};

type CardRow = {
  id: string;
  displayName: string;
  shortName: string;
  rating: number;
  tier: PublicPlayerCardDto["tier"];
  cost: number;
  position: PublicPlayerCardDto["position"];
  broadLine: PublicPlayerCardDto["broadLine"];
  role: PublicPlayerCardDto["role"];
  materialKey: PublicPlayerCardDto["materialKey"];
  nationId: string;
  nationCode: string | null;
  nationName: string;
  flagCode: string;
  flagAssetPath: string | null;
  worldCupId: string;
  host: string;
  year: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  goalkeeping: number;
};

export class CardRepository {
  constructor(private readonly db: AutoxiDb) {}

  async listCards(input: CardFilterQuery): Promise<PaginatedCardsDto> {
    const query = normalizeCardQuery(input);
    const conditions = this.buildConditions(query);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.pageSize;

    let rowsQuery = this.db
      .select(this.publicCardSelection())
      .from(playerCards)
      .innerJoin(playerAliases, eq(playerAliases.id, playerCards.aliasId))
      .innerJoin(nations, eq(nations.id, playerCards.nationId))
      .innerJoin(worldCupEditions, eq(worldCupEditions.id, playerCards.worldCupEditionId))
      .innerJoin(playerCardStats, eq(playerCardStats.cardId, playerCards.id))
      .$dynamic();

    if (whereClause) {
      rowsQuery = rowsQuery.where(whereClause);
    }

    const rows = await rowsQuery.orderBy(...this.orderBy(query.sort)).limit(query.pageSize).offset(offset);

    let countQuery = this.db
      .select({ total: count() })
      .from(playerCards)
      .innerJoin(playerAliases, eq(playerAliases.id, playerCards.aliasId))
      .innerJoin(nations, eq(nations.id, playerCards.nationId))
      .innerJoin(worldCupEditions, eq(worldCupEditions.id, playerCards.worldCupEditionId))
      .innerJoin(playerCardStats, eq(playerCardStats.cardId, playerCards.id))
      .$dynamic();

    if (whereClause) {
      countQuery = countQuery.where(whereClause);
    }

    const [totalRow] = await countQuery;
    const totalItems = Number(totalRow?.total ?? 0);

    return {
      items: rows.map((row) => this.toPublicCard(row)),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize))
    };
  }

  async getCardById(id: string): Promise<PublicPlayerCardDto | null> {
    const [row] = await this.db
      .select(this.publicCardSelection())
      .from(playerCards)
      .innerJoin(playerAliases, eq(playerAliases.id, playerCards.aliasId))
      .innerJoin(nations, eq(nations.id, playerCards.nationId))
      .innerJoin(worldCupEditions, eq(worldCupEditions.id, playerCards.worldCupEditionId))
      .innerJoin(playerCardStats, eq(playerCardStats.cardId, playerCards.id))
      .where(eq(playerCards.id, id))
      .limit(1);

    return row ? this.toPublicCard(row) : null;
  }

  async getFilterMetadata(): Promise<CardFilterMetadataDto> {
    const nationRows = await this.db
      .selectDistinct({
        id: nations.id,
        code: nations.fifaCode,
        name: nations.displayName,
        flagCode: nations.flagCode,
        flagUrl: nations.flagAssetPath
      })
      .from(playerCards)
      .innerJoin(nations, eq(nations.id, playerCards.nationId))
      .orderBy(asc(nations.displayName));

    const yearRows = await this.db
      .selectDistinct({ year: worldCupEditions.year })
      .from(playerCards)
      .innerJoin(worldCupEditions, eq(worldCupEditions.id, playerCards.worldCupEditionId))
      .orderBy(desc(worldCupEditions.year));

    const hostRows = await this.db
      .selectDistinct({ host: worldCupEditions.hostName })
      .from(playerCards)
      .innerJoin(worldCupEditions, eq(worldCupEditions.id, playerCards.worldCupEditionId))
      .orderBy(asc(worldCupEditions.hostName));

    return {
      tiers: [...CARD_TIERS],
      positions: [...VISIBLE_POSITIONS],
      broadLines: [...BROAD_LINES],
      roles: [...CARD_ROLES],
      statKeys: [...STAT_KEYS],
      sortOptions: [...SORT_OPTIONS],
      nations: nationRows.map((nation) => ({
        id: nation.id,
        code: nation.code ?? nation.flagCode.toUpperCase(),
        name: nation.name,
        flagCode: nation.flagCode,
        ...(nation.flagUrl ? { flagUrl: nation.flagUrl } : {})
      })),
      years: yearRows.map((row) => row.year),
      hosts: hostRows.map((row) => row.host)
    };
  }

  private buildConditions(query: NormalizedCardFilterQuery): SQL[] {
    const conditions: SQL[] = [];

    if (query.search) {
      const search = `%${query.search}%`;
      conditions.push(or(ilike(playerAliases.displayName, search), ilike(playerAliases.shortName, search))!);
    }

    if (query.tier) conditions.push(eq(playerCards.tier, query.tier));
    if (query.minRating) conditions.push(gte(playerCards.rating, query.minRating));
    if (query.maxRating) conditions.push(lte(playerCards.rating, query.maxRating));
    if (query.position) conditions.push(eq(playerCards.position, query.position));
    if (query.broadLine) conditions.push(eq(playerCards.broadLine, query.broadLine));
    if (query.year) conditions.push(eq(worldCupEditions.year, query.year));
    if (query.role) conditions.push(eq(playerCards.role, query.role));
    if (query.host) conditions.push(ilike(worldCupEditions.hostName, `%${query.host}%`));
    if (query.nation) {
      const nation = `%${query.nation}%`;
      conditions.push(
        or(ilike(nations.displayName, nation), ilike(nations.flagCode, nation), ilike(nations.fifaCode, nation))!
      );
    }
    if (query.stat && query.statMin !== undefined) {
      conditions.push(gte(statColumns[query.stat], query.statMin));
    }

    return conditions;
  }

  private orderBy(sort: NormalizedCardFilterQuery["sort"]): SQL[] {
    switch (sort) {
      case "rating_asc":
        return [asc(playerCards.rating), asc(playerAliases.displayName)];
      case "name_asc":
        return [asc(playerAliases.displayName)];
      case "name_desc":
        return [desc(playerAliases.displayName)];
      case "tier_desc":
        return [desc(playerCards.tier), desc(playerCards.rating)];
      case "tier_asc":
        return [asc(playerCards.tier), desc(playerCards.rating)];
      case "year_desc":
        return [desc(worldCupEditions.year), desc(playerCards.rating)];
      case "year_asc":
        return [asc(worldCupEditions.year), desc(playerCards.rating)];
      case "nationality_asc":
        return [asc(nations.displayName), desc(playerCards.rating)];
      case "rating_desc":
      default:
        return [desc(playerCards.rating), asc(playerAliases.displayName)];
    }
  }

  private publicCardSelection() {
    return {
      id: playerCards.id,
      displayName: playerAliases.displayName,
      shortName: playerAliases.shortName,
      rating: playerCards.rating,
      tier: playerCards.tier,
      cost: playerCards.cost,
      position: playerCards.position,
      broadLine: playerCards.broadLine,
      role: playerCards.role,
      materialKey: playerCards.materialKey,
      nationId: nations.id,
      nationCode: nations.fifaCode,
      nationName: nations.displayName,
      flagCode: nations.flagCode,
      flagAssetPath: nations.flagAssetPath,
      worldCupId: worldCupEditions.id,
      host: worldCupEditions.hostName,
      year: worldCupEditions.year,
      pace: playerCardStats.pace,
      shooting: playerCardStats.shooting,
      passing: playerCardStats.passing,
      dribbling: playerCardStats.dribbling,
      defending: playerCardStats.defending,
      physical: playerCardStats.physical,
      goalkeeping: playerCardStats.goalkeeping
    };
  }

  private toPublicCard(row: CardRow): PublicPlayerCardDto {
    return publicPlayerCardSchema.parse({
      id: row.id,
      displayName: row.displayName,
      shortName: row.shortName,
      rating: row.rating,
      tier: row.tier,
      cost: row.cost,
      position: row.position,
      broadLine: row.broadLine,
      nation: {
        id: row.nationId,
        code: row.nationCode ?? row.flagCode.toUpperCase(),
        name: row.nationName,
        flagCode: row.flagCode,
        ...(row.flagAssetPath ? { flagUrl: row.flagAssetPath } : {})
      },
      worldCup: {
        id: row.worldCupId,
        host: row.host,
        year: row.year,
        label: `${row.host} ${row.year}`
      },
      role: row.role,
      stats: {
        pace: row.pace,
        shooting: row.shooting,
        passing: row.passing,
        dribbling: row.dribbling,
        defending: row.defending,
        physical: row.physical,
        goalkeeping: row.goalkeeping
      },
      materialKey: row.materialKey,
      animationLevel: animationLevelForTier(row.tier)
    });
  }
}

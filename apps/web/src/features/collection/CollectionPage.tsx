import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import {
  CARD_TIERS,
  SORT_OPTIONS,
  type CardFilterQuery,
  type PublicPlayerCardDto
} from "@autoxi/domain";
import { getCards, getFilterMetadata } from "../../shared/api.js";
import { analytics } from "../../shared/observability.js";
import { PlayerCardFull, PlayerCardSkeleton } from "./PlayerCard.js";
import { CardDetailDrawer } from "./CardDetailDrawer.js";

const COLLECTION_PAGE_SIZE = 10;

const initialFilters = {
  search: "",
  tier: "",
  position: "",
  broadLine: "",
  nation: "",
  year: "",
  role: "",
  stat: "",
  statMin: "",
  sort: "rating_desc",
  page: 1
};

export function CollectionPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [selectedCard, setSelectedCard] = useState<PublicPlayerCardDto | null>(null);

  const query = useMemo(
    () =>
      ({
      search: filters.search || undefined,
      tier: filters.tier || undefined,
      position: filters.position || undefined,
      broadLine: filters.broadLine || undefined,
      nation: filters.nation || undefined,
      year: filters.year || undefined,
      role: filters.role || undefined,
      stat: filters.stat || undefined,
      statMin: filters.stat ? filters.statMin || undefined : undefined,
      sort: filters.sort,
      page: filters.page,
      pageSize: COLLECTION_PAGE_SIZE
    }) as CardFilterQuery,
    [filters]
  );

  const metaQuery = useQuery({
    queryKey: ["cards", "meta"],
    queryFn: getFilterMetadata
  });

  const cardsQuery = useQuery({
    queryKey: ["cards", query],
    queryFn: () => getCards(query)
  });

  useEffect(() => {
    if (cardsQuery.data) {
      analytics.track("collection_cards_loaded", {
        totalItems: cardsQuery.data.totalItems,
        page: cardsQuery.data.page
      });
    }
  }, [cardsQuery.data]);

  function updateFilter(key: keyof typeof initialFilters, value: string | number) {
    setFilters((current) => {
      const next = {
        ...current,
        [key]: value,
        page: key === "page" ? Number(value) : 1
      };

      if (key === "stat" && !value) {
        next.statMin = "";
      }

      if (key === "position" && current.stat && metaQuery.data?.statGroups) {
        const allowedStats =
          value === "GK"
            ? metaQuery.data.statGroups.goalkeeper
            : value
              ? metaQuery.data.statGroups.outfield
              : [...metaQuery.data.statGroups.outfield, ...metaQuery.data.statGroups.goalkeeper];

        if (!(allowedStats as readonly string[]).includes(current.stat)) {
          next.stat = "";
          next.statMin = "";
        }
      }

      return next;
    });

    const event =
      key === "search" ? "collection_search_changed" : key === "sort" ? "collection_sort_changed" : key === "page" ? "collection_page_changed" : "collection_filter_changed";

    analytics.track(event, { key, value });
  }

  function openCard(card: PublicPlayerCardDto) {
    setSelectedCard(card);
    analytics.track("card_clicked", { cardId: card.id, tier: card.tier });
    analytics.track("card_detail_opened", { cardId: card.id });
  }

  function closeCard() {
    if (selectedCard) {
      analytics.track("card_detail_closed", { cardId: selectedCard.id });
    }
    setSelectedCard(null);
  }

  const data = cardsQuery.data;
  const isBusy = cardsQuery.isLoading || metaQuery.isLoading;
  const statGroups = metaQuery.data?.statGroups;
  const positionStatProfile =
    filters.position === "GK" ? "goalkeeper" : filters.position ? "outfield" : "all";

  return (
    <main className="collection-screen">
      <header className="collection-header">
        <div>
          <Link className="back-link" to="/">
            <ChevronLeft aria-hidden="true" />
            Menu
          </Link>
          <h1>Collection</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          title="Reset filters"
          onClick={() => {
            setFilters(initialFilters);
            analytics.track("collection_filter_changed", { action: "reset" });
          }}
        >
          <RotateCcw aria-hidden="true" />
        </button>
      </header>

      <section className="collection-toolbar" aria-label="Collection filters">
        <label className="search-field">
          <Search aria-hidden="true" />
          <input
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search players"
          />
        </label>

        <Select value={filters.tier} onChange={(value) => updateFilter("tier", value)} label="Tier">
          <option value="">All tiers</option>
          {CARD_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {labelize(tier)}
            </option>
          ))}
        </Select>

        <Select value={filters.nation} onChange={(value) => updateFilter("nation", value)} label="Nation">
          <option value="">All nations</option>
          {metaQuery.data?.nations.map((nation) => (
            <option key={nation.id} value={nation.flagCode}>
              {nation.name}
            </option>
          ))}
        </Select>

        <Select value={filters.position} onChange={(value) => updateFilter("position", value)} label="Position">
          <option value="">All positions</option>
          {metaQuery.data?.positions.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </Select>

        <Select value={filters.year} onChange={(value) => updateFilter("year", value)} label="Edition">
          <option value="">All years</option>
          {metaQuery.data?.years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>

        <Select value={filters.stat} onChange={(value) => updateFilter("stat", value)} label="Stat">
          <option value="">Any stat</option>
          {statGroups && positionStatProfile === "outfield"
            ? statGroups.outfield.map((stat) => (
                <option key={stat} value={stat}>
                  {labelize(stat)}
                </option>
              ))
            : null}
          {statGroups && positionStatProfile === "goalkeeper"
            ? statGroups.goalkeeper.map((stat) => (
                <option key={stat} value={stat}>
                  {labelize(stat)}
                </option>
              ))
            : null}
          {statGroups && positionStatProfile === "all" ? (
            <>
              <optgroup label="Outfield">
                {statGroups.outfield.map((stat) => (
                  <option key={stat} value={stat}>
                    {labelize(stat)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Goalkeeper">
                {statGroups.goalkeeper.map((stat) => (
                  <option key={stat} value={stat}>
                    {labelize(stat)}
                  </option>
                ))}
              </optgroup>
            </>
          ) : null}
        </Select>

        <label className="number-field">
          <span>Min</span>
          <input
            min="0"
            max="99"
            type="number"
            disabled={!filters.stat}
            value={filters.statMin}
            onChange={(event) => updateFilter("statMin", event.target.value)}
          />
        </label>

        <Select value={filters.sort} onChange={(value) => updateFilter("sort", value)} label="Sort">
          {SORT_OPTIONS.map((sort) => (
            <option key={sort} value={sort}>
              {labelize(sort)}
            </option>
          ))}
        </Select>
      </section>

      <section className="collection-status">
        <div>
          <SlidersHorizontal aria-hidden="true" />
          {data ? `${data.totalItems} cards` : "Loading collection"}
        </div>
        {data ? (
          <div>
            Page {data.page} of {data.totalPages}
          </div>
        ) : null}
      </section>

      {cardsQuery.isError || metaQuery.isError ? (
        <section className="empty-state" role="alert">
          <h2>Collection failed to load</h2>
          <p>Check that the API is running and the database has been migrated and seeded.</p>
        </section>
      ) : isBusy ? (
        <section className="card-grid" aria-label="Loading cards">
          {Array.from({ length: COLLECTION_PAGE_SIZE }).map((_, index) => (
            <PlayerCardSkeleton key={index} />
          ))}
        </section>
      ) : data && data.items.length > 0 ? (
        <section className="card-grid" aria-label="Player cards">
          {data.items.map((card) => (
            <PlayerCardFull
              key={card.id}
              card={card}
              animationMode="subtle"
              selected={selectedCard?.id === card.id}
              onClick={() => openCard(card)}
            />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <h2>No matching cards</h2>
          <p>Adjust the filters or reset the collection view.</p>
        </section>
      )}

      {data ? (
        <footer className="pagination">
          <button
            className="icon-button"
            type="button"
            title="Previous page"
            disabled={data.page <= 1}
            onClick={() => updateFilter("page", Math.max(1, data.page - 1))}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <span>
            {data.page} / {data.totalPages}
          </span>
          <button
            className="icon-button"
            type="button"
            title="Next page"
            disabled={data.page >= data.totalPages}
            onClick={() => updateFilter("page", Math.min(data.totalPages, data.page + 1))}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </footer>
      ) : null}

      <CardDetailDrawer card={selectedCard} onClose={closeCard} />
    </main>
  );
}

function Select(props: {
  value: string | number;
  label: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="select-field">
      <span>{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.children}
      </select>
    </label>
  );
}

function labelize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

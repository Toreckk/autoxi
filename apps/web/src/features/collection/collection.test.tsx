// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CardFilterMetadataDto, PaginatedCardsDto, PublicPlayerCardDto } from "@autoxi/domain";
import { getCards, getFilterMetadata } from "../../shared/api.js";
import { CollectionPage } from "./CollectionPage.js";

vi.mock("../../shared/api.js", () => ({
  getCards: vi.fn(),
  getFilterMetadata: vi.fn()
}));

vi.mock("../../shared/observability.js", () => ({
  analytics: {
    track: vi.fn()
  }
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("CollectionPage", () => {
  it("renders API cards with special-edition presentation and opens details", async () => {
    vi.mocked(getFilterMetadata).mockResolvedValue(filterMetadata);
    vi.mocked(getCards).mockResolvedValue(cardPage);

    const user = userEvent.setup();
    renderCollection();

    const goldenBallCard = await screen.findByRole("button", { name: "Leo Aranda, 98 CAM" });

    expect(screen.getByText("53 cards")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 6")).toBeInTheDocument();
    expect(goldenBallCard).toHaveClass("material-solar-gold");
    expect(goldenBallCard).toHaveClass("animation-glow-pulse");
    expect(within(goldenBallCard).getByText("Golden Ball")).toBeInTheDocument();
    expect(within(goldenBallCard).getByText("Qatar")).toBeInTheDocument();

    await user.click(goldenBallCard);

    const dialog = await screen.findByRole("dialog", { name: "Leo Aranda" });
    expect(within(dialog).getByText("Special Edition")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Golden Ball").length).toBeGreaterThanOrEqual(2);
  });
});

function renderCollection() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <CollectionPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const goldenBallCard: PublicPlayerCardDto = {
  id: "00000000-0000-4000-8000-000000000301",
  displayName: "Leo Aranda",
  shortName: "Aranda",
  rating: 98,
  tier: "ICON",
  cost: 13,
  position: "CAM",
  broadLine: "MIDFIELDER",
  statProfile: "OUTFIELD",
  nation: {
    id: "00000000-0000-4000-8000-000000000302",
    code: "ARG",
    name: "Argentina",
    flagCode: "arg"
  },
  worldCup: {
    id: "00000000-0000-4000-8000-000000000303",
    host: "Qatar",
    year: 2022,
    label: "Qatar 2022"
  },
  role: "Creator",
  stats: {
    profile: "OUTFIELD",
    pace: 87,
    shooting: 95,
    passing: 98,
    dribbling: 99,
    defending: 48,
    physical: 78
  },
  editionKey: "GOLDEN_BALL",
  editionLabel: "Golden Ball",
  materialKey: "solar-gold",
  animationPreset: "glow-pulse",
  animationLevel: "medium"
};

const diamondCard: PublicPlayerCardDto = {
  id: "00000000-0000-4000-8000-000000000304",
  displayName: "Aurel Voss",
  shortName: "Voss",
  rating: 94,
  tier: "HERO",
  cost: 10,
  position: "CM",
  broadLine: "MIDFIELDER",
  statProfile: "OUTFIELD",
  nation: {
    id: "00000000-0000-4000-8000-000000000305",
    code: "GER",
    name: "Germany",
    flagCode: "ger"
  },
  worldCup: {
    id: "00000000-0000-4000-8000-000000000306",
    host: "Germany",
    year: 2006,
    label: "Germany 2006"
  },
  role: "Tempo Setter",
  stats: {
    profile: "OUTFIELD",
    pace: 83,
    shooting: 86,
    passing: 96,
    dribbling: 91,
    defending: 82,
    physical: 84
  },
  editionKey: "NONE",
  editionLabel: null,
  materialKey: "diamond",
  animationPreset: "premium-glow",
  animationLevel: "premium"
};

const cardPage: PaginatedCardsDto = {
  items: [goldenBallCard, diamondCard],
  page: 1,
  pageSize: 10,
  totalItems: 53,
  totalPages: 6
};

const filterMetadata: CardFilterMetadataDto = {
  tiers: ["SQUAD_PLAYER", "STARTER", "KEY_PLAYER", "STAR", "WORLD_CLASS", "HERO", "ICON"],
  positions: ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST"],
  broadLines: ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"],
  roles: ["Shot Stopper", "Anchor", "Wingback", "Ball Winner", "Tempo Setter", "Creator", "Wide Threat", "Finisher"],
  statKeys: [
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defending",
    "physical",
    "diving",
    "handling",
    "kicking",
    "reflexes",
    "speed",
    "positioning"
  ],
  statGroups: {
    outfield: ["pace", "shooting", "passing", "dribbling", "defending", "physical"],
    goalkeeper: ["diving", "handling", "kicking", "reflexes", "speed", "positioning"]
  },
  sortOptions: ["rating_desc", "rating_asc", "name_asc", "name_desc"],
  nations: [
    { id: "00000000-0000-4000-8000-000000000302", code: "ARG", name: "Argentina", flagCode: "arg" },
    { id: "00000000-0000-4000-8000-000000000305", code: "GER", name: "Germany", flagCode: "ger" }
  ],
  years: [2022, 2006],
  hosts: ["Qatar", "Germany"]
};

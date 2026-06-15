import { X } from "lucide-react";
import type { PublicPlayerCardDto } from "@autoxi/domain";
import { PlayerCardCompact } from "./PlayerCard.js";

const statLabels = {
  pace: "PAC",
  shooting: "SHO",
  passing: "PAS",
  dribbling: "DRI",
  defending: "DEF",
  physical: "PHY",
  diving: "DIV",
  handling: "HAN",
  kicking: "KIC",
  reflexes: "REF",
  speed: "SPD",
  positioning: "POS"
} as const;

export function CardDetailDrawer({
  card,
  onClose
}: {
  card: PublicPlayerCardDto | null;
  onClose: () => void;
}) {
  if (!card) return null;

  const flagSrc = card.nation.flagCode ? `/flags/${card.nation.flagCode}.svg` : "/flags/unknown.svg";
  const statEntries = Object.entries(card.stats).filter(([key]) => key !== "profile") as Array<
    [keyof typeof statLabels, number]
  >;

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">
              {card.tier.replaceAll("_", " ")}
              {card.editionLabel ? ` / ${card.editionLabel}` : ""}
            </p>
            <h2 id="card-detail-title">{card.displayName}</h2>
          </div>
          <button className="icon-button" type="button" title="Close detail" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <PlayerCardCompact card={card} animationMode="full" />

        <dl className="detail-list">
          <div>
            <dt>Nation</dt>
            <dd>
              <img className="flag flag--inline" src={card.nation.flagUrl ?? flagSrc} alt="" />
              {card.nation.name}
            </dd>
          </div>
          <div>
            <dt>Edition</dt>
            <dd>{card.worldCup.label}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{card.role}</dd>
          </div>
          {card.editionLabel ? (
            <div>
              <dt>Special Edition</dt>
              <dd>{card.editionLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt>Cost</dt>
            <dd>{card.cost}</dd>
          </div>
        </dl>

        <dl className="detail-stats">
          {statEntries.map(([key, value]) => (
            <div key={key}>
              <dt>{statLabels[key]}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}

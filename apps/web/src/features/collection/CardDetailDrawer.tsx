import { X } from "lucide-react";
import type { PublicPlayerCardDto } from "@autoxi/domain";
import { PlayerCardCompact } from "./PlayerCard.js";

export function CardDetailDrawer({
  card,
  onClose
}: {
  card: PublicPlayerCardDto | null;
  onClose: () => void;
}) {
  if (!card) return null;

  const flagSrc = card.nation.flagCode ? `/flags/${card.nation.flagCode}.svg` : "/flags/unknown.svg";

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
            <p className="eyebrow">{card.tier.replaceAll("_", " ")}</p>
            <h2 id="card-detail-title">{card.displayName}</h2>
          </div>
          <button className="icon-button" type="button" title="Close detail" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <PlayerCardCompact card={card} animationMode="subtle" />

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
          <div>
            <dt>Cost</dt>
            <dd>{card.cost}</dd>
          </div>
        </dl>

        <dl className="detail-stats">
          {Object.entries(card.stats).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}

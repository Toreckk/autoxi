import type { PublicPlayerCardDto } from "@autoxi/domain";

type PlayerCardProps = {
  card: PublicPlayerCardDto;
  size?: "full" | "compact" | "mini";
  animationMode?: "none" | "subtle" | "full" | "hover";
  discovered?: boolean;
  selected?: boolean;
  onClick?: () => void;
};

export function PlayerCardFull(props: PlayerCardProps) {
  return <PlayerCard {...props} size="full" />;
}

export function PlayerCardCompact(props: PlayerCardProps) {
  return <PlayerCard {...props} size="compact" />;
}

export function PlayerCardMini(props: PlayerCardProps) {
  return <PlayerCard {...props} size="mini" />;
}

function PlayerCard({
  card,
  size = "full",
  animationMode = "hover",
  discovered = true,
  selected = false,
  onClick
}: PlayerCardProps) {
  const Element = onClick ? "button" : "article";

  const flagSrc = card.nation.flagCode ? `/flags/${card.nation.flagCode}.svg` : "/flags/unknown.svg";
  const compactStats: Array<{ label: string; value: number }> =
    card.stats.profile === "GOALKEEPER"
      ? [
          { label: "DIV", value: card.stats.diving },
          { label: "HAN", value: card.stats.handling },
          { label: "KIC", value: card.stats.kicking },
          { label: "REF", value: card.stats.reflexes },
          { label: "SPD", value: card.stats.speed },
          { label: "POS", value: card.stats.positioning }
        ]
      : [
          { label: "PAC", value: card.stats.pace },
          { label: "SHO", value: card.stats.shooting },
          { label: "PAS", value: card.stats.passing },
          { label: "DRI", value: card.stats.dribbling },
          { label: "DEF", value: card.stats.defending },
          { label: "PHY", value: card.stats.physical }
        ];

  return (
    <Element
      className={`player-card player-card--${size} material-${card.materialKey} animation-${card.animationPreset}${selected ? " is-selected" : ""}`}
      data-animation={animationMode}
      data-edition={card.editionKey}
      data-tier={card.tier}
      onClick={onClick}
      type={Element === "button" ? "button" : undefined}
      aria-label={`${card.displayName}, ${card.rating} ${card.position}`}
    >
      <div className="player-card__outer-effect" aria-hidden="true" />
      <div className="player-card__inner">
        <div className="player-card__flow" aria-hidden="true" />
        <div className="player-card__sheen" aria-hidden="true" />
        <div className="player-card__grain" aria-hidden="true" />
        <div className="player-card__top">
          <div className="rating-block">
            <strong>{discovered ? card.rating : "??"}</strong>
            <span>{card.position}</span>
          </div>
          <img className="flag" src={card.nation.flagUrl ?? flagSrc} alt="" />
        </div>
        <div className="player-card__name">
          {card.editionLabel ? <span className="player-card__edition">{card.editionLabel}</span> : null}
          <strong>{discovered ? card.displayName : "Unknown"}</strong>
          <span>{card.role}</span>
        </div>
        {size === "compact" ? (
          <dl className="stat-strip">
            {compactStats.map(({ label, value }) => (
              <Stat key={label} label={label} value={value} />
            ))}
          </dl>
        ) : null}
        <div className="player-card__plate">
          <span>{card.worldCup.host}</span>
          <strong>{card.worldCup.year}</strong>
        </div>
      </div>
    </Element>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function PlayerCardSkeleton() {
  return (
    <div className="player-card player-card--full skeleton-card" aria-hidden="true">
      <div className="player-card__inner">
        <div className="skeleton-line skeleton-line--short" />
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

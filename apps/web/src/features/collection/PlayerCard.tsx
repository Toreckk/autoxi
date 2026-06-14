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

  return (
    <Element
      className={`player-card player-card--${size} material-${card.materialKey}${selected ? " is-selected" : ""}`}
      data-animation={animationMode}
      data-tier={card.tier}
      onClick={onClick}
      type={Element === "button" ? "button" : undefined}
      aria-label={`${card.displayName}, ${card.rating} ${card.position}`}
    >
      <div className="player-card__inner">
        <div className="player-card__flow" aria-hidden="true" />
        <div className="player-card__grain" aria-hidden="true" />
        <div className="player-card__top">
          <div className="rating-block">
            <strong>{discovered ? card.rating : "??"}</strong>
            <span>{card.position}</span>
          </div>
          <img className="flag" src={card.nation.flagUrl ?? flagSrc} alt="" />
        </div>
        <div className="player-card__name">
          <strong>{discovered ? card.displayName : "Unknown"}</strong>
          <span>{card.role}</span>
        </div>
        {size === "compact" ? (
          <dl className="stat-strip">
            <Stat label="PAC" value={card.stats.pace} />
            <Stat label="SHO" value={card.stats.shooting} />
            <Stat label="PAS" value={card.stats.passing} />
            <Stat label="DRI" value={card.stats.dribbling} />
            <Stat label="DEF" value={card.stats.defending} />
            <Stat label="PHY" value={card.stats.physical} />
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

DO $$ BEGIN
  CREATE TYPE stat_profile AS ENUM ('OUTFIELD', 'GOALKEEPER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TYPE alias_risk_level ADD VALUE IF NOT EXISTS 'SAFE';
ALTER TYPE alias_risk_level ADD VALUE IF NOT EXISTS 'EVOCATIVE';
ALTER TYPE alias_risk_level ADD VALUE IF NOT EXISTS 'RISKY';
ALTER TYPE alias_risk_level ADD VALUE IF NOT EXISTS 'BLOCKED';

ALTER TABLE player_cards ADD COLUMN IF NOT EXISTS stat_profile stat_profile;
UPDATE player_cards
SET stat_profile = CASE WHEN position = 'GK' THEN 'GOALKEEPER'::stat_profile ELSE 'OUTFIELD'::stat_profile END
WHERE stat_profile IS NULL;
ALTER TABLE player_cards ALTER COLUMN stat_profile SET NOT NULL;

ALTER TABLE player_cards DROP CONSTRAINT IF EXISTS player_cards_rating_check;
ALTER TABLE player_cards ADD CONSTRAINT player_cards_rating_check CHECK (rating between 55 and 99);

CREATE TABLE IF NOT EXISTS player_card_outfield_stats (
  card_id uuid PRIMARY KEY REFERENCES player_cards(id) ON DELETE CASCADE,
  pace integer NOT NULL,
  shooting integer NOT NULL,
  passing integer NOT NULL,
  dribbling integer NOT NULL,
  defending integer NOT NULL,
  physical integer NOT NULL,
  CONSTRAINT player_card_outfield_stats_pace_check CHECK (pace between 0 and 99),
  CONSTRAINT player_card_outfield_stats_shooting_check CHECK (shooting between 0 and 99),
  CONSTRAINT player_card_outfield_stats_passing_check CHECK (passing between 0 and 99),
  CONSTRAINT player_card_outfield_stats_dribbling_check CHECK (dribbling between 0 and 99),
  CONSTRAINT player_card_outfield_stats_defending_check CHECK (defending between 0 and 99),
  CONSTRAINT player_card_outfield_stats_physical_check CHECK (physical between 0 and 99)
);

CREATE TABLE IF NOT EXISTS player_card_goalkeeper_stats (
  card_id uuid PRIMARY KEY REFERENCES player_cards(id) ON DELETE CASCADE,
  diving integer NOT NULL,
  handling integer NOT NULL,
  kicking integer NOT NULL,
  reflexes integer NOT NULL,
  speed integer NOT NULL,
  positioning integer NOT NULL,
  CONSTRAINT player_card_goalkeeper_stats_diving_check CHECK (diving between 0 and 99),
  CONSTRAINT player_card_goalkeeper_stats_handling_check CHECK (handling between 0 and 99),
  CONSTRAINT player_card_goalkeeper_stats_kicking_check CHECK (kicking between 0 and 99),
  CONSTRAINT player_card_goalkeeper_stats_reflexes_check CHECK (reflexes between 0 and 99),
  CONSTRAINT player_card_goalkeeper_stats_speed_check CHECK (speed between 0 and 99),
  CONSTRAINT player_card_goalkeeper_stats_positioning_check CHECK (positioning between 0 and 99)
);

INSERT INTO player_card_outfield_stats (card_id, pace, shooting, passing, dribbling, defending, physical)
SELECT stats.card_id, stats.pace, stats.shooting, stats.passing, stats.dribbling, stats.defending, stats.physical
FROM player_card_stats stats
JOIN player_cards cards ON cards.id = stats.card_id
WHERE cards.stat_profile = 'OUTFIELD'
ON CONFLICT (card_id) DO NOTHING;

INSERT INTO player_card_goalkeeper_stats (card_id, diving, handling, kicking, reflexes, speed, positioning)
SELECT
  stats.card_id,
  GREATEST(0, LEAST(99, stats.goalkeeping)),
  GREATEST(0, LEAST(99, stats.physical)),
  GREATEST(0, LEAST(99, stats.passing)),
  GREATEST(0, LEAST(99, stats.goalkeeping + 2)),
  GREATEST(0, LEAST(99, stats.pace)),
  GREATEST(0, LEAST(99, stats.defending + 45))
FROM player_card_stats stats
JOIN player_cards cards ON cards.id = stats.card_id
WHERE cards.stat_profile = 'GOALKEEPER'
ON CONFLICT (card_id) DO NOTHING;

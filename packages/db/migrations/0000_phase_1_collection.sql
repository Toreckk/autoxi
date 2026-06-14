CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE card_tier AS ENUM ('SQUAD_PLAYER', 'STARTER', 'KEY_PLAYER', 'STAR', 'WORLD_CLASS', 'HERO', 'ICON');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE visible_position AS ENUM ('GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE broad_line AS ENUM ('GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE card_role AS ENUM ('Shot Stopper', 'Anchor', 'Wingback', 'Ball Winner', 'Tempo Setter', 'Creator', 'Wide Threat', 'Finisher');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE material_key AS ENUM ('matte-graphite', 'brushed-steel', 'emerald-composite', 'violet-phase', 'cobalt-gold', 'ruby-hero', 'black-pearl-icon', 'ivory-gold-icon');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE alias_risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS nations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso2_code text,
  iso3_code text,
  fifa_code text,
  display_name text NOT NULL,
  flag_code text NOT NULL,
  flag_asset_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nations_flag_code_unique UNIQUE (flag_code)
);

CREATE INDEX IF NOT EXISTS nations_display_name_idx ON nations (display_name);
CREATE INDEX IF NOT EXISTS nations_fifa_code_idx ON nations (fifa_code);

CREATE TABLE IF NOT EXISTS world_cup_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE,
  host_name text NOT NULL,
  host_country_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_cup_editions_host_name_idx ON world_cup_editions (host_name);

CREATE TABLE IF NOT EXISTS source_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_version text,
  source_url text,
  license_note text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS source_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_import_id uuid NOT NULL REFERENCES source_imports(id) ON DELETE CASCADE,
  source_provider text NOT NULL,
  source_external_id text NOT NULL,
  raw_name text NOT NULL,
  raw_nationality text,
  raw_position text,
  raw_payload_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_players_provider_external_unique UNIQUE (source_provider, source_external_id)
);

CREATE INDEX IF NOT EXISTS source_players_raw_name_idx ON source_players (raw_name);

CREATE TABLE IF NOT EXISTS player_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_key text NOT NULL UNIQUE,
  source_player_id uuid REFERENCES source_players(id) ON DELETE SET NULL,
  nationality_id uuid NOT NULL REFERENCES nations(id) ON DELETE RESTRICT,
  canonical_position text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_identities_nationality_idx ON player_identities (nationality_id);

CREATE TABLE IF NOT EXISTS player_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_identity_id uuid NOT NULL REFERENCES player_identities(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  short_name text NOT NULL,
  locale_hint text,
  risk_level alias_risk_level NOT NULL DEFAULT 'LOW',
  generation_method text NOT NULL,
  is_approved boolean NOT NULL DEFAULT false,
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT player_aliases_identity_display_unique UNIQUE (player_identity_id, display_name)
);

CREATE INDEX IF NOT EXISTS player_aliases_identity_idx ON player_aliases (player_identity_id);
CREATE INDEX IF NOT EXISTS player_aliases_approved_idx ON player_aliases (is_approved);

CREATE TABLE IF NOT EXISTS player_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_identity_id uuid NOT NULL REFERENCES player_identities(id) ON DELETE CASCADE,
  nation_id uuid NOT NULL REFERENCES nations(id) ON DELETE RESTRICT,
  world_cup_edition_id uuid NOT NULL REFERENCES world_cup_editions(id) ON DELETE RESTRICT,
  alias_id uuid NOT NULL REFERENCES player_aliases(id) ON DELETE RESTRICT,
  rating integer NOT NULL,
  tier card_tier NOT NULL,
  tier_override card_tier,
  position visible_position NOT NULL,
  broad_line broad_line NOT NULL,
  role card_role NOT NULL,
  cost integer NOT NULL,
  material_key material_key NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_cards_identity_edition_unique UNIQUE (player_identity_id, world_cup_edition_id),
  CONSTRAINT player_cards_rating_check CHECK (rating between 1 and 99),
  CONSTRAINT player_cards_cost_check CHECK (cost >= 0)
);

CREATE INDEX IF NOT EXISTS player_cards_rating_idx ON player_cards (rating);
CREATE INDEX IF NOT EXISTS player_cards_tier_idx ON player_cards (tier);
CREATE INDEX IF NOT EXISTS player_cards_position_idx ON player_cards (position);
CREATE INDEX IF NOT EXISTS player_cards_broad_line_idx ON player_cards (broad_line);
CREATE INDEX IF NOT EXISTS player_cards_nation_idx ON player_cards (nation_id);
CREATE INDEX IF NOT EXISTS player_cards_world_cup_idx ON player_cards (world_cup_edition_id);

CREATE TABLE IF NOT EXISTS player_card_stats (
  card_id uuid PRIMARY KEY REFERENCES player_cards(id) ON DELETE CASCADE,
  pace integer NOT NULL,
  shooting integer NOT NULL,
  passing integer NOT NULL,
  dribbling integer NOT NULL,
  defending integer NOT NULL,
  physical integer NOT NULL,
  goalkeeping integer NOT NULL,
  CONSTRAINT player_card_stats_pace_check CHECK (pace between 0 and 99),
  CONSTRAINT player_card_stats_shooting_check CHECK (shooting between 0 and 99),
  CONSTRAINT player_card_stats_passing_check CHECK (passing between 0 and 99),
  CONSTRAINT player_card_stats_dribbling_check CHECK (dribbling between 0 and 99),
  CONSTRAINT player_card_stats_defending_check CHECK (defending between 0 and 99),
  CONSTRAINT player_card_stats_physical_check CHECK (physical between 0 and 99),
  CONSTRAINT player_card_stats_goalkeeping_check CHECK (goalkeeping between 0 and 99)
);

CREATE TABLE IF NOT EXISTS card_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES player_cards(id) ON DELETE CASCADE,
  tag text NOT NULL,
  CONSTRAINT card_tags_card_tag_unique UNIQUE (card_id, tag)
);

CREATE INDEX IF NOT EXISTS card_tags_tag_idx ON card_tags (tag);

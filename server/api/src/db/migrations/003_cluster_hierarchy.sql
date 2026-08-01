ALTER TABLE clusters
	ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'cluster';

CREATE INDEX IF NOT EXISTS clusters_kind_state_idx
	ON clusters (kind, accepted_at, dismissed_at, confidence DESC);

CREATE TABLE IF NOT EXISTS clusters (
	id text PRIMARY KEY,
	name text NOT NULL,
	confidence double precision NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	accepted_at timestamptz,
	dismissed_at timestamptz,
	accepted_note_id text,
	parent_id text
);

CREATE TABLE IF NOT EXISTS cluster_members (
	cluster_id text NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
	note_id text NOT NULL,
	score double precision NOT NULL,
	PRIMARY KEY (cluster_id, note_id)
);

CREATE TABLE IF NOT EXISTS cluster_feedback (
	id bigserial PRIMARY KEY,
	cluster_id text NOT NULL,
	event_type text NOT NULL,
	event_data jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clusters_active_idx
	ON clusters (confidence DESC)
	WHERE accepted_at IS NULL AND dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS cluster_members_note_id_idx ON cluster_members (note_id);
CREATE INDEX IF NOT EXISTS cluster_feedback_cluster_id_idx ON cluster_feedback (cluster_id);

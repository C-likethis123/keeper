CREATE TABLE IF NOT EXISTS devices (
	id text PRIMARY KEY,
	name text,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notes (
	id text PRIMARY KEY,
	path text NOT NULL UNIQUE,
	title text NOT NULL,
	markdown text NOT NULL,
	created_at timestamptz NOT NULL,
	updated_at timestamptz NOT NULL,
	deleted_at timestamptz,
	version bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_ops (
	id bigserial PRIMARY KEY,
	op_id text NOT NULL UNIQUE,
	device_id text NOT NULL REFERENCES devices(id),
	device_seq bigint NOT NULL,
	type text NOT NULL,
	note_id text NOT NULL,
	payload jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (device_id, device_seq)
);

CREATE INDEX IF NOT EXISTS sync_ops_note_id_idx ON sync_ops (note_id);
CREATE INDEX IF NOT EXISTS sync_ops_created_at_idx ON sync_ops (created_at);
CREATE INDEX IF NOT EXISTS notes_deleted_at_idx ON notes (deleted_at);

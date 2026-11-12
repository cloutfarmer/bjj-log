-- AI output lives in its own tables. Nothing here stores or changes note text:
-- bjj_entries.text is written only by the journal's own save.

-- The tag-to-bucket map. The bucket belongs to the tag, so it is chosen once, when the
-- tag is created. The bucket list is fixed in lib/ai/buckets.ts and checked there, not
-- here, so changing the list never needs a migration.
CREATE TABLE bjj_tags (
  name text PRIMARY KEY CHECK (length(name) BETWEEN 1 AND 40),
  bucket text NOT NULL CHECK (length(bucket) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Several tags per entry, one row each. The limit of 5 per entry is enforced in
-- lib/ai/store.ts. source says who set that tag: 'code' (text match, no model call),
-- 'ai' (model), or 'user'.
CREATE TABLE bjj_entry_tags (
  entry_date date NOT NULL REFERENCES bjj_entries (entry_date) ON DELETE CASCADE,
  tag text NOT NULL REFERENCES bjj_tags (name) ON UPDATE CASCADE,
  source text NOT NULL CHECK (source IN ('code', 'ai', 'user')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_date, tag)
);

-- The lookup by tag: every entry that carries a given tag.
CREATE INDEX bjj_entry_tags_tag ON bjj_entry_tags (tag);

-- What tagging knows about an entry apart from the tags themselves. text_hash is the
-- hash of the note text the tags were derived from, so an unchanged note is never
-- tagged twice. by_user is set the first time the tags are changed by hand; from then
-- on no job touches that entry's tags, so a removed tag stays removed. A row here with
-- no rows in bjj_entry_tags means "checked, no tags" or "all tags removed by hand".
CREATE TABLE bjj_entry_tag_state (
  entry_date date PRIMARY KEY REFERENCES bjj_entries (entry_date) ON DELETE CASCADE,
  text_hash text NOT NULL,
  by_user boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The latest saved output of each job for each scope (a date, a week, a text hash),
-- with the hash of the input that produced it. A matching hash means no model call.
CREATE TABLE bjj_ai_outputs (
  job text NOT NULL,
  scope text NOT NULL,
  input_hash text NOT NULL,
  output jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job, scope)
);

-- One row per model call, so each feature's cost is visible. Counts only, never text.
CREATE TABLE bjj_ai_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL CHECK (output_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

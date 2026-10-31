CREATE TABLE bjj_entries (
  entry_date date PRIMARY KEY,
  text text NOT NULL CHECK (length(text) <= 50000),
  session_types text[] NOT NULL DEFAULT '{}' CHECK (cardinality(session_types) <= 20),
  updated_at timestamptz NOT NULL DEFAULT now()
);

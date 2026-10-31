-- Gi vs no-gi is one choice per session, so it is a column with a closed set of
-- values rather than another entry in session_types. Nullable with no default:
-- existing rows were trained in something, but the journal never asked which.
ALTER TABLE bjj_entries
  ADD COLUMN attire text CHECK (attire IN ('gi', 'nogi'));

CREATE TABLE IF NOT EXISTS thoughts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('convention', 'instruction', 'correction', 'preference', 'other')),
    topics_json TEXT NOT NULL,
    project TEXT,
    scope TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS thoughts_project_id ON thoughts(project, id);
CREATE INDEX IF NOT EXISTS thoughts_type_id ON thoughts(type, id);

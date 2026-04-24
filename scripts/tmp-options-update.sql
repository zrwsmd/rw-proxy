INSERT INTO options (key, value) VALUES ('UserUsableGroups', '{"plugin-bailian":"Plugin Bailian"}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
INSERT INTO options (key, value) VALUES ('GroupRatio', '{"default":1,"vip":1,"svip":1,"plugin-bailian":1}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
SELECT key, value FROM options WHERE key IN ('UserUsableGroups','GroupRatio');

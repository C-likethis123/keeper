mod v1_init;
mod v2_add_fts;
mod v3_add_note_metadata;

use rusqlite::Connection;

pub struct Migration {
    pub version: i64,
    pub apply: fn(&Connection) -> Result<(), String>,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        apply: v1_init::apply,
    },
    Migration {
        version: 2,
        apply: v2_add_fts::apply,
    },
    Migration {
        version: 3,
        apply: v3_add_note_metadata::apply,
    },
];

pub fn migrate_if_needed(conn: &Connection) -> Result<(), String> {
    let mut current_version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| format!("failed to read user_version: {e}"))?;

    for migration in MIGRATIONS {
        if migration.version <= current_version {
            continue;
        }
        (migration.apply)(conn)?;
        current_version = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .map_err(|e| {
                format!(
                    "failed to read user_version after v{}: {e}",
                    migration.version
                )
            })?;
    }

    Ok(())
}

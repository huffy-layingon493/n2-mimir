// migration.rs — Schema migration runner (versioned evolution)

use rusqlite::Connection;
use crate::schema::SCHEMA_VERSION;

/// Migration definitions: target_version → SQL statements
fn get_migrations() -> Vec<(u32, Vec<&'static str>)> {
    vec![
        // v1 is the initial schema (created by SCHEMA_SQL)
        // Future migrations:
        // (2, vec![
        //     "ALTER TABLE experiences ADD COLUMN embedding_status TEXT DEFAULT NULL;",
        //     "CREATE INDEX IF NOT EXISTS idx_exp_embedding ON experiences(embedding_status);",
        // ]),
    ]
}

/// Read current schema version from meta table
fn get_current_version(conn: &Connection) -> u32 {
    conn.query_row(
        "SELECT value FROM meta WHERE key = 'schema_version'",
        [],
        |row| {
            let val: String = row.get(0)?;
            Ok(val.parse::<u32>().unwrap_or(0))
        },
    )
    .unwrap_or(0)
}

/// Update schema version in meta table
fn set_version(conn: &Connection, version: u32) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?1)",
        [version.to_string()],
    )?;
    Ok(())
}

/// Run all pending migrations from current version to SCHEMA_VERSION.
/// Each migration runs atomically in a savepoint.
///
/// Returns number of migrations applied.
pub fn run_migrations(conn: &mut Connection) -> rusqlite::Result<u32> {
    let current = get_current_version(conn);
    if current >= SCHEMA_VERSION {
        return Ok(0);
    }

    let migrations = get_migrations();
    let mut applied = 0u32;

    for (target_version, sqls) in &migrations {
        if *target_version <= current {
            continue;
        }
        if *target_version > SCHEMA_VERSION {
            break;
        }

        let sp = conn.savepoint()?;
        for sql in sqls {
            sp.execute_batch(sql)?;
        }
        set_version(&sp, *target_version)?;
        sp.commit()?;
        applied += 1;
    }

    // Ensure version is current even if no migrations needed
    if applied == 0 {
        set_version(conn, SCHEMA_VERSION)?;
    }

    Ok(applied)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_migration_version_tracking() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);")
            .unwrap();

        assert_eq!(get_current_version(&conn), 0);
        set_version(&conn, 1).unwrap();
        assert_eq!(get_current_version(&conn), 1);
    }
}

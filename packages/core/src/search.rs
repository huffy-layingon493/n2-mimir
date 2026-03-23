// search.rs — FTS5 full-text search + tag chain cascading recall

use rusqlite::params;
use serde::Serialize;

use crate::db;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RankedExperience {
    id: String,
    timestamp: String,
    session_id: String,
    agent: String,
    project: String,
    #[serde(rename = "type")]
    exp_type: String,
    category: String,
    severity: String,
    context: String,
    action: String,
    outcome: String,
    correction: Option<String>,
    source_ref: Option<String>,
    frequency: i64,
    token_cost: i64,
    created_at: String,
    rank: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TagFrequency {
    level: i64,
    tag: String,
    frequency: i64,
}

/// FTS5 full-text search on experiences (BM25 ranking)
pub fn fts_search(
    handle: i64,
    query: &str,
    limit: usize,
) -> Result<String, Box<dyn std::error::Error>> {
    db::with_conn(handle, |conn| {
        let mut stmt = conn.prepare(
            "SELECT e.id, e.timestamp, e.session_id, e.agent, e.project, e.type,
                e.category, e.severity, e.context, e.action, e.outcome, e.correction,
                e.source_ref, e.frequency, e.token_cost, e.created_at, rank
            FROM experiences_fts fts
            JOIN experiences e ON e.rowid = fts.rowid
            WHERE experiences_fts MATCH ?1
            ORDER BY rank
            LIMIT ?2",
        )?;

        let rows = stmt.query_map(params![query, limit as i64], |row| {
            Ok(RankedExperience {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                session_id: row.get(2)?,
                agent: row.get(3)?,
                project: row.get(4)?,
                exp_type: row.get(5)?,
                category: row.get(6)?,
                severity: row.get(7)?,
                context: row.get(8)?,
                action: row.get(9)?,
                outcome: row.get(10)?,
                correction: row.get(11)?,
                source_ref: row.get(12)?,
                frequency: row.get(13)?,
                token_cost: row.get(14)?,
                created_at: row.get(15)?,
                rank: row.get(16)?,
            })
        })?;

        let results: Vec<RankedExperience> = rows.filter_map(|r| r.ok()).collect();
        Ok(serde_json::to_string(&results)?)
    })
}

/// Get tag frequencies for cascading recall (architecture.md 8-3 Step 3)
pub fn tag_frequencies(
    handle: i64,
    tags_json: &str,
    limit: usize,
) -> Result<String, Box<dyn std::error::Error>> {
    let tags: Vec<String> = serde_json::from_str(tags_json)?;
    if tags.is_empty() {
        return Ok("[]".to_string());
    }

    db::with_conn(handle, |conn| {
        let placeholders: String = tags.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT level, tag, COUNT(*) as frequency
            FROM tags WHERE tag IN ({})
            GROUP BY level, tag
            ORDER BY frequency DESC
            LIMIT ?",
            placeholders
        );

        let mut stmt = conn.prepare(&sql)?;

        // Build params: tags + limit
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        for tag in &tags {
            param_values.push(Box::new(tag.clone()));
        }
        param_values.push(Box::new(limit as i64));

        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();

        let rows = stmt.query_map(params_ref.as_slice(), |row| {
            Ok(TagFrequency {
                level: row.get(0)?,
                tag: row.get(1)?,
                frequency: row.get(2)?,
            })
        })?;

        let results: Vec<TagFrequency> = rows.filter_map(|r| r.ok()).collect();
        Ok(serde_json::to_string(&results)?)
    })
}

/// Find experiences by tags (cascading recall — architecture.md 8-3 Step 2)
pub fn find_by_tags(
    handle: i64,
    tags_json: &str,
    limit: usize,
) -> Result<String, Box<dyn std::error::Error>> {
    let tags: Vec<String> = serde_json::from_str(tags_json)?;
    if tags.is_empty() {
        return Ok("[]".to_string());
    }

    db::with_conn(handle, |conn| {
        let placeholders: String = tags.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT DISTINCT e.id, e.timestamp, e.session_id, e.agent, e.project, e.type,
                e.category, e.severity, e.context, e.action, e.outcome, e.correction,
                e.source_ref, e.frequency, e.token_cost, e.created_at
            FROM experiences e
            JOIN tags t ON t.experience_id = e.id
            WHERE t.tag IN ({})
            ORDER BY e.created_at DESC
            LIMIT ?",
            placeholders
        );

        let mut stmt = conn.prepare(&sql)?;

        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        for tag in &tags {
            param_values.push(Box::new(tag.clone()));
        }
        param_values.push(Box::new(limit as i64));

        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();

        let rows = stmt.query_map(params_ref.as_slice(), |row| {
            Ok(RankedExperience {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                session_id: row.get(2)?,
                agent: row.get(3)?,
                project: row.get(4)?,
                exp_type: row.get(5)?,
                category: row.get(6)?,
                severity: row.get(7)?,
                context: row.get(8)?,
                action: row.get(9)?,
                outcome: row.get(10)?,
                correction: row.get(11)?,
                source_ref: row.get(12)?,
                frequency: row.get(13)?,
                token_cost: row.get(14)?,
                created_at: row.get(15)?,
                rank: 0,
            })
        })?;

        let results: Vec<RankedExperience> = rows.filter_map(|r| r.ok()).collect();
        Ok(serde_json::to_string(&results)?)
    })
}

// db.rs — SQLite database core (rusqlite zero-copy)
// All I/O operations: read/write/search/migration

use std::collections::HashMap;
use std::sync::Mutex;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::migration;
use crate::schema;

// === Global database handle registry ===

lazy_static::lazy_static! {
    static ref DB_REGISTRY: Mutex<HashMap<i64, Connection>> = Mutex::new(HashMap::new());
    static ref HANDLE_COUNTER: Mutex<i64> = Mutex::new(0);
}

/// Open or create a Mímir database. Returns a handle ID.
pub fn open(db_path: &str) -> Result<i64, Box<dyn std::error::Error>> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA journal_mode = WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.execute_batch(schema::SCHEMA_SQL)?;
    migration::run_migrations(&conn)?;

    let mut counter = HANDLE_COUNTER.lock().unwrap();
    *counter += 1;
    let handle = *counter;

    let mut registry = DB_REGISTRY.lock().unwrap();
    registry.insert(handle, conn);

    Ok(handle)
}

/// Close a database handle.
pub fn close(handle: i64) -> Result<(), Box<dyn std::error::Error>> {
    let mut registry = DB_REGISTRY.lock().unwrap();
    registry.remove(&handle);
    Ok(())
}

/// Helper: access a connection by handle
pub(crate) fn with_conn<F, T>(handle: i64, f: F) -> Result<T, Box<dyn std::error::Error>>
where
    F: FnOnce(&Connection) -> Result<T, Box<dyn std::error::Error>>,
{
    let registry = DB_REGISTRY.lock().unwrap();
    let conn = registry
        .get(&handle)
        .ok_or("Invalid database handle")?;
    f(conn)
}

// === Serde types for JSON interchange ===

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExperienceInput {
    agent: String,
    project: String,
    #[serde(rename = "type")]
    exp_type: String,
    category: String,
    severity: Option<String>,
    context: String,
    action: String,
    outcome: String,
    correction: Option<String>,
    source_ref: Option<String>,
    session_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExperienceRow {
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
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExperienceFilter {
    project: Option<String>,
    agent: Option<String>,
    category: Option<String>,
    #[serde(rename = "type")]
    exp_type: Option<String>,
    severity: Option<String>,
    since: Option<String>,
    limit: Option<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InsightInput {
    agent: String,
    description: String,
    compressed: String,
    token_cost: Option<i64>,
    category: String,
    scope: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InsightRow {
    id: String,
    created_at: String,
    updated_at: String,
    agent: String,
    description: String,
    compressed: String,
    token_cost: i64,
    category: String,
    scope: String,
    importance: i64,
    confidence: f64,
    effect_score: f64,
    status: String,
    converted_type: Option<String>,
    converted_ref: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InsightFilter {
    agent: Option<String>,
    category: Option<String>,
    scope: Option<String>,
    status: Option<String>,
    min_importance: Option<i64>,
    limit: Option<i64>,
}

#[derive(Deserialize)]
struct TagInput {
    level: i64,
    tag: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EffectInput {
    insight_id: String,
    session_id: String,
    was_relevant: bool,
    was_followed: bool,
    outcome: String,
}

// === Utility ===

/// Estimate token cost (1 token ≈ 4 chars)
fn estimate_tokens(text: &str) -> i64 {
    ((text.len() as f64) / 4.0).ceil() as i64
}

// === Experience CRUD ===

pub fn insert_experience(handle: i64, input_json: &str) -> Result<String, Box<dyn std::error::Error>> {
    let input: ExperienceInput = serde_json::from_str(input_json)?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let correction_text = input.correction.as_deref().unwrap_or("");
    let token_cost = estimate_tokens(&format!(
        "{} {} {} {}",
        input.context, input.action, input.outcome, correction_text
    ));

    with_conn(handle, |conn| {
        conn.execute(
            "INSERT INTO experiences (id, session_id, agent, project, type, category, severity,
                context, action, outcome, correction, source_ref, frequency, token_cost, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 1, ?13, ?14)",
            params![
                id,
                input.session_id.as_deref().unwrap_or(""),
                input.agent,
                input.project,
                input.exp_type,
                input.category,
                input.severity.as_deref().unwrap_or("info"),
                input.context,
                input.action,
                input.outcome,
                input.correction,
                input.source_ref,
                token_cost,
                now,
            ],
        )?;
        Ok(id)
    })
}

pub fn get_experience(handle: i64, id: &str) -> Result<String, Box<dyn std::error::Error>> {
    with_conn(handle, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, session_id, agent, project, type, category, severity,
                context, action, outcome, correction, source_ref, frequency, token_cost, created_at
            FROM experiences WHERE id = ?1",
        )?;
        let result = stmt.query_row(params![id], |row| {
            Ok(ExperienceRow {
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
            })
        });

        match result {
            Ok(row) => Ok(serde_json::to_string(&row)?),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(String::new()),
            Err(e) => Err(e.into()),
        }
    })
}

pub fn query_experiences(handle: i64, filter_json: &str) -> Result<String, Box<dyn std::error::Error>> {
    let filter: ExperienceFilter = serde_json::from_str(filter_json)?;

    with_conn(handle, |conn| {
        let mut conditions = vec!["1=1".to_string()];
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref project) = filter.project {
            conditions.push("project = ?".to_string());
            param_values.push(Box::new(project.clone()));
        }
        if let Some(ref agent) = filter.agent {
            conditions.push("agent = ?".to_string());
            param_values.push(Box::new(agent.clone()));
        }
        if let Some(ref category) = filter.category {
            conditions.push("category = ?".to_string());
            param_values.push(Box::new(category.clone()));
        }
        if let Some(ref exp_type) = filter.exp_type {
            conditions.push("type = ?".to_string());
            param_values.push(Box::new(exp_type.clone()));
        }
        if let Some(ref severity) = filter.severity {
            conditions.push("severity = ?".to_string());
            param_values.push(Box::new(severity.clone()));
        }
        if let Some(ref since) = filter.since {
            conditions.push("created_at >= ?".to_string());
            param_values.push(Box::new(since.clone()));
        }

        let limit = filter.limit.unwrap_or(100);
        let sql = format!(
            "SELECT id, timestamp, session_id, agent, project, type, category, severity,
                context, action, outcome, correction, source_ref, frequency, token_cost, created_at
            FROM experiences WHERE {} ORDER BY created_at DESC LIMIT {}",
            conditions.join(" AND "),
            limit
        );

        let mut stmt = conn.prepare(&sql)?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(params_ref.as_slice(), |row| {
            Ok(ExperienceRow {
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
            })
        })?;

        let results: Vec<ExperienceRow> = rows.filter_map(|r| r.ok()).collect();
        Ok(serde_json::to_string(&results)?)
    })
}

// === Insight CRUD ===

pub fn insert_insight(handle: i64, input_json: &str) -> Result<String, Box<dyn std::error::Error>> {
    let input: InsightInput = serde_json::from_str(input_json)?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let token_cost = input
        .token_cost
        .unwrap_or_else(|| estimate_tokens(&input.compressed));

    with_conn(handle, |conn| {
        conn.execute(
            "INSERT INTO insights (id, created_at, updated_at, agent, description, compressed,
                token_cost, category, scope, importance, confidence, effect_score, status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 2, 0.5, 0.0, 'active')",
            params![
                id,
                now,
                now,
                input.agent,
                input.description,
                input.compressed,
                token_cost,
                input.category,
                input.scope.as_deref().unwrap_or("project"),
            ],
        )?;
        Ok(id)
    })
}

pub fn get_insight(handle: i64, id: &str) -> Result<String, Box<dyn std::error::Error>> {
    with_conn(handle, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, created_at, updated_at, agent, description, compressed, token_cost,
                category, scope, importance, confidence, effect_score, status,
                converted_type, converted_ref
            FROM insights WHERE id = ?1",
        )?;
        let result = stmt.query_row(params![id], |row| {
            Ok(InsightRow {
                id: row.get(0)?,
                created_at: row.get(1)?,
                updated_at: row.get(2)?,
                agent: row.get(3)?,
                description: row.get(4)?,
                compressed: row.get(5)?,
                token_cost: row.get(6)?,
                category: row.get(7)?,
                scope: row.get(8)?,
                importance: row.get(9)?,
                confidence: row.get(10)?,
                effect_score: row.get(11)?,
                status: row.get(12)?,
                converted_type: row.get(13)?,
                converted_ref: row.get(14)?,
            })
        });

        match result {
            Ok(row) => Ok(serde_json::to_string(&row)?),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(String::new()),
            Err(e) => Err(e.into()),
        }
    })
}

pub fn query_insights(handle: i64, filter_json: &str) -> Result<String, Box<dyn std::error::Error>> {
    let filter: InsightFilter = serde_json::from_str(filter_json)?;

    with_conn(handle, |conn| {
        let mut conditions = vec!["1=1".to_string()];
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref agent) = filter.agent {
            conditions.push("agent = ?".to_string());
            param_values.push(Box::new(agent.clone()));
        }
        if let Some(ref category) = filter.category {
            conditions.push("category = ?".to_string());
            param_values.push(Box::new(category.clone()));
        }
        if let Some(ref scope) = filter.scope {
            conditions.push("scope = ?".to_string());
            param_values.push(Box::new(scope.clone()));
        }
        if let Some(ref status) = filter.status {
            conditions.push("status = ?".to_string());
            param_values.push(Box::new(status.clone()));
        }
        if let Some(min_imp) = filter.min_importance {
            conditions.push(format!("importance >= {}", min_imp));
        }

        let limit = filter.limit.unwrap_or(50);
        let sql = format!(
            "SELECT id, created_at, updated_at, agent, description, compressed, token_cost,
                category, scope, importance, confidence, effect_score, status,
                converted_type, converted_ref
            FROM insights WHERE {} ORDER BY importance DESC, effect_score DESC LIMIT {}",
            conditions.join(" AND "),
            limit
        );

        let mut stmt = conn.prepare(&sql)?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(params_ref.as_slice(), |row| {
            Ok(InsightRow {
                id: row.get(0)?,
                created_at: row.get(1)?,
                updated_at: row.get(2)?,
                agent: row.get(3)?,
                description: row.get(4)?,
                compressed: row.get(5)?,
                token_cost: row.get(6)?,
                category: row.get(7)?,
                scope: row.get(8)?,
                importance: row.get(9)?,
                confidence: row.get(10)?,
                effect_score: row.get(11)?,
                status: row.get(12)?,
                converted_type: row.get(13)?,
                converted_ref: row.get(14)?,
            })
        })?;

        let results: Vec<InsightRow> = rows.filter_map(|r| r.ok()).collect();
        Ok(serde_json::to_string(&results)?)
    })
}

// === Voting ===

pub fn upvote_insight(handle: i64, id: &str) -> Result<(), Box<dyn std::error::Error>> {
    with_conn(handle, |conn| {
        conn.execute(
            "UPDATE insights SET importance = importance + 1, updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    })
}

pub fn downvote_insight(handle: i64, id: &str) -> Result<(), Box<dyn std::error::Error>> {
    with_conn(handle, |conn| {
        conn.execute(
            "UPDATE insights SET
                importance = MAX(0, importance - 1),
                status = CASE WHEN importance <= 1 THEN 'retired' ELSE status END,
                updated_at = datetime('now')
            WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    })
}

pub fn graduate_insight(
    handle: i64,
    id: &str,
    converted_type: &str,
    converted_ref: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    with_conn(handle, |conn| {
        conn.execute(
            "UPDATE insights SET status = 'graduated', converted_type = ?1,
                converted_ref = ?2, updated_at = datetime('now') WHERE id = ?3",
            params![converted_type, converted_ref, id],
        )?;
        Ok(())
    })
}

// === Tags ===

pub fn set_tags(handle: i64, experience_id: &str, tags_json: &str) -> Result<(), Box<dyn std::error::Error>> {
    let tags: Vec<TagInput> = serde_json::from_str(tags_json)?;

    with_conn(handle, |conn| {
        conn.execute("DELETE FROM tags WHERE experience_id = ?1", params![experience_id])?;
        let mut stmt = conn.prepare(
            "INSERT INTO tags (experience_id, level, tag) VALUES (?1, ?2, ?3)",
        )?;
        for tag in &tags {
            stmt.execute(params![experience_id, tag.level, tag.tag])?;
        }
        Ok(())
    })
}

// === Effect tracking ===

pub fn record_effect(handle: i64, input_json: &str) -> Result<(), Box<dyn std::error::Error>> {
    let input: EffectInput = serde_json::from_str(input_json)?;

    with_conn(handle, |conn| {
        conn.execute(
            "INSERT INTO effect_tracking (insight_id, session_id, was_relevant, was_followed, outcome)
            VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                input.insight_id,
                input.session_id,
                input.was_relevant as i32,
                input.was_followed as i32,
                input.outcome,
            ],
        )?;

        // Update insight's effect_score based on recent measurements
        update_effect_score(conn, &input.insight_id)?;
        Ok(())
    })
}

fn update_effect_score(conn: &Connection, insight_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    let result: Option<(i64, i64)> = conn
        .query_row(
            "SELECT COUNT(*) as total,
                SUM(CASE WHEN outcome = 'positive' THEN 1 ELSE 0 END) as positive
            FROM (SELECT * FROM effect_tracking WHERE insight_id = ?1
                ORDER BY created_at DESC LIMIT 10)",
            params![insight_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    if let Some((total, positive)) = result {
        if total > 0 {
            let score = positive as f64 / total as f64;
            conn.execute(
                "UPDATE insights SET effect_score = ?1, updated_at = datetime('now') WHERE id = ?2",
                params![score, insight_id],
            )?;
        }
    }

    Ok(())
}

// === Stats ===

pub fn get_stats(handle: i64) -> Result<String, Box<dyn std::error::Error>> {
    with_conn(handle, |conn| {
        let exp: i64 = conn.query_row("SELECT COUNT(*) FROM experiences", [], |r| r.get(0))?;
        let ins: i64 = conn.query_row("SELECT COUNT(*) FROM insights", [], |r| r.get(0))?;
        let tags: i64 = conn.query_row("SELECT COUNT(*) FROM tags", [], |r| r.get(0))?;

        let result = serde_json::json!({
            "experiences": exp,
            "insights": ins,
            "tags": tags,
        });
        Ok(result.to_string())
    })
}

// === Embedding cache ===

pub fn store_embedding(
    handle: i64,
    source_type: &str,
    source_id: &str,
    vector_json: &str,
    model: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let vector: Vec<f32> = serde_json::from_str(vector_json)?;
    let vector_bytes: Vec<u8> = vector.iter().flat_map(|f| f.to_le_bytes()).collect();
    let id = Uuid::new_v4().to_string();

    with_conn(handle, |conn| {
        conn.execute(
            "INSERT OR REPLACE INTO embeddings (id, source_type, source_id, vector, model)
            VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, source_type, source_id, vector_bytes, model],
        )?;
        Ok(())
    })
}

pub fn get_embedding(
    handle: i64,
    source_type: &str,
    source_id: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    with_conn(handle, |conn| {
        let result: Option<Vec<u8>> = conn
            .query_row(
                "SELECT vector FROM embeddings WHERE source_type = ?1 AND source_id = ?2
                ORDER BY created_at DESC LIMIT 1",
                params![source_type, source_id],
                |row| row.get(0),
            )
            .ok();

        match result {
            Some(bytes) => {
                let floats: Vec<f32> = bytes
                    .chunks_exact(4)
                    .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
                    .collect();
                Ok(serde_json::to_string(&floats)?)
            }
            None => Ok(String::new()),
        }
    })
}

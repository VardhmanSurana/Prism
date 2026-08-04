//! prism — thin command-line client for the Prism Rust backend.
//!
//! Talks to the running backend's REST API (default http://127.0.0.1:8269).
//! This is the *thin* REST-client CLI; a fuller offline (direct-DB) port is
//! planned to follow this one.

use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use comfy_table::{ContentArrangement, Table};
use serde::{Deserialize, Serialize};

// ─── CLI definition ──────────────────────────────────────────────────────────

#[derive(Parser, Debug)]
#[command(
    name = "prism",
    version,
    about = "Thin command-line client for the Prism Rust backend (REST API)",
    long_about = None
)]
struct Cli {
    /// Backend base URL (e.g. http://127.0.0.1:8269). Env: PRISM_API_URL
    #[arg(long, env = "PRISM_API_URL", global = true)]
    api_url: Option<String>,

    /// Print raw JSON instead of human-readable tables/text
    #[arg(long, global = true)]
    json: bool,

    /// Verbose: show the request URL and full error detail
    #[arg(short, long, global = true)]
    verbose: bool,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Backend health + library stats
    Status,
    /// Library statistics
    Stats,
    /// List recent photos
    Photos {
        #[arg(long, default_value_t = 25)]
        limit: u32,
    },
    /// Show a single photo's metadata (by id or uuid)
    Photo { id: String },
    /// Fused metadata search
    Search {
        /// Search query (omit to list recent photos)
        query: Option<String>,
        #[arg(long, default_value_t = 25)]
        limit: u32,
    },
    /// List known people
    People,
    /// List albums
    Albums,
}

// ─── Response shapes (mirror the Rust backend models) ────────────────────────

#[derive(Debug, Serialize, Deserialize)]
struct PhotoStats {
    total_photos: i64,
    total_videos: i64,
    favorites_count: i64,
    trash_count: i64,
    locked_count: i64,
    storage_used_bytes: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct HealthStatus {
    status: String,
    service: String,
    version: String,
    database: String,
    python_ml_service: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Photo {
    id: i64,
    uuid: Option<String>,
    filename: String,
    #[serde(default)]
    caption: Option<String>,
    city: Option<String>,
    state: Option<String>,
    country: Option<String>,
    #[serde(default)]
    is_favorite: bool,
    #[serde(default)]
    is_trash: bool,
    #[serde(default)]
    is_locked: bool,
    file_type: Option<String>,
    #[serde(default)]
    content_type: Option<String>,
    #[serde(default)]
    file_size: Option<i64>,
    date_taken: Option<String>,
    #[serde(default)]
    exif_make: Option<String>,
    #[serde(default)]
    exif_model: Option<String>,
    #[serde(default)]
    width: Option<i64>,
    #[serde(default)]
    height: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Person {
    id: i64,
    uuid: Option<String>,
    name: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Album {
    id: i64,
    uuid: Option<String>,
    name: String,
    #[serde(rename = "type", default)]
    kind: String,
    #[serde(default)]
    is_smart: bool,
    smart_type: Option<String>,
    #[serde(default)]
    photo_count: i64,
}

#[derive(Debug, Deserialize, Serialize)]
struct FusedSearchResult {
    results: Vec<serde_json::Value>,
    total: usize,
}

// ─── HTTP client ──────────────────────────────────────────────────────────────

struct PrismClient {
    base: String,
    http: reqwest::Client,
    verbose: bool,
}

impl PrismClient {
    fn new(api_url: Option<String>, verbose: bool) -> Self {
        let base = api_url
            .unwrap_or_else(|| "http://127.0.0.1:8269".to_string())
            .trim_end_matches('/')
            .to_string();
        Self {
            base,
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("failed to build HTTP client"),
            verbose,
        }
    }

    async fn get_json<T: for<'de> Deserialize<'de>>(&self, path: &str) -> Result<T> {
        let url = format!("{}{}", self.base, path);
        if self.verbose {
            eprintln!("→ GET {url}");
        }
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .with_context(|| format!("failed to reach backend at {url}"))?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            bail!("backend returned {status}: {body}");
        }
        let value = resp
            .json::<serde_json::Value>()
            .await
            .context("response was not valid JSON")?;
        serde_json::from_value(value).with_context(|| "response did not match expected shape")
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let client = PrismClient::new(cli.api_url, cli.verbose);

    match &cli.command {
        Command::Status => cmd_status(&client, cli.json).await,
        Command::Stats => cmd_stats(&client, cli.json).await,
        Command::Photos { limit } => cmd_photos(&client, *limit, cli.json).await,
        Command::Photo { id } => cmd_photo(&client, id, cli.json).await,
        Command::Search { query, limit } => {
            cmd_search(&client, query.as_deref(), *limit, cli.json).await
        }
        Command::People => cmd_people(&client, cli.json).await,
        Command::Albums => cmd_albums(&client, cli.json).await,
    }
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async fn cmd_status(c: &PrismClient, json: bool) -> Result<()> {
    let health: HealthStatus = c.get_json("/health").await?;
    let stats: PhotoStats = c.get_json("/api/v1/photos/stats").await?;

    if json {
        let combined = serde_json::json!({ "health": health, "stats": stats });
        println!("{}", serde_json::to_string_pretty(&combined)?);
        return Ok(());
    }

    println!("Prism backend: {}", paint_status(&health.status));
    println!("  service      : {}", health.service);
    println!("  version      : {}", health.version);
    println!("  database     : {}", health.database);
    println!("  python ML    : {}", health.python_ml_service);
    println!();
    print_stats_table(&stats);
    Ok(())
}

async fn cmd_stats(c: &PrismClient, json: bool) -> Result<()> {
    let stats: PhotoStats = c.get_json("/api/v1/photos/stats").await?;
    if json {
        println!("{}", serde_json::to_string_pretty(&stats)?);
    } else {
        print_stats_table(&stats);
    }
    Ok(())
}

fn print_stats_table(s: &PhotoStats) {
    let mut t = Table::new();
    t.set_content_arrangement(ContentArrangement::Disabled);
    t.set_header(vec!["Metric".to_string(), "Value".to_string()]);
    t.add_row(vec!["Photos".to_string(), s.total_photos.to_string()]);
    t.add_row(vec!["Videos".to_string(), s.total_videos.to_string()]);
    t.add_row(vec!["Favorites".to_string(), s.favorites_count.to_string()]);
    t.add_row(vec!["In trash".to_string(), s.trash_count.to_string()]);
    t.add_row(vec!["Locked".to_string(), s.locked_count.to_string()]);
    t.add_row(vec!["Storage used".to_string(), fmt_bytes(s.storage_used_bytes)]);
    println!("{t}");
}

async fn cmd_photos(c: &PrismClient, limit: u32, json: bool) -> Result<()> {
    let photos: Vec<Photo> = c.get_json(&format!("/api/v1/photos?limit={limit}")).await?;
    if json {
        println!("{}", serde_json::to_string_pretty(&photos)?);
    } else {
        print_photos_table(&photos);
    }
    Ok(())
}

async fn cmd_photo(c: &PrismClient, id: &str, json: bool) -> Result<()> {
    let photo: Photo = c
        .get_json(&format!("/api/v1/photos/{id}"))
        .await
        .with_context(|| format!("photo '{id}' not found"))?;
    if json {
        println!("{}", serde_json::to_string_pretty(&photo)?);
    } else {
        print_photo_detail(&photo);
    }
    Ok(())
}

async fn cmd_search(c: &PrismClient, query: Option<&str>, limit: u32, json: bool) -> Result<()> {
    let path = match query {
        Some(q) if !q.is_empty() => {
            let qe = urlencoding::encode(q);
            format!("/api/v1/utilities/search/fused?q={qe}&limit={limit}")
        }
        _ => format!("/api/v1/utilities/search/fused?limit={limit}"),
    };
    let res: FusedSearchResult = c.get_json(&path).await?;

    if json {
        println!("{}", serde_json::to_string_pretty(&res)?);
        return Ok(());
    }
    if res.results.is_empty() {
        println!("No results.");
        return Ok(());
    }

    let mut t = Table::new();
    t.set_header(vec![
        "ID".to_string(),
        "Filename".to_string(),
        "Date".to_string(),
        "Location".to_string(),
        "Caption".to_string(),
    ]);
    for item in &res.results {
        let id = item.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        let filename = item.get("filename").and_then(|v| v.as_str()).unwrap_or("");
        let date = item
            .get("date_taken")
            .and_then(|v| v.as_str())
            .map(short_date)
            .unwrap_or_else(|| "—".into());
        let loc = format_location(
            item.get("city").and_then(|v| v.as_str()),
            item.get("state").and_then(|v| v.as_str()),
            item.get("country").and_then(|v| v.as_str()),
        );
        let caption = item.get("caption").and_then(|v| v.as_str()).unwrap_or("");
        t.add_row(vec![
            id.to_string(),
            filename.to_string(),
            date,
            loc,
            caption.to_string(),
        ]);
    }
    println!("{t}");
    println!("\n{} result(s).", res.total);
    Ok(())
}

async fn cmd_people(c: &PrismClient, json: bool) -> Result<()> {
    let people: Vec<Person> = c.get_json("/api/v1/people").await?;
    if json {
        println!("{}", serde_json::to_string_pretty(&people)?);
    } else if people.is_empty() {
        println!("No people found.");
    } else {
        let mut t = Table::new();
        t.set_header(vec!["ID".to_string(), "UUID".to_string(), "Name".to_string()]);
        for p in &people {
            t.add_row(vec![
                p.id.to_string(),
                p.uuid.clone().unwrap_or_else(|| "—".to_string()),
                p.name.clone(),
            ]);
        }
        println!("{t}");
        println!("\n{} person(s).", people.len());
    }
    Ok(())
}

async fn cmd_albums(c: &PrismClient, json: bool) -> Result<()> {
    let albums: Vec<Album> = c.get_json("/api/v1/albums").await?;
    if json {
        println!("{}", serde_json::to_string_pretty(&albums)?);
    } else if albums.is_empty() {
        println!("No albums found.");
    } else {
        let mut t = Table::new();
        t.set_header(vec![
            "ID".to_string(),
            "Name".to_string(),
            "Type".to_string(),
            "Photos".to_string(),
        ]);
        for a in &albums {
            let kind = if a.is_smart {
                format!("smart ({})", a.smart_type.as_deref().unwrap_or("?"))
            } else {
                a.kind.clone()
            };
            t.add_row(vec![
                a.id.to_string(),
                a.name.clone(),
                kind,
                a.photo_count.to_string(),
            ]);
        }
        println!("{t}");
        println!("\n{} album(s).", albums.len());
    }
    Ok(())
}

// ─── helpers ──────────────────────────────────────────────────────────────────

fn print_photos_table(photos: &[Photo]) {
    if photos.is_empty() {
        println!("No photos.");
        return;
    }
    let mut t = Table::new();
    t.set_header(vec![
        "ID".to_string(),
        "Filename".to_string(),
        "Date".to_string(),
        "Location".to_string(),
        "Type".to_string(),
        "Fav".to_string(),
    ]);
    for p in photos {
        let date = p
            .date_taken
            .as_deref()
            .map(short_date)
            .unwrap_or_else(|| "—".into());
        let loc = format_location(p.city.as_deref(), p.state.as_deref(), p.country.as_deref());
        t.add_row(vec![
            p.id.to_string(),
            p.filename.clone(),
            date,
            loc,
            p.file_type.clone().unwrap_or_else(|| "?".to_string()),
            if p.is_favorite { "★".to_string() } else { "".to_string() },
        ]);
    }
    println!("{t}");
    println!("\n{} photo(s).", photos.len());
}

fn print_photo_detail(p: &Photo) {
    let mut t = Table::new();
    t.set_header(vec!["Field".to_string(), "Value".to_string()]);
    t.add_row(vec!["ID".to_string(), p.id.to_string()]);
    t.add_row(vec![
        "UUID".to_string(),
        p.uuid.clone().unwrap_or_else(|| "—".to_string()),
    ]);
    t.add_row(vec!["Filename".to_string(), p.filename.clone()]);
    t.add_row(vec![
        "Caption".to_string(),
        p.caption.clone().unwrap_or_else(|| "—".to_string()),
    ]);
    t.add_row(vec![
        "Dimensions".to_string(),
        format!("{}×{}", p.width.unwrap_or(0), p.height.unwrap_or(0)),
    ]);
    t.add_row(vec![
        "File type".to_string(),
        p.file_type.clone().unwrap_or_else(|| "?".to_string()),
    ]);
    t.add_row(vec![
        "Content type".to_string(),
        p.content_type.clone().unwrap_or_else(|| "?".to_string()),
    ]);
    t.add_row(vec!["File size".to_string(), fmt_bytes(p.file_size.unwrap_or(0))]);
    t.add_row(vec![
        "Date taken".to_string(),
        p.date_taken.clone().unwrap_or_else(|| "—".to_string()),
    ]);
    t.add_row(vec![
        "Location".to_string(),
        format_location(p.city.as_deref(), p.state.as_deref(), p.country.as_deref()),
    ]);
    t.add_row(vec![
        "Camera".to_string(),
        format!(
            "{} {}",
            p.exif_make.as_deref().unwrap_or(""),
            p.exif_model.as_deref().unwrap_or("")
        )
        .trim()
        .to_string(),
    ]);
    t.add_row(vec![
        "Favorite".to_string(),
        if p.is_favorite { "yes".to_string() } else { "no".to_string() },
    ]);
    t.add_row(vec![
        "Locked".to_string(),
        if p.is_locked { "yes".to_string() } else { "no".to_string() },
    ]);
    t.add_row(vec![
        "Trashed".to_string(),
        if p.is_trash { "yes".to_string() } else { "no".to_string() },
    ]);
    println!("{t}");
}

fn fmt_bytes(n: i64) -> String {
    let mut n = n as f64;
    for unit in ["B", "KB", "MB", "GB", "TB"] {
        if n.abs() < 1024.0 || unit == "TB" {
            return format!("{:.1} {unit}", n);
        }
        n /= 1024.0;
    }
    format!("{:.1} PB", n)
}

fn short_date(iso: &str) -> String {
    // Backend returns RFC3339; trim to YYYY-MM-DD for compact display.
    if let Some((d, _)) = iso.split_once('T') {
        return d.to_string();
    }
    iso.to_string()
}

fn format_location(city: Option<&str>, state: Option<&str>, country: Option<&str>) -> String {
    let mut parts: Vec<&str> = Vec::new();
    if let Some(c) = city {
        parts.push(c);
    }
    if let Some(s) = state {
        parts.push(s);
    }
    if let Some(c) = country {
        parts.push(c);
    }
    if parts.is_empty() {
        "—".to_string()
    } else {
        parts.join(", ")
    }
}

fn paint_status(s: &str) -> String {
    // No color escapes (terminal-agnostic); keep it plain but readable.
    match s.to_lowercase().as_str() {
        "ok" => format!("{s} ✅"),
        "degraded" => format!("{s} ⚠"),
        _ => format!("{s} ●"),
    }
}

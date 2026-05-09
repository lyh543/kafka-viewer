use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub name: String,
    pub version: String,
    pub connections: Vec<ConnectionConfig>,
    #[serde(default)]
    pub refresh_configs: std::collections::HashMap<String, RefreshConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub brokers: String,
    pub auth: AuthConfig,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    #[serde(rename = "type")]
    pub auth_type: String,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub ssl_ca_path: Option<String>,
    #[serde(default)]
    pub ssl_cert_path: Option<String>,
    #[serde(default)]
    pub ssl_key_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshConfig {
    pub enabled: bool,
    pub interval_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalConfig {
    pub recent_projects: Vec<RecentProject>,
    #[serde(default)]
    pub settings: AppSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub last_opened: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_locale")]
    pub locale: String,
    #[serde(default = "default_zoom")]
    pub zoom: f64,
    #[serde(default = "default_cache_per_page")]
    pub cache_per_page_mb: u64,
    #[serde(default = "default_cache_total")]
    pub cache_total_mb: u64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            locale: default_locale(),
            zoom: default_zoom(),
            cache_per_page_mb: default_cache_per_page(),
            cache_total_mb: default_cache_total(),
        }
    }
}

impl Default for GlobalConfig {
    fn default() -> Self {
        Self {
            recent_projects: Vec::new(),
            settings: AppSettings::default(),
        }
    }
}

fn default_theme() -> String { "light".to_string() }
fn default_locale() -> String { "zh-CN".to_string() }
fn default_zoom() -> f64 { 1.0 }
fn default_cache_per_page() -> u64 { 200 }
fn default_cache_total() -> u64 { 2048 }

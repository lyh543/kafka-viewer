use std::path::PathBuf;
use std::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::project::config::*;

pub struct ProjectManager {
    global_config_path: PathBuf,
    global_config: Mutex<GlobalConfig>,
    current_project_path: Mutex<Option<PathBuf>>,
    current_project: Mutex<Option<ProjectConfig>>,
}

impl ProjectManager {
    pub fn new() -> AppResult<Self> {
        let config_dir = dirs::home_dir()
            .ok_or_else(|| AppError::Project("Cannot find home directory".into()))?
            .join(".kafka-viewer");

        std::fs::create_dir_all(&config_dir)?;

        let global_config_path = config_dir.join("config.json");
        let global_config = if global_config_path.exists() {
            let data = std::fs::read_to_string(&global_config_path)?;
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            GlobalConfig::default()
        };

        Ok(Self {
            global_config_path,
            global_config: Mutex::new(global_config),
            current_project_path: Mutex::new(None),
            current_project: Mutex::new(None),
        })
    }

    fn save_global_config(&self) -> AppResult<()> {
        let config = self.global_config.lock().unwrap();
        let data = serde_json::to_string_pretty(&*config)?;
        std::fs::write(&self.global_config_path, data)?;
        Ok(())
    }

    fn save_project_config(&self) -> AppResult<()> {
        let path = self.current_project_path.lock().unwrap();
        let project = self.current_project.lock().unwrap();
        if let (Some(path), Some(project)) = (path.as_ref(), project.as_ref()) {
            let config_path = path.join("project.json");
            let data = serde_json::to_string_pretty(project)?;
            std::fs::write(config_path, data)?;
        }
        Ok(())
    }

    pub fn create_project(&self, name: &str, path: &str) -> AppResult<serde_json::Value> {
        let project_path = PathBuf::from(path);
        std::fs::create_dir_all(&project_path)?;

        let config = ProjectConfig {
            name: name.to_string(),
            version: "1.0".to_string(),
            connections: Vec::new(),
            refresh_configs: std::collections::HashMap::new(),
        };

        let config_path = project_path.join("project.json");
        let data = serde_json::to_string_pretty(&config)?;
        std::fs::write(config_path, data)?;

        *self.current_project_path.lock().unwrap() = Some(project_path.clone());
        *self.current_project.lock().unwrap() = Some(config);

        self.add_recent_project(name, path)?;

        Ok(serde_json::json!({
            "name": name,
            "path": path
        }))
    }

    pub fn open_project(&self, path: &str) -> AppResult<serde_json::Value> {
        let project_path = PathBuf::from(path);
        let config_path = project_path.join("project.json");

        if !config_path.exists() {
            return Err(AppError::Project(format!(
                "Project config not found at {}",
                config_path.display()
            )));
        }

        let data = std::fs::read_to_string(&config_path)?;
        let config: ProjectConfig = serde_json::from_str(&data)?;
        let name = config.name.clone();

        *self.current_project_path.lock().unwrap() = Some(project_path);
        *self.current_project.lock().unwrap() = Some(config);

        self.add_recent_project(&name, path)?;

        Ok(serde_json::json!({
            "name": name,
            "path": path
        }))
    }

    pub fn close_project(&self) -> AppResult<()> {
        self.save_project_config()?;
        *self.current_project_path.lock().unwrap() = None;
        *self.current_project.lock().unwrap() = None;
        Ok(())
    }

    fn add_recent_project(&self, name: &str, path: &str) -> AppResult<()> {
        let mut config = self.global_config.lock().unwrap();
        config.recent_projects.retain(|p| p.path != path);
        config.recent_projects.insert(
            0,
            RecentProject {
                name: name.to_string(),
                path: path.to_string(),
                last_opened: chrono::Utc::now().to_rfc3339(),
            },
        );
        if config.recent_projects.len() > 10 {
            config.recent_projects.truncate(10);
        }
        drop(config);
        self.save_global_config()
    }

    pub fn get_recent_projects(&self) -> Vec<RecentProject> {
        self.global_config.lock().unwrap().recent_projects.clone()
    }

    pub fn remove_recent_project(&self, path: &str) -> AppResult<()> {
        {
            let mut config = self.global_config.lock().unwrap();
            config.recent_projects.retain(|p| p.path != path);
        }
        self.save_global_config()
    }

    pub fn get_connections(&self) -> Vec<ConnectionConfig> {
        self.current_project
            .lock()
            .unwrap()
            .as_ref()
            .map(|p| p.connections.clone())
            .unwrap_or_default()
    }

    pub fn save_connection(&self, conn: ConnectionConfig) -> AppResult<ConnectionConfig> {
        let mut project = self.current_project.lock().unwrap();
        if let Some(ref mut project) = *project {
            if let Some(existing) = project.connections.iter_mut().find(|c| c.id == conn.id) {
                *existing = conn.clone();
            } else {
                project.connections.push(conn.clone());
            }
        }
        drop(project);
        self.save_project_config()?;
        Ok(conn)
    }

    pub fn delete_connection(&self, id: &str) -> AppResult<()> {
        let mut project = self.current_project.lock().unwrap();
        if let Some(ref mut project) = *project {
            project.connections.retain(|c| c.id != id);
        }
        drop(project);
        self.save_project_config()
    }
}

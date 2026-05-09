use tokio::task;

pub async fn run_blocking_command<T, F>(
    command_name: &'static str,
    operation: F,
) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    task::spawn_blocking(operation).await.map_err(|error| {
        log::error!("Blocking command '{}' join failed: {}", command_name, error);
        error.to_string()
    })?
}

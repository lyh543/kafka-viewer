use std::collections::VecDeque;
use std::io::{self, Write};
use std::sync::{Mutex, OnceLock};

use env_logger::{Builder, Env, Target, WriteStyle};

/// Maximum number of log lines kept in memory for the in-app log viewer.
const MAX_LINES: usize = 2000;

fn buffer() -> &'static Mutex<VecDeque<String>> {
    static BUFFER: OnceLock<Mutex<VecDeque<String>>> = OnceLock::new();

    BUFFER.get_or_init(|| Mutex::new(VecDeque::with_capacity(MAX_LINES)))
}

/// Writer that mirrors the log stream to stdout and keeps the tail in memory.
struct BufferWriter;

impl Write for BufferWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        io::stdout().write_all(buf)?;

        let text = String::from_utf8_lossy(buf);
        let mut guard = buffer()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        for line in text.lines() {
            let line = line.trim_end();

            if line.is_empty() {
                continue;
            }

            if guard.len() == MAX_LINES {
                guard.pop_front();
            }

            guard.push_back(line.to_string());
        }

        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        io::stdout().flush()
    }
}

/// Initializes logging for the whole application. Must be called before `run`.
pub fn init() {
    Builder::from_env(Env::default().default_filter_or("info"))
        .format(|buf, record| {
            writeln!(
                buf,
                "[{} {}] [{}] {}",
                buf.timestamp_millis(),
                record.level(),
                record.target(),
                record.args()
            )
        })
        .format_timestamp_millis()
        // Disable ANSI colors so buffered lines stay readable in the log viewer.
        .write_style(WriteStyle::Never)
        .target(Target::Pipe(Box::new(BufferWriter)))
        .init();
}

/// Returns the most recent `limit` log lines (oldest first).
pub fn recent_lines(limit: usize) -> Vec<String> {
    let guard = buffer()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let start = guard.len().saturating_sub(limit);

    guard.iter().skip(start).cloned().collect()
}

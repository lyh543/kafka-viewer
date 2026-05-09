// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use env_logger::{Builder, Env, Target};
use std::io::Write;

fn main() {
    Builder::from_env(Env::default().default_filter_or("info"))
        .format(|buf, record| {
            let level_style = buf.default_level_style(record.level());

            writeln!(
                buf,
                "[{} {level_style}{}{level_style:#}] [{}] {}",
                buf.timestamp_millis(),
                record.level(),
                record.target(),
                record.args()
            )
        })
        .format_timestamp_millis()
        .target(Target::Stdout)
        .init();
    kafka_viewer_lib::run()
}

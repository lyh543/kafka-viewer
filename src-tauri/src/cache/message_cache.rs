use std::collections::HashMap;
use std::sync::Mutex;

use lru::LruCache;
use std::num::NonZeroUsize;

/// Cache key: (connection_id, topic, partition)
type CacheKey = (String, String, i32);

/// Cached message data
#[derive(Clone, Debug)]
pub struct CachedMessage {
    pub partition: i32,
    pub offset: i64,
    pub key: Option<String>,
    pub value: Option<String>,
    pub headers: HashMap<String, String>,
    pub timestamp: i64,
}

pub struct MessageCache {
    cache: Mutex<LruCache<CacheKey, Vec<CachedMessage>>>,
    max_size_bytes: u64,
}

impl MessageCache {
    pub fn new(max_size_mb: u64) -> Self {
        Self {
            cache: Mutex::new(LruCache::new(NonZeroUsize::new(1000).unwrap())),
            max_size_bytes: max_size_mb * 1024 * 1024,
        }
    }

    pub fn get(
        &self,
        connection_id: &str,
        topic: &str,
        partition: i32,
    ) -> Option<Vec<CachedMessage>> {
        let key = (connection_id.to_string(), topic.to_string(), partition);
        self.cache.lock().unwrap().get(&key).cloned()
    }

    pub fn put(
        &self,
        connection_id: &str,
        topic: &str,
        partition: i32,
        messages: Vec<CachedMessage>,
    ) {
        let key = (connection_id.to_string(), topic.to_string(), partition);
        self.cache.lock().unwrap().put(key, messages);
    }

    pub fn clear(&self) {
        self.cache.lock().unwrap().clear();
    }

    pub fn stats(&self) -> (usize, u64) {
        let cache = self.cache.lock().unwrap();
        (cache.len(), self.max_size_bytes / (1024 * 1024))
    }
}

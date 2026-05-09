# Kafka Viewer - 设计文档

## 1. 项目概述

Kafka Viewer 是一个基于 Tauri + React + TypeScript 的桌面 Kafka 客户端工具，提供直观的 GUI 来管理和查看 Kafka 集群中的主题、消费者组和数据。

**技术栈：**
- 前端：React 18 + TypeScript + Ant Design 5 + Zustand (状态管理)
- 后端：Rust + Tauri 2 + rdkafka (Kafka 客户端)
- 构建工具：Vite + pnpm
- 数据持久化：本地 JSON 文件（项目配置、连接信息等）

---

## 2. 架构设计

### 2.1 整体架构

```
┌──────────────────────────────────────────┐
│              React Frontend              │
│  ┌──────────────────────────────────┐    │
│  │   Ant Design UI Components      │    │
│  ├──────────────────────────────────┤    │
│  │   Zustand Store (State Mgmt)    │    │
│  ├──────────────────────────────────┤    │
│  │   Tauri IPC (invoke / listen)   │    │
│  └──────────────────────────────────┘    │
├──────────────────────────────────────────┤
│              Tauri IPC Bridge            │
├──────────────────────────────────────────┤
│              Rust Backend                │
│  ┌──────────────────────────────────┐    │
│  │   Command Handlers (Tauri)      │    │
│  ├──────────────────────────────────┤    │
│  │   Kafka Service (rdkafka)       │    │
│  ├──────────────────────────────────┤    │
│  │   Data Cache (LRU, per-partition)│    │
│  ├──────────────────────────────────┤    │
│  │   Project/Config Manager        │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

### 2.2 前端目录结构

```
src/
├── main.tsx                    # 入口
├── App.tsx                     # 路由根组件
├── api/                        # Tauri IPC 调用封装
│   ├── project.ts              # 项目管理 API
│   ├── connection.ts           # 连接管理 API
│   ├── topic.ts                # 主题操作 API
│   ├── consumer-group.ts       # 消费者组操作 API
│   └── system.ts               # 系统 API (版本检查等)
├── stores/                     # Zustand 状态管理
│   ├── project.ts              # 当前项目状态
│   ├── connection.ts           # 连接列表与状态
│   ├── tabs.ts                 # 标签页管理
│   └── sidebar.ts              # 侧边栏状态
├── components/                 # 通用组件
│   ├── AutoRefresh/            # 自动刷新通用组件
│   ├── TabManager/             # 标签页管理器
│   └── ContextMenu/            # 右键菜单
├── pages/
│   ├── Welcome/                # 欢迎/项目选择页
│   │   └── index.tsx
│   ├── Main/                   # 主窗口
│   │   ├── index.tsx           # 主布局
│   │   ├── MenuBar.tsx         # 顶栏菜单
│   │   ├── Sidebar.tsx         # 侧边栏树形结构
│   │   ├── ContentArea.tsx     # 标签页内容区
│   │   └── StatusBar.tsx       # 底栏
│   ├── TopicStatus/            # 主题状态标签页
│   ├── TopicData/              # 主题数据标签页
│   ├── ConsumerGroupStatus/    # 消费者组状态标签页
│   └── ConnectionModal/        # 管理连接弹窗
├── types/                      # TypeScript 类型定义
│   ├── project.ts
│   ├── connection.ts
│   ├── topic.ts
│   └── consumer-group.ts
├── hooks/                      # 自定义 Hooks
│   ├── useAutoRefresh.ts       # 自动刷新 Hook
│   └── useTabNavigation.ts     # 标签页导航
├── styles/                     # 全局样式
│   └── global.css
└── utils/                      # 工具函数
    └── index.ts
```

### 2.3 后端目录结构

```
src-tauri/src/
├── main.rs                     # 入口
├── lib.rs                      # Tauri 注册
├── commands/                   # Tauri 命令处理
│   ├── mod.rs
│   ├── project.rs              # 项目管理命令
│   ├── connection.rs           # 连接管理命令
│   ├── topic.rs                # 主题操作命令
│   └── consumer_group.rs       # 消费者组操作命令
├── kafka/                      # Kafka 客户端封装
│   ├── mod.rs
│   ├── client.rs               # Kafka 连接管理
│   ├── topic.rs                # 主题操作
│   ├── consumer_group.rs       # 消费者组操作
│   └── producer.rs             # 消息生产
├── cache/                      # 数据缓存
│   ├── mod.rs
│   └── message_cache.rs        # 消息缓存 (LRU, 按分区+offset)
├── project/                    # 项目/配置管理
│   ├── mod.rs
│   ├── manager.rs              # 项目文件读写
│   └── config.rs               # 配置结构定义
└── error.rs                    # 统一错误处理
```

---

## 3. 数据模型

### 3.1 项目配置 (project.json)

```json
{
  "name": "my-project",
  "version": "1.0",
  "connections": [
    {
      "id": "uuid-xxx",
      "name": "开发环境",
      "brokers": "localhost:9092",
      "auth": {
        "type": "none" | "sasl_plain" | "sasl_scram_256" | "sasl_scram_512" | "ssl",
        "username": "",
        "password": "",
        "ssl_ca_path": "",
        "ssl_cert_path": "",
        "ssl_key_path": ""
      },
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z"
    }
  ],
  "refresh_configs": {
    "conn-id::topic::topic-name::status": { "enabled": false, "interval_secs": 10 },
    "conn-id::topic::topic-name::data": { "enabled": false, "interval_secs": 10 },
    "conn-id::consumer-group::group-name::status": { "enabled": false, "interval_secs": 10 }
  }
}
```

### 3.2 全局配置 (~/.kafka-viewer/config.json)

```json
{
  "recent_projects": [
    { "name": "my-project", "path": "/home/user/KafkaViewer/projects/my-project", "last_opened": "..." }
  ],
  "settings": {
    "theme": "light",
    "locale": "zh-CN",
    "zoom": 1.0,
    "cache_per_page_mb": 200,
    "cache_total_mb": 2048
  }
}
```

### 3.3 TypeScript 类型定义

```typescript
// 连接信息
interface KafkaConnection {
  id: string;
  name: string;
  brokers: string;
  auth: AuthConfig;
  created_at: string;
  updated_at: string;
}

interface AuthConfig {
  type: 'none' | 'sasl_plain' | 'sasl_scram_256' | 'sasl_scram_512' | 'ssl';
  username?: string;
  password?: string;
  ssl_ca_path?: string;
  ssl_cert_path?: string;
  ssl_key_path?: string;
}

// 主题信息
interface TopicInfo {
  name: string;
  partitions: number;
  replication_factor: number;
  configs: Record<string, string>;
}

interface PartitionStatus {
  partition: number;
  leader: number;
  replicas: number[];
  isr: number[];
  beginning_offset: number;
  end_offset: number;
}

// 消息
interface KafkaMessage {
  topic: string;
  partition: number;
  offset: number;
  key: string | null;
  value: string | null;
  headers: Record<string, string>;
  timestamp: number;
}

// 消费者组
interface ConsumerGroupInfo {
  group_id: string;
  state: string;
  protocol_type: string;
  coordinator: number;
  members: ConsumerGroupMember[];
  offsets: ConsumerGroupOffset[];
}

interface ConsumerGroupMember {
  member_id: string;
  client_id: string;
  host: string;
  assignments: { topic: string; partitions: number[] }[];
}

interface ConsumerGroupOffset {
  topic: string;
  partition: number;
  current_offset: number;
  log_end_offset: number;
  lag: number;
}

// 数据筛选
interface DataFilter {
  key_type?: 'string' | 'json' | 'avro' | 'protobuf' | 'bytes';
  value_type?: 'string' | 'json' | 'avro' | 'protobuf' | 'bytes';
  key_filter?: { mode: 'equals' | 'not_equals' | 'contains' | 'regex'; value: string };
  value_filter?: { mode: 'equals' | 'not_equals' | 'contains' | 'regex'; value: string };
  start_from: StartFrom;
  limit?: DataLimit;
}

type StartFrom =
  | { type: 'latest' }
  | { type: 'beginning' }
  | { type: 'last_n'; count: number }
  | { type: 'timestamp'; ts: number }
  | { type: 'consumer_group'; group_id: string };

type DataLimit =
  | { type: 'count'; value: number }
  | { type: 'timestamp'; ts: number }
  | { type: 'size_mb'; value: number };

// 标签页
interface Tab {
  id: string;
  type: 'topic_status' | 'topic_data' | 'consumer_group_status';
  connectionId: string;
  title: string;
  resourceName: string; // topic name or consumer group name
}
```

---

## 4. UI 设计

### 4.1 欢迎页 (Welcome)

```
┌─────────────────────────────────────────┐
│              Kafka Viewer               │
│                v0.1.0                   │
│                                         │
│   ┌──────────┐  ┌───────────────────┐   │
│   │ 新建项目  │  │  最近的项目        │   │
│   │ 打开项目  │  │  - my-project ×   │   │
│   │ 打开文件夹│  │  - prod-kafka ×   │   │
│   └──────────┘  │  - dev-env    ×   │   │
│                  └───────────────────┘   │
└─────────────────────────────────────────┘
```

### 4.2 主窗口布局

```
┌─────────────────────────────────────────────────────┐
│ 文件 ▼  帮助 ▼                                       │ ← MenuBar
├────────┬────────────────────────────────────────────┤
│ 连接树  │ [主题A状态] [主题B数据] [消费者组C] [+]      │ ← Tabs
│        │                                            │
│ ▼ 开发  │  主题: topic-a                              │
│  ▼ 主题 │  分区数: 3  副本数: 2                        │
│   topicA│  ┌────┬───────┬──────┬─────┬──────┐       │
│   topicB│  │分区 │ Leader│ 副本  │ ISR │Offset│       │
│  ▼ 消费组│ │ 0  │  1    │ 1,2  │ 1,2 │12345 │       │
│   grp-1 │  │ 1  │  2    │ 2,3  │ 2,3 │12346 │       │
│ ▼ 生产  │  │ 2  │  3    │ 3,1  │ 3,1 │12347 │       │
│  ...    │  └────┴───────┴──────┴─────┴──────┘       │
│ [折叠◁] │                                            │
├────────┴────────────────────────────────────────────┤
│ 就绪 │ 连接: 开发 ✓ │ 3个主题 │ 2个消费者组           │ ← StatusBar
└─────────────────────────────────────────────────────┘
```

### 4.3 底栏 (StatusBar) 信息

- 左侧：当前状态（就绪/加载中/错误）
- 中间：当前活动连接名称和连接状态指示（✓ 已连接 / ✗ 断开）
- 中间：当前连接统计（主题数、消费者组数）
- 右侧：缓存使用量 (如 "缓存: 45MB / 200MB")
- 右侧：最后刷新时间

### 4.4 管理连接弹窗

```
┌─ 管理连接 ──────────────────────────────────────┐
│ [+新建] [复制] [删除]                            │
│ ┌───────────┬──────────────────────────────┐     │
│ │ 连接列表   │  连接名称: [开发环境       ]  │     │
│ │            │                              │     │
│ │ > 开发环境  │  Brokers:  [localhost:9092 ]  │     │
│ │   生产环境  │                              │     │
│ │            │  身份验证: [无认证 ▼       ]  │     │
│ │            │                              │     │
│ │            │  [测试连接]                   │     │
│ │            │  ✓ 连接成功 (3 brokers)      │     │
│ └───────────┴──────────────────────────────┘     │
│                      [取消] [保存] [保存并关闭]   │
└─────────────────────────────────────────────────┘
```

---

## 5. Tauri 命令 (IPC API)

### 5.1 项目管理

| 命令 | 参数 | 返回 |
|------|------|------|
| `create_project` | `{ name, path }` | `Project` |
| `open_project` | `{ path }` | `Project` |
| `close_project` | — | — |
| `get_recent_projects` | — | `RecentProject[]` |

### 5.2 连接管理

| 命令 | 参数 | 返回 |
|------|------|------|
| `save_connection` | `KafkaConnection` | `KafkaConnection` |
| `delete_connection` | `{ id }` | — |
| `test_connection` | `KafkaConnection` | `TestResult` |
| `get_connections` | — | `KafkaConnection[]` |

### 5.3 主题操作

| 命令 | 参数 | 返回 |
|------|------|------|
| `list_topics` | `{ connection_id }` | `string[]` |
| `get_topic_status` | `{ connection_id, topic }` | `TopicStatus` |
| `create_topic` | `{ connection_id, name, partitions, replication_factor }` | — |
| `delete_topic` | `{ connection_id, topic }` | — |
| `fetch_messages` | `{ connection_id, topic, filter }` | `KafkaMessage[]` |
| `produce_message` | `{ connection_id, topic, key, value, headers, partition? }` | — |

### 5.4 消费者组操作

| 命令 | 参数 | 返回 |
|------|------|------|
| `list_consumer_groups` | `{ connection_id }` | `string[]` |
| `get_consumer_group_status` | `{ connection_id, group_id }` | `ConsumerGroupInfo` |
| `reset_consumer_group_offsets` | `{ connection_id, group_id, topic, offsets }` | — |

### 5.5 系统

| 命令 | 参数 | 返回 |
|------|------|------|
| `check_update` | — | `UpdateInfo?` |
| `get_cache_stats` | — | `{ used_mb, limit_mb }` |

---

## 6. 实现计划（分阶段）

### 当前实现状态速览

| 模块 | 状态 | 关键缺陷 |
|------|------|----------|
| 欢迎页 | ✅ 完成 | — |
| 主窗口布局 | ✅ 完成 | — |
| 连接管理弹窗 | ✅ 完成 | — |
| 侧边栏树 | ⚠️ 部分 | 右键菜单项缺 onClick 处理 |
| 主题状态页 | ✅ 完成 | — |
| 主题数据页 | ⚠️ 部分 | regex 用 contains 代替 |
| 消费者组状态页 | ⚠️ 部分 | offsets=[], assignments=[] |
| 关于弹窗 | ✅ 完成 | — |
| 后端命令 | ⚠️ 部分 | 5 个前端 API 无对应后端命令 |
| 消息缓存 | ⚠️ 部分 | 已实现但未接入 fetch_messages |
| 设置页 | ❌ 缺失 | — |
| 更新检查 | ❌ 缺失 | MenuBar 中为 TODO stub |
| 分屏 | ❌ 缺失 | — |
| 密码加密 | ❌ 缺失 | 明文存储 |

#### 会导致运行时错误的缺失命令

前端 `src/api/` 调用了以下 Tauri 命令，但后端 `lib.rs` 未注册：
1. `create_topic` — `src/api/topic.ts`
2. `delete_topic` — `src/api/topic.ts`
3. `reset_consumer_group_offsets` — `src/api/consumer-group.ts`
4. `check_update` — `src/api/system.ts`
5. `get_cache_stats` — `src/api/system.ts`

---

### Phase 1: 修复后端命令缺失（防止运行时错误）

**目标：** 实现 5 个缺失的 Tauri 命令，消除所有 "command not found" 运行时错误。

**依赖：** 无

#### Task 1.1: 使 `build_config` 可被其他模块访问

**文件：** `src-tauri/src/kafka/client.rs:22`

将 `fn build_config` 改为 `pub(crate) fn build_config`，让 topic.rs 等模块可以用它创建 AdminClient。

#### Task 1.2: 实现 create_topic / delete_topic (Kafka 层)

**文件：** `src-tauri/src/kafka/topic.rs`

添加两个函数：

```rust
use rdkafka::admin::{AdminClient, AdminOptions, NewTopic, TopicReplication};
use rdkafka::client::DefaultClientContext;

pub fn create_topic(
    conn: &ConnectionConfig,
    name: &str,
    num_partitions: i32,
    replication_factor: i32,
) -> AppResult<()> {
    let config = KafkaClientManager::build_config(conn);
    let admin: AdminClient<DefaultClientContext> = config.create()
        .map_err(|e| AppError::Kafka(e.to_string()))?;
    let new_topic = NewTopic::new(name, num_partitions, TopicReplication::Fixed(replication_factor));
    let rt = tokio::runtime::Runtime::new().map_err(|e| AppError::General(e.to_string()))?;
    let results = rt.block_on(admin.create_topics(&[new_topic], &AdminOptions::new()))
        .map_err(|e| AppError::Kafka(e.to_string()))?;
    for result in results {
        result.map_err(|(_, e)| AppError::Kafka(e.to_string()))?;
    }
    Ok(())
}

pub fn delete_topic(conn: &ConnectionConfig, name: &str) -> AppResult<()> {
    // 同上，调用 admin.delete_topics(&[name], &AdminOptions::new())
}
```

#### Task 1.3: 实现 create_topic / delete_topic (命令层)

**文件：** `src-tauri/src/commands/topic.rs`

遵循 `list_topics` 的模式（第 8-21 行），添加：

```rust
#[tauri::command]
pub fn create_topic(
    connection_id: &str, name: &str, partitions: i32, replication_factor: i32,
    manager: State<'_, ProjectManager>, kafka: State<'_, KafkaClientManager>,
) -> Result<(), String>

#[tauri::command]
pub fn delete_topic(
    connection_id: &str, topic: &str,
    manager: State<'_, ProjectManager>, kafka: State<'_, KafkaClientManager>,
) -> Result<(), String>
```

#### Task 1.4: 实现 reset_consumer_group_offsets

**文件：** `src-tauri/src/kafka/consumer_group.rs`

```rust
pub fn reset_consumer_group_offsets(
    client_manager: &KafkaClientManager,
    conn: &ConnectionConfig,
    group_id: &str,
    topic: &str,
    offsets: std::collections::HashMap<i32, i64>,
) -> AppResult<()>
```

实现方式：创建一个 consumer，group.id 设为目标 group_id，构建 `TopicPartitionList`，设置每个分区的 offset，然后调用 `consumer.commit()` 提交偏移量。

**文件：** `src-tauri/src/commands/consumer_group.rs`

添加对应的 `#[tauri::command]` 函数。

#### Task 1.5: 实现 check_update / get_cache_stats

**文件：** 新建 `src-tauri/src/commands/system.rs`

```rust
#[tauri::command]
pub fn check_update() -> Result<serde_json::Value, String> {
    // 第一阶段返回 stub: { has_update: false, latest_version: env!("CARGO_PKG_VERSION"), ... }
}

#[tauri::command]
pub fn get_cache_stats(cache: State<'_, MessageCache>) -> Result<serde_json::Value, String> {
    let (count, limit_mb) = cache.stats();
    Ok(serde_json::json!({ "used_mb": count, "limit_mb": limit_mb }))
}
```

#### Task 1.6: 注册所有新命令

**文件：** `src-tauri/src/commands/mod.rs` — 添加 `pub mod system;`

**文件：** `src-tauri/src/lib.rs` — 在 `invoke_handler` 中添加：
```
commands::topic::create_topic,
commands::topic::delete_topic,
commands::consumer_group::reset_consumer_group_offsets,
commands::system::check_update,
commands::system::get_cache_stats,
```

#### 验证

1. `cargo build` 无错误
2. 前端调用 create_topic / delete_topic / check_update / get_cache_stats 不再出现 "command not found"
3. 可通过 create_topic 创建主题后在 list_topics 中看到

---

### Phase 2: 完善消费者组数据（offsets 和 assignments）

**目标：** 修复 `get_consumer_group_status` 使其返回真实的分区分配和已提交偏移量。

**依赖：** Phase 1

#### Task 2.1: 获取成员分区分配

**文件：** `src-tauri/src/kafka/consumer_group.rs:44-54`

当前 `assignments` 硬编码为空数组。需解析 `m.assignment()` 返回的字节数据。

rdkafka 的 `GroupMemberInfo` 的 `assignment()` 返回 Kafka ConsumerProtocol Assignment 格式的原始字节。解析方式：
- 2 字节 version
- 4 字节 topic 数组长度
- 每个 topic: 2 字节字符串长度 + 字符串 + 4 字节分区数组长度 + 每分区 4 字节

也可以使用替代方式：遍历所有主题的元数据，创建一个临时 consumer (group.id = 目标组)，获取 `consumer.assignment()` 列表。

#### Task 2.2: 获取已提交偏移量和 Lag

当前 `offsets` 硬编码为空数组。实现方式：
1. 创建一个 consumer (group.id = 目标组)
2. 从主题元数据或成员分配中收集所有 (topic, partition) 对
3. 构建 `TopicPartitionList`
4. 调用 `consumer.committed(tpl, timeout)` 获取已提交偏移量
5. 对每个分区调用 `consumer.fetch_watermarks()` 获取 log_end_offset
6. 计算 `lag = log_end_offset - committed_offset`

返回 JSON 必须匹配前端 `ConsumerGroupOffset` 类型：
```json
{ "topic": "...", "partition": 0, "current_offset": 100, "log_end_offset": 200, "lag": 100 }
```

#### 验证

1. 打开一个有活跃消费者的消费者组状态页，成员列表中 "分配的分区" 列显示真实数据
2. 偏移量表格显示每个分区的 current_offset、log_end_offset 和 lag
3. Lag 值使用正确的颜色标签（>1000 红色，>100 橙色，其他绿色）
4. 无活跃成员但有已提交 offset 的消费者组也能正常显示 offset 信息

---

### Phase 3: 消息缓存集成 + Regex 支持

**目标：** 将已有的 `MessageCache` 接入 `fetch_messages`，并添加 `regex` crate 实现真正的正则匹配。

**依赖：** Phase 1

#### Task 3.1: 添加 regex 依赖

**文件：** `src-tauri/Cargo.toml`

```toml
regex = "1"
```

#### Task 3.2: 修复 regex_match 函数

**文件：** `src-tauri/src/commands/topic.rs:201-204`

将当前的 `text.contains(pattern)` 替换为：

```rust
fn regex_match(text: &str, pattern: &str) -> bool {
    regex::Regex::new(pattern)
        .map(|re| re.is_match(text))
        .unwrap_or(false)
}
```

#### Task 3.3: 将缓存集成到 fetch_messages

**文件：** `src-tauri/src/commands/topic.rs:39-198`

修改 `fetch_messages` 函数签名，增加 cache 参数：
```rust
cache: State<'_, MessageCache>,
```

流程：
1. 请求前先检查 `cache.get(connection_id, topic, partition)`
2. 如果缓存命中且覆盖了请求的 offset 范围，直接使用缓存数据
3. 从 Kafka 拉取新消息后，调用 `cache.put()` 存入缓存
4. 需要在 `CachedMessage` 和 `serde_json::Value` 之间做转换

#### Task 3.4: 增强 MessageCache 的大小追踪

**文件：** `src-tauri/src/cache/message_cache.rs`

当前 `stats()` 返回 `(cache.len(), max_size_mb)` ，不够精确。增加 `current_size_bytes: Mutex<u64>` 字段：
- `put()` 时估算消息大小（key.len + value.len + headers.len + 64 overhead）并累加
- `clear()` 时重置为 0
- `stats()` 返回 `(current_size_bytes / 1MB, max_size_mb)`

#### 验证

1. `cargo build` 成功
2. 在主题数据页使用 regex 模式筛选（如 `^test-.*`），确认能正确匹配
3. 同一主题数据第二次加载速度更快（命中缓存）
4. 底栏/get_cache_stats 返回合理的已用缓存大小

---

### Phase 4: 前端缺失的弹窗（创建主题、删除主题、重置偏移量）

**目标：** 补齐三个缺失的操作弹窗，并接入侧边栏右键菜单。

**依赖：** Phase 1（后端命令必须存在）

#### Task 4.1: CreateTopicModal 组件

**文件：** 新建 `src/pages/Main/CreateTopicModal.tsx`

参考 `src/pages/ConnectionModal/index.tsx` 的 Modal + Form 模式。

Props:
```tsx
interface CreateTopicModalProps {
  open: boolean;
  connectionId: string;
  onClose: () => void;
  onCreated: () => void;
}
```

表单字段：
- `name`: Input, required, 不允许空格和特殊字符
- `partitions`: InputNumber, 默认 1, min 1
- `replicationFactor`: InputNumber, 默认 1, min 1

提交：调用 `topicApi.createTopic(connectionId, name, partitions, replicationFactor)`，成功后 `message.success('主题已创建')`，调用 `onCreated()` 刷新主题列表。

#### Task 4.2: DeleteTopicModal 组件

**文件：** 新建 `src/pages/Main/DeleteTopicModal.tsx`

确认删除弹窗，要求用户输入主题名称确认（防误删）。

Props:
```tsx
interface DeleteTopicModalProps {
  open: boolean;
  connectionId: string;
  topicName: string;
  onClose: () => void;
  onDeleted: () => void;
}
```

#### Task 4.3: ResetOffsetsModal 组件

**文件：** 新建 `src/pages/Main/ResetOffsetsModal.tsx`

Props:
```tsx
interface ResetOffsetsModalProps {
  open: boolean;
  connectionId: string;
  groupId: string;
  onClose: () => void;
  onReset: () => void;
}
```

表单字段：
- 主题名称：Select，通过 `topicApi.listTopics` 填充选项
- 重置策略：Select — "重置到开头"、"重置到末尾"、"指定偏移量"、"指定时间戳"
- 分区偏移量输入：选择 "指定偏移量" 时显示各分区的 InputNumber

#### Task 4.4: 接入侧边栏右键菜单

**文件：** `src/pages/Main/Sidebar.tsx`

需要修改的位置：
- 第 110 行 `{ key: 'create', label: '创建主题' }` — 添加 `onClick` 打开 CreateTopicModal
- 第 114 行 `parts[2] === 'topic'` 块 — 增加 `{ key: 'delete', label: '删除主题', danger: true }` 打开 DeleteTopicModal
- 第 118 行 `{ key: 'view-data', label: '查看主题数据' }` — 添加 `onClick` 调用 `openTopicData`
- 第 132 行 `{ key: 'reset-offsets', label: '重置偏移量' }` — 添加 `onClick` 打开 ResetOffsetsModal
- 第 102 行 `{ key: 'edit', label: '编辑连接' }` — 添加 `onClick` 打开连接管理弹窗
- 第 103 行 `{ key: 'remove', label: '移除连接' }` — 添加 `onClick` 调用 `connectionApi.deleteConnection` 并刷新

增加组件 state：
```tsx
const [createTopicOpen, setCreateTopicOpen] = useState(false);
const [createTopicConnId, setCreateTopicConnId] = useState('');
const [deleteTopicOpen, setDeleteTopicOpen] = useState(false);
const [deleteTopicInfo, setDeleteTopicInfo] = useState({ connId: '', topic: '' });
const [resetOffsetsOpen, setResetOffsetsOpen] = useState(false);
const [resetOffsetsInfo, setResetOffsetsInfo] = useState({ connId: '', groupId: '' });
```

在 JSX 末尾渲染三个 Modal。

#### 验证

1. 右键 "主题" 文件夹 → "创建主题"，填写表单后确认，新主题出现在树中
2. 右键某主题 → "删除主题"，输入名称确认后主题从树中消失
3. 右键某消费者组 → "重置偏移量"，选择主题和策略后确认，消费者组状态页偏移量更新
4. 右键 "查看主题数据" 正常打开数据标签页

---

### Phase 5: 设置页面 + 自动刷新持久化

**目标：** 实现设置弹窗（主题、语言、缓存配置），并将每个页面的自动刷新配置持久化到项目文件。

**依赖：** Phase 1

#### Task 5.1: 后端设置命令

**文件：** `src-tauri/src/project/manager.rs`

添加方法：
```rust
pub fn get_settings(&self) -> AppSettings {
    self.global_config.lock().unwrap().settings.clone()
}
pub fn save_settings(&self, settings: AppSettings) -> AppResult<()> {
    self.global_config.lock().unwrap().settings = settings;
    self.save_global_config()
}
pub fn get_refresh_config(&self, key: &str) -> Option<RefreshConfig> {
    let project = self.current_project.lock().unwrap();
    project.as_ref()?.refresh_configs.get(key).cloned()
}
pub fn save_refresh_config(&self, key: &str, config: RefreshConfig) -> AppResult<()> {
    let mut project = self.current_project.lock().unwrap();
    if let Some(ref mut p) = *project {
        p.refresh_configs.insert(key.to_string(), config);
    }
    drop(project);
    self.save_project_config()
}
```

**文件：** `src-tauri/src/commands/system.rs`

添加：
```rust
#[tauri::command]
pub fn get_settings(manager: State<'_, ProjectManager>) -> Result<serde_json::Value, String>

#[tauri::command]
pub fn save_settings(settings: serde_json::Value, manager: State<'_, ProjectManager>) -> Result<(), String>

#[tauri::command]
pub fn get_refresh_config(key: &str, manager: State<'_, ProjectManager>) -> Result<serde_json::Value, String>

#[tauri::command]
pub fn save_refresh_config(key: &str, enabled: bool, interval_secs: u64, manager: State<'_, ProjectManager>) -> Result<(), String>
```

**文件：** `src-tauri/src/lib.rs` — 注册新命令

#### Task 5.2: 前端 API

**文件：** `src/api/system.ts`

添加 `getSettings()`, `saveSettings()`, `getRefreshConfig()`, `saveRefreshConfig()` 函数。

#### Task 5.3: SettingsModal 组件

**文件：** 新建 `src/pages/Settings/index.tsx`

使用 Ant Design Modal + Form：
- 主题颜色：Select（浅色/深色）
- 界面语言：Select（zh-CN/en-US）— 第一阶段仅 UI，不做完整 i18n
- 缩放比：Slider（0.5 到 2.0）
- 每页缓存大小(MB)：InputNumber
- 总缓存大小(MB)：InputNumber

打开时调用 `getSettings()` 填充，保存时调用 `saveSettings()`。

#### Task 5.4: 接入 MenuBar

**文件：** `src/pages/Main/MenuBar.tsx`

在 `fileMenuItems` 的 divider 前添加 `{ key: 'settings', label: '设置' }`。

#### Task 5.5: App.tsx 应用主题

**文件：** `src/App.tsx`

启动时读取 settings，根据 theme 字段选择 `theme.defaultAlgorithm` 或 `theme.darkAlgorithm`（与 `compactAlgorithm` 组合使用）。

#### Task 5.6: 自动刷新持久化

**文件：** `src/pages/TopicStatus/index.tsx`, `src/pages/TopicData/index.tsx`, `src/pages/ConsumerGroupStatus/index.tsx`

在每个页面中：
- 组件挂载时调用 `getRefreshConfig(key)` 加载已保存的刷新配置
- 用户修改自动刷新开关或频率时调用 `saveRefreshConfig()` 持久化
- key 格式：`{connectionId}::{type}::{resourceName}`

#### 验证

1. 设置弹窗从 "文件" 菜单打开
2. 切换深色主题后整个应用变暗色
3. 设置在重启后保留（存储在 `~/.kafka-viewer/config.json`）
4. 主题状态页设置自动刷新 30s 后关闭重开，仍为 30s

---

### Phase 6: 更新检查器

**目标：** 将 `check_update` 从 stub 替换为真正的 GitHub Releases API 检查。

**依赖：** Phase 1

#### Task 6.1: 添加 HTTP 客户端依赖

**文件：** `src-tauri/Cargo.toml`

```toml
reqwest = { version = "0.12", features = ["json", "blocking"] }
```

#### Task 6.2: 实现真正的更新检查

**文件：** `src-tauri/src/commands/system.rs`

替换 `check_update` stub：
- 请求 `https://api.github.com/repos/lyh543/kafka-viewer/releases/latest`
- 解析 `tag_name` 与 `env!("CARGO_PKG_VERSION")` 做简单 semver 比较
- 返回 `{ has_update, latest_version, download_url, release_notes }`
- 网络错误时优雅降级，返回 `has_update: false`

#### Task 6.3: UpdateModal 前端组件

**文件：** 新建 `src/pages/Main/UpdateModal.tsx`

打开时调用 `checkUpdate()`，显示 loading → 结果。
- 无更新："已是最新版本 (v0.1.0)"
- 有更新：显示新版本号、release notes、"下载" 按钮（通过 `@tauri-apps/plugin-opener` 打开 URL）

#### Task 6.4: 接入 MenuBar

**文件：** `src/pages/Main/MenuBar.tsx:25`

替换 `/* TODO */` 为打开 UpdateModal 的逻辑。

#### 验证

1. "帮助 → 检查更新" 打开弹窗
2. 显示当前版本和是否有更新
3. 网络断开时不崩溃，显示 "无法检查更新"

---

### Phase 7: 分屏视图

**目标：** 支持主题的状态+数据并排分屏查看。

**依赖：** Phase 4

#### Task 7.1: 扩展 Tab 类型

**文件：** `src/stores/tabs.ts`

在 `Tab.type` 联合类型中添加 `'topic_split'`。

#### Task 7.2: TopicSplitView 组件

**文件：** 新建 `src/pages/TopicSplitView/index.tsx`

使用 Ant Design `Splitter` 组件（v5.21+）或简单的 flex 布局 + 可拖拽分隔线：
- 左侧渲染 `<TopicStatus>`
- 右侧渲染 `<TopicData>`
- 初始比例 40%:60%
- 分隔线可拖拽调整

Props：
```tsx
interface TopicSplitViewProps {
  connectionId: string;
  connectionName: string;
  topicName: string;
}
```

#### Task 7.3: 接入 ContentArea

**文件：** `src/pages/Main/ContentArea.tsx`

在 `renderTabContent` 中添加 `case 'topic_split'`，渲染 `<TopicSplitView>`。

#### Task 7.4: 导航入口

**文件：** `src/hooks/useTabNavigation.ts`

添加 `openTopicSplitView` 方法。

**文件：** `src/pages/Main/Sidebar.tsx`

在主题节点右键菜单中添加 "分屏查看" 选项。

**文件：** `src/pages/TopicStatus/index.tsx`

在工具栏添加分屏按钮（`SplitCellsOutlined` 图标）。

#### 验证

1. 右键主题 → "分屏查看" 打开分屏标签页
2. 左侧显示主题状态，右侧显示主题数据
3. 分隔线可拖拽
4. 两侧独立支持自动刷新
5. 标签页标题含 "分屏" 后缀

---

### Phase 8: 安全加固（密码加密）

**目标：** 对 project.json 中存储的连接密码进行加密，并在使用时自动解密。

**依赖：** Phase 5

#### Task 8.1: 添加加密依赖

**文件：** `src-tauri/Cargo.toml`

```toml
aes-gcm = "0.10"
base64 = "0.22"
rand = "0.8"
```

#### Task 8.2: 加密模块

**文件：** 新建 `src-tauri/src/crypto.rs`

```rust
pub fn get_or_create_key() -> [u8; 32]  // 首次运行生成密钥，存储在 ~/.kafka-viewer/.keyfile
pub fn encrypt(plaintext: &str) -> Result<String, String>  // 返回 "enc:" + base64(nonce || ciphertext || tag)
pub fn decrypt(ciphertext: &str) -> Result<String, String>  // 去掉 "enc:" 前缀后解密
```

密钥存储在 `~/.kafka-viewer/.keyfile`，首次运行时生成随机 256-bit 密钥。

#### Task 8.3: 加密/解密集成

**文件：** `src-tauri/src/project/manager.rs`

- `save_connection()` (第 154 行): 保存前，如果 `conn.auth.password` 为 `Some` 且不以 `enc:` 开头，则加密
- `get_connections()` (第 145 行): 返回前，解密所有以 `enc:` 开头的密码

**文件：** `src-tauri/src/lib.rs`

添加 `mod crypto;`

#### Task 8.4: 向后兼容

已有的明文密码在下次 `save_connection` 时自动加密。不需要迁移脚本。

#### 验证

1. 保存连接后查看 `project.json`，密码字段显示为 `enc:base64...`
2. 已有明文密码连接可正常使用（解密兼容）
3. 保存连接后密码被加密，再次打开连接编辑弹窗仍显示正确密码
4. 测试连接、获取主题等操作使用加密密码仍正常工作
5. `~/.kafka-viewer/.keyfile` 文件存在

---

### Phase 依赖关系图

```
Phase 1 (修复后端命令)
  ├── Phase 2 (消费者组数据)
  ├── Phase 3 (缓存 + Regex)
  ├── Phase 4 (前端弹窗) ──→ Phase 7 (分屏)
  ├── Phase 5 (设置) ──→ Phase 8 (密码加密)
  └── Phase 6 (更新检查)
```

Phase 2/3/4/5/6 在 Phase 1 完成后可并行执行。Phase 7 依赖 Phase 4，Phase 8 依赖 Phase 5。

---

### 关键文件索引

#### 后端（每个 Phase 都可能修改）
| 文件 | 作用 |
|------|------|
| `src-tauri/src/lib.rs` | Tauri 命令注册中心 |
| `src-tauri/src/commands/topic.rs` | 主题命令（Phase 1/3） |
| `src-tauri/src/commands/consumer_group.rs` | 消费者组命令（Phase 1/2） |
| `src-tauri/src/commands/system.rs` | 系统命令（Phase 1/5/6）新建 |
| `src-tauri/src/kafka/client.rs` | Kafka 客户端管理（Phase 1） |
| `src-tauri/src/kafka/topic.rs` | 主题操作（Phase 1） |
| `src-tauri/src/kafka/consumer_group.rs` | 消费者组操作（Phase 1/2） |
| `src-tauri/src/cache/message_cache.rs` | 消息缓存（Phase 3） |
| `src-tauri/src/project/manager.rs` | 项目配置管理（Phase 5/8） |
| `src-tauri/src/project/config.rs` | 配置结构定义 |

#### 前端
| 文件 | 作用 |
|------|------|
| `src/App.tsx` | 根组件，主题切换（Phase 5） |
| `src/pages/Main/Sidebar.tsx` | 侧边栏，弹窗入口（Phase 4） |
| `src/pages/Main/MenuBar.tsx` | 菜单栏（Phase 5/6） |
| `src/pages/Main/ContentArea.tsx` | 标签页路由（Phase 7） |
| `src/pages/TopicStatus/index.tsx` | 主题状态页（Phase 5 刷新持久化） |
| `src/pages/TopicData/index.tsx` | 主题数据页（Phase 5 刷新持久化） |
| `src/pages/ConsumerGroupStatus/index.tsx` | 消费者组状态页（Phase 5 刷新持久化） |
| `src/api/system.ts` | 系统 API（Phase 5/6） |
| `src/stores/tabs.ts` | 标签页状态（Phase 7） |
| `src/hooks/useTabNavigation.ts` | 标签页导航（Phase 7） |

---

## 7. 关键设计决策

### 7.1 状态管理：Zustand
选择 Zustand 而非 Redux，因为它更轻量、API 更简洁，适合这种中等规模应用。

### 7.2 消息缓存策略
- 后端使用 LRU 缓存，键为 `(connection_id, topic, partition, offset_range)`
- 默认每页 200MB，总计 2GB
- 对于 key/value 的文本筛选（equals/contains/regex），在后端完成过滤后再传给前端
- 对于 offset/timestamp 范围筛选，直接传参给 Kafka 消费者

### 7.3 自动刷新
- 封装为 `useAutoRefresh(key, fetchFn, options)` Hook
- 刷新配置持久化到项目配置文件中
- key 格式: `{connectionId}::{type}::{resourceName}::{view}`

### 7.4 标签页管理
- 使用 Ant Design Tabs 组件的 editable 模式
- 标签页 ID 格式: `{connectionId}::{type}::{resourceName}::{view}`
- 同一资源的同一视图只允许打开一个标签页（重复打开时切换到已有标签页）
- 后期支持拖拽分屏

### 7.5 Ant Design 配置
- 使用 ConfigProvider 设置紧凑主题 (`algorithm: theme.compactAlgorithm`)
- 禁用不必要的动画 (`motion: false`)
- 中文 locale

---

## 8. Rust 依赖

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-dialog = "2"       # 文件对话框
tauri-plugin-fs = "2"           # 文件系统访问
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rdkafka = { version = "0.36", features = ["cmake-build"] }
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
chrono = "0.4"
lru = "0.12"                    # LRU 缓存
dirs = "6"                      # 获取用户目录
thiserror = "2"                 # 错误处理
log = "0.4"
env_logger = "0.11"
```

## 9. 前端依赖

```json
{
  "dependencies": {
    "antd": "^5",
    "@ant-design/icons": "^5",
    "zustand": "^5",
    "react-router-dom": "^7"
  }
}
```

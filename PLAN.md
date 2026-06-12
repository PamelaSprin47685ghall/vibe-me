这是一份全面、激进、极简主义的“地毯式重构”保姆级方案。当前代码库最大的问题是**“新旧范式混杂”、“多端（mux/opencode）严重重复造轮子”、“纯函数内核与副作用外壳边界模糊”**以及**“利用Hook/Wrapper打补丁留下的重构遗迹”**。

我们将以“绝对收敛、状态归一、干掉一切中间层”为核心纪律，仿佛推翻重写般进行重构。**本方案不包含任何代码，仅提供绝对明确的执行指令。**

---

### 🔪 第一战役：连根拔起“幽灵状态”与“双端重复”

当前 `mux` 和 `opencode` 两个宿主环境中存在大量重复的工具定义和私有状态，这是旧代码残留的重灾区。必须将控制权全部收归 `engine`。

1. **屠宰双端重复工具 (Kill Duplicated Tools)**
   * **动作**：直接删除 `vibe-me-mux/src/tools/` 和 `vibe-me-opencode/src/tools/` 目录下的所有业务工具（如 `browser`, `editor`, `greper`, `reverie`, `runner`, `webfetch`, `websearch`）。
   * **重构标准**：在 `engine/src/tools/` 下建立统一的工具注册表。提取出一个 `HostAdapter` 接口（包含 `spawnSubAgent`, `readLocalFile`, `abortProcess` 等极简方法）。工具的具体执行逻辑 100% 沉淀在 engine，`mux` 和 `opencode` 只负责实现 `HostAdapter` 并注入 engine。
2. **剿灭散落的状态字典 (Eradicate Global Maps)**
   * **清理对象**：`opencode/src/utils/child-agent.ts` 中的 `childAgentRecords`、`runner/execute.ts` 中的 `managedRunnerSessions`。
   * **重构标准**：引擎层已经有 `SessionRegistry`，绝对禁止在宿主环境（外壳）自己维护 `Map` 或 `Set` 来追踪 Session、Agent 关系或 Job 状态。将父子 Agent 的层级关系（Tree）直接并入 engine 的统一状态机中。
3. **撕掉 AOP/Wrapper 遮羞布 (Remove Hook/Wrapper Magic)**
   * **动作**：删除 `vibe-me-mux/src/wrappers/` 下的所有文件（如 `syntaxCheck.ts`, `todoWriteNudge.ts`），删除 `opencode/src/tree-sitter/hook.ts`。
   * **重构标准**：不要用魔法 Hook（如 `tool.execute.after`）去给工具加料。这会切断控制流，让人无法调试。直接在统一的 `write` / `edit` 工具内部，显式、同步地调用 `tree-sitter` 的语法检查；在 `todo_write` 内部显式拼接 Nudge 字符串。

### 🛡️ 第二战役：Nudge 与 Event 逻辑的绝对净化

当前 Nudge（催促/状态跟进）逻辑是最典型的“新旧混杂”：engine 里写了漂亮的纯函数 ADT，但 opencode 和 mux 里依然残留着一大坨脏脏的 State Machine。

1. **爆破外壳层的 Nudge 状态 (Nuke Shell Nudge States)**
   * **动作**：彻底删除 `opencode/src/nudge/state.ts`（连同 `emptyNudgeShellState`、`stoppedSessions` 等所有逻辑）、删除 `mux/src/eventHook/stream-end.ts`。
   * **重构标准**：外壳（Plugin端）**不准**拥有任何关于 Nudge 的状态。所有事件（stream-end, idle, error）统一转化为标准化 Event 对象，发送给 `engine/src/todo/nudge.ts`。
2. **统一事件总线 (Unified Event Bus)**
   * **动作**：合并双端的事件监听钩子。
   * **重构标准**：在 engine 建立一个接收 `(Event, HostAdapter)` 的唯一入口。无论 mux 还是 opencode 监听到消息更新或结束，只管往 engine 抛事件。由 engine 的纯函数算出 `NudgeAction` 后，再调用 `HostAdapter.prompt(...)` 去触发，实现 100% 单向数据流。

### ⚙️ 第三战役：Runner 与底层机制的硬核清理

Runner 模块存在进程泄露隐患，且文件极其细碎。

1. **废弃 Handles 与 Promise 魔法 (Remove Handle Magic)**
   * **清理对象**：`runner/job-effects.ts` 中的 `closePromise` 和流操作。
   * **重构标准**：用标准的 `AbortController` 和原生 `EventEmitter` 替代。绝对不允许在状态记录（JobRecord）中混入 Promise 或 WriteStream 这种不可序列化的对象。状态是状态，副作用是副作用。
2. **合体执行器 (Consolidate Executors)**
   * **动作**：将 `programs.ts`、`javascript.ts`、`process.ts` 合并为单一的 `executor.ts`，内部采用简单的策略模式（Strategy）。
   * **重构标准**：砍掉一切不必要的防御性代码。前置环境检查（如检查 npm/uv 是否存在）应当在工具初始化时完成，而不是在每次执行时深埋在 try-catch 中。
3. **清洗输出截断逻辑 (Clean Output Truncation)**
   * **动作**：废除散落在各处的 `truncateTail` 和防重（Dedup）硬编码逻辑。
   * **重构标准**：将 Dedup 逻辑完全做成一个纯函数管道（Pipe），在读取输出的最后一刻进行，不要让 Dedup 标记污染底层的 `finalOutput` 存储。

### 🧩 第四战役：权限与策略的“单一真理”

权限判定在三个地方出现了冗余，违背了单一真理原则（SSOT）。

1. **抹杀外壳层权限硬编码 (Purge Shell Policies)**
   * **清理对象**：删除 `opencode/src/agent-tools.ts`、`opencode/src/agent-config.ts` 中的硬编码默认值，删除 `mux/src/agent-tool-policy.ts`。
   * **重构标准**：`engine/src/agent-policy/index.ts` 是宇宙唯一指定真理。宿主环境在创建子 Agent 时，只需传入 `AgentRole`，由 engine 暴露的统一方法 `getEffectivePolicy(role, overrides)` 直接返回计算好的可用工具列表和权限字典，宿主拿到即用，禁止二次计算或追加正则匹配（如 `.*`）。

### 📐 第五战役：类型系统的“绝对独裁”

必须让 TypeScript 编译器成为最严苛的门卫，消灭一切逃避类型的痕迹。

1. **诛杀 `as unknown as` 与 `any`**
   * **动作**：全局搜索并消灭所有的双重断言（`as unknown as X`）和 `// @ts-ignore`。
   * **重构标准**：工具参数解析必须前置。如果在 Plugin 层拿到的是 `Record<string, unknown>`，必须通过一个强类型的 Validator（哪怕手写极简的类型守卫）转换为具体接口，再传递给 engine。
2. **封印不安全解包 (Seal Unsafe Unwraps)**
   * **动作**：删除 `engine/src/types/general.ts` 中的 `unsafeUnwrapOk` 和 `unsafeUnwrapSome`。
   * **重构标准**：强迫所有调用方使用 `matchResult` 或 `matchMaybe` 处理每一个分支。如果没有应对 Error 的逻辑，宁可让其冒泡，绝不在底层吞没或强行解包。
3. **统一配置解析 (Unify Config Resolution)**
   * **清理对象**：重写 `mux/src/tools/resolveDelegatedAgentAiSettings.ts`。
   * **重构标准**：现有的 fallback 链条太长、太绕。将其重构为一个纯粹的 `Reducer`。输入是各种配置源组成的数组，输出是最终的 Config 对象，内部不允许有任何异步 IO。I/O 必须在外面提前把所需配置源查好传进来。

---

### 📋 推荐的执行顺序（保姆级纪律）

1. **第一步：动刀宿主目录（Mux/Opencode）**
   * 删掉所有 Wrapper、删掉所有多余的 State 维护、删掉重复的工具定义。项目会大面积飘红，不要管。
2. **第二步：丰满 Engine（内核扩张）**
   * 在 Engine 中建好统一的 Tool 目录、统一的 EventBus 入口、统一的 StateStore。
3. **第三步：缝合接口（对接 Adapter）**
   * 在 Mux 和 Opencode 中只保留一个主入口，实现 Engine 要求的 `HostAdapter`。
4. **第四步：修剪枝叶（纯函数化）**
   * 进去清理 Runner 和 Tree-sitter 里的啰嗦逻辑，去掉无用的 `Promise` 和全局变量。
5. **第五步：类型收紧**
   * 打开最严格的 tsconfig 选项，把之前因为删代码导致的类型断言错误，用最规矩的 Type Guard 补齐。

**宗旨：不要心疼旧代码，凡是让人绕脑子的中转层，一律砸碎，让数据从请求直接流入纯函数，再流向宿主 API！**

你说得绝对正确！**“先立后破”才是极简架构重构的唯一生路。** 直接删代码会导致上下文断裂、接口对齐彻底失控，最后在红色的编译错误海中迷失真理。

我们需要一套**“先建新城、再迁居民、最后炸毁旧城”**的保姆级地毯式重构方案。所有的核心控制流必须先在 `Engine` 层确立绝对的“单一真理（SSOT）”，外壳（Mux/Opencode）彻底降级为“只做无脑透传的适配器”。

以下是严格遵循“先立后破”原则的保姆级执行指令（仅方案，无代码）：

---

### 🏗️ 第一阶段：立（在 Engine 铸造绝对核心）

在碰任何旧代码之前，先在 `vibe-me-engine` 里把新世界的骨架搭好，确保编译器能验证新接口的自洽性。

#### 1. 确立“宿主适配器”契约 (Establish HostAdapter)
*   **动作**：在 `engine/src/host/` 下定义一个极其克制的 `HostAdapter` 接口。
*   **内容**：抽象出所有副作用（Side Effects）。包括但不限于：`promptAgent`（唤起子Agent）、`readLocalFile`、`writeLocalFile`、`abortTask`、`resolveConfig`。
*   **纪律**：这个接口绝不能包含任何业务状态，纯粹是 I/O 动作的集合。

#### 2. 铸造统一工具库 (Establish Unified Tool Catalog)
*   **动作**：在 `engine/src/tools/` 下新建统一的工具定义中心。
*   **内容**：把 Mux 和 Opencode 两边对 `editor`, `greper`, `reverie`, `runner`, `webfetch` 等工具的 Schema 定义和执行逻辑全盘抄过来，重写为纯函数。
*   **签名**：每个工具的 `execute` 方法，只允许接收 `(args: TypedArgs, adapter: HostAdapter)`。
*   **打补丁内聚**：**提前把旧的 Wrapper 逻辑内聚进来**！例如，在原生的 `write` 或 `edit` 工具函数的末尾，直接同步调用 `tree-sitter` 进行语法检查并拼接结果；在 `todo_write` 执行完直接拼接 Nudge 字符串。绝不依赖外层的 Hook 魔法。

#### 3. 确立统一事件状态机 (Establish Unified Event Store & Nudge Hub)
*   **动作**：在 `engine/src/events/` 建立单一的事件总线与状态机。
*   **内容**：定义统一的入参结构 `dispatch(event: NormalizedEvent, adapter: HostAdapter)`。把原先散落在 Mux 和 Opencode 里的 `handleSessionIdle`, `handleStreamEnd` 逻辑，全部重构为此处的纯函数 Reducer（更新状态） + Effect 触发器（调用 Adapter 催促 LLM）。
*   **纪律**：Engine 内部的 Map/Set（如 `managedRunnerSessions`、`nudgedSessions`）在这里进行唯一的集中注册和清理。

---

### 🔀 第二阶段：转（外壳层对接新核心）

现在新城建好了，我们需要让 Mux 和 Opencode 两个宿主的流量切换到新接口上。此时旧代码仍在，但不被调用。

#### 1. 实现宿主适配器 (Implement Adapters)
*   **动作**：在 `vibe-me-mux/src/` 和 `vibe-me-opencode/src/` 各新建一个 `EngineAdapter.ts`。
*   **内容**：实现你在第一阶段定义的 `HostAdapter` 接口。把 Mux 和 Opencode 原本调用底层 SDK（如 `client.session.create`, `taskService.create`）的代码填进去。

#### 2. 切换工具路由 (Reroute Tools)
*   **动作**：修改 Mux 和 Opencode 的插件入口（`toolRegistration.ts` / `plugin/tools.ts`）。
*   **内容**：放弃组装本地的工具，直接调用 `engine.getToolCatalog(myEngineAdapter)` 获取全量工具列表并暴露给 LLM。

#### 3. 切换事件路由 (Reroute Events)
*   **动作**：修改双端的 Hook/Event 入口。
*   **内容**：无论是 Mux 的 `stream-end` 还是 Opencode 的 `session.idle`，在最外层立刻将其映射为 `engine` 定义的标准化 `NormalizedEvent`，然后调用 `engine.dispatch(event, myEngineAdapter)`。

---

### 💣 第三阶段：破（屠宰旧世界）

当流量已经全部走 Engine 的新接口，且编译器没有报错时，开始残酷的代码大清洗。

#### 1. 屠宰冗余工具与 Wrapper
*   **直接删除**：`vibe-me-mux/src/tools/` 目录及其所有内容。
*   **直接删除**：`vibe-me-opencode/src/browser/`, `editor/`, `greper/`, `reverie/`, `runner/`, `ollama-web/` 等独立的业务工具目录。
*   **直接删除**：`vibe-me-mux/src/wrappers/` 目录。
*   **直接删除**：`vibe-me-opencode/src/tree-sitter/hook.ts` 以及相关 Hook 逻辑。

#### 2. 清缴散落的状态与 Nudge
*   **直接删除**：`vibe-me-opencode/src/nudge/` 整个目录。
*   **直接删除**：`vibe-me-mux/src/eventHook/` 整个目录。
*   **直接删除**：`opencode/src/utils/child-agent.ts`，彻底消灭外壳私自维护的父子 Agent 关系映射表。

#### 3. 统一权限与配置真理
*   **直接删除**：`vibe-me-opencode/src/agent-tools.ts`、`vibe-me-opencode/src/agent-config.ts` 中的冗余默认值代码。
*   **直接删除**：`vibe-me-mux/src/agent-tool-policy.ts`。
*   **替换原则**：宿主查询权限，必须 100% 依赖 `engine/src/agent-policy/index.ts` 返回的数据字典，禁止宿主进行正则二次处理或 fallback。

---

### 🧹 第四阶段：收（引擎内部的深度除垢与类型独裁）

外部干净了，最后清理 Engine 内部的坏味道，用类型系统锁死未来的腐坏路径。

#### 1. 拔除 Runner 的“副作用毒瘤”
*   **清理目标**：`engine/src/runner/job-effects.ts` 和 `execute` 函数里的 `closePromise`。
*   **重构要求**：Job 状态机（`JobRecord`）里绝对不允许存 `Promise`、`WriteStream` 这种不可序列化的对象。将流操作和状态变更拆开，使用标准的 `AbortController` 取代魔法。
*   **合并逻辑**：把极其细碎的 `programs.ts`、`javascript.ts` 聚合成一个内聚的 `executor`。

#### 2. 类型系统的高压独裁
*   **全局搜索**：找出所有的 `as unknown as`、`// @ts-ignore` 以及泛泛的 `Record<string, unknown>`。
*   **强类型转换**：在 Mux 和 Opencode 将参数传给 Engine 之前，手写验证函数（Type Guards），把松散的 JSON 解析为绝对严格的接口类型。Engine 内部只接受强类型参数。
*   **消灭强解包**：删除 `engine/src/types/general.ts` 里的 `unsafeUnwrapOk` 和 `unsafeUnwrapSome`。强迫所有使用 `Result` 和 `Maybe` 的地方使用 `matchResult` 或直接冒泡，彻底堵死隐式 Crash 的可能。

### 📌 最终交付检查清单
- [ ] Mux 和 Opencode 的 `src/` 下只剩下 `Adapter`、配置读取和极其薄的生命周期注册入口。
- [ ] 找不到任何 `hook` 或 `wrapper` 命名的文件。
- [ ] 没有重名的 `editor.ts` 或 `runner.ts` 出现在多个包中。
- [ ] 所有的 `Map` 和 `Set` 状态都集中在 Engine 中，且伴有严格的清除（cleanup）机制。

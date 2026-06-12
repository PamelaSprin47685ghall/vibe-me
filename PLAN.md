这是一份为你量身定制的**“地毯式、断崖式”保姆级重构方案**。按照你提供的《宝典》原则（纯函数核心、代数类型、事件溯源、状态不可变、隔离副作用、消灭样板代码），当前代码虽然已经有很好的 FP 基础，但依然存在**全局状态残留、插件端逻辑重复、重构遗留尸体文件、新旧状态流混杂**等“偶然复杂度”。

以下方案将严格遵守**“仅输出方案，不写代码”**的约定，将重构拆解为可以直接执行的 6 大战役。

---

### 第一战役：彻底清理重构痕迹与无用代码（大扫除）
*目标：斩断历史包袱，消除引发迷惑的占位文件和旧版遗留。*

**1. 删除纯注释/空置的废弃测试文件**
这些文件是上次拆分文件后留下的“尸体”，必须直接删除：
- `vibe-me-opencode/src/loop/index.test.ts`
- `vibe-me-opencode/src/nudge/index.test.ts`
- `vibe-me-opencode/src/runner/tools.test.ts`
- `vibe-me-mux/src/eventHook.test.ts`
- `vibe-me-mux/src/tools/resolveDelegatedAgentAiSettings.test.ts` (仅包含 `export {};`)

**2. 清理重复的常量与硬编码魔法字符串**
- **清理 Runner 告警文本**：在 `vibe-me-opencode/src/runner/execute.ts` 和 `vibe-me-mux/src/tools/runner.ts` 中都有一段 `// 绝对禁止使用 runner 工具仅仅用于查找或者读写文件...` 的硬编码判定。
  👉 **动作**：将其提取到 `engine/runner/prompts.ts` 中作为纯函数 `formatRunnerSafetyWarning(output, command)`。
- **清理冗余的 Agent 配置**：`vibe-me-opencode` 里的 `agent-tools.ts` 和 `vibe-me-mux` 里的 `agent-tool-policy.ts` 做的都是同一个业务（给不同 Agent 动态增删 Tool）。
  👉 **动作**：废弃这两个文件，统一收敛到 `engine/agent-policy` 下。

---

### 第二战役：全局变量与副作用驱逐（纯化内核）
*目标：消灭引擎中隐藏的 `let` 和全局 `Map`，将状态的持有权推向系统最边缘（外壳层）。*

当前代码存在多处严重违背“隔离可变状态”的全局单例，会导致测试时需要频繁 `beforeEach(clear)`，也容易引发状态串扰。

**1. 审查与循环 (Review Session) 的全局状态**
- **病灶**：`engine/src/review/session-runtime.ts` 中存在 `let registry: SessionRegistry` 和 `let effects: SessionEffects`。
- **重构动作**：
  - 彻底删除 `session-runtime.ts` 中的全局变量。
  - 将 `activateReview`、`deactivateReview` 等改为纯函数，签名变为：`(state: SessionRegistry, command: ReviewCommand) => [SessionRegistry, ReviewEvent]`。
  - 在 `opencode` 和 `mux` 的入口处（如 `plugin/hooks.ts`）去实例化并持有这个 Registry 引用。

**2. 执行器 (Runner) 的全局状态**
- **病灶**：`engine/src/runner/job-registry.ts` 导出了 `const globalJobRegistry: JobRegistry = new Map()`。
- **重构动作**：
  - 删除 `globalJobRegistry`。
  - 修改 `execute` 和 `wait` 函数的签名，强制由调用方（外壳）传入 `(jobs: JobRegistry, options: ExecuteOptions)`。

**3. 隐式的子 Agent 注册表 (Child Agent Records)**
- **病灶**：`opencode/src/utils/child-agent.ts` 中有一个 `const childAgentRecords = new Map()`。
- **重构动作**：将子会话关系的拓扑树（Tree）作为持久化状态并入全局上下文中，或者利用事件流（Event Sourcing）来推导，禁止在内存中留存这种幽灵字典。

---

### 第三战役：状态机与事件溯源大一统（解决新旧状态混杂）
*目标：解决 Nudge（催促）、Todo、Review Loop 状态多处散落、逻辑重叠的问题。*

当前代码中有 `engine/todo/nudge.ts`、`engine/nudge-shell/index.ts`、`vibe-me-opencode/src/nudge/timing.ts` 等多个处理 Nudge 的地方，概念混杂。

**1. 统一 Nudge State Machine**
- 废除面向对象的 `class NudgeCoordinator` (`engine/todo/index.ts`)，删除内部的 `this.state` 和 `this.suppressed`。
- 将 `NudgeShellState` 升级为唯一的、纯粹的 `SessionLifecycleState`。
- 设计统一的 **事件代数数据类型 (ADT)**（如 `MessageUpdated`、`ToolFailed`、`SessionIdle`）。
- 提供单一的纯 Reducer：`(state: SessionLifecycleState, event: LifecycleEvent) => [SessionLifecycleState, NudgeAction | null]`。

**2. 合并 Loop 与 Review 状态**
- 在 `opencode/src/loop/hook.ts` 中有局部的 `stoppedSessions` 和 `sessionAgents` 状态。这与 Nudge Shell 的状态完全重复。
- **重构动作**：将 Loop 的监听逻辑合并进上述的 `SessionLifecycleState` 中。所有的空闲检测（Idle Check）由单一的纯函数负责判断：“现在该发 Todo Nudge、Loop Nudge 还是 Runner Nudge？”。

---

### 第四战役：Mux与Opencode外壳层极限瘦身（消除样板代码）
*目标：将两个插件仓库降级为“只有 IO 和类型转换”的极薄防腐层。*

目前 `mux/src/tools/` 和 `opencode/src/...` 下面各自实现了长达百行的 `greper.ts`, `editor.ts`, `reverie.ts`。

**1. 抽取通用的工具定义 (Universal Tool Definitions)**
- 在 `engine/tools/` 目录下定义各个工具的核心逻辑和 Schema。
- 设计一个跨平台的 `EngineTool` 接口：
  - `name`, `description`, `schema` (JSON Schema 标准)
  - `execute: (ctx: EngineContext, args: unknown) => Promise<string>`
- **Opencode 改造**：编写一个高阶函数 `createOpencodeTool(engineTool)`，自动将 JSON Schema 转换为 `@opencode-ai/plugin/tool` 的 `zod` 格式，并注入上下文。
- **Mux 改造**：编写 `createMuxTool(engineTool)`，直接对接其自定义的 Contract。
- **结果**：`opencode/src/editor/index.ts` 和 `mux/src/tools/editor.ts` 将从 50 行缩减为 3 行代码。

**2. 抽离通用代理委派 (Subagent Delegation)**
- 两个插件都实现了 `delegateToSubAgent` / `runSubagent`。
- **重构动作**：将创建子会话、发送 Prompt、轮询/等待返回的业务流程抽取到 `engine/subagent/orchestrator.ts`。外壳只需提供 `createSession` 和 `sendMessage` 的接口实现 (Dependency Injection)。

---

### 第五战役：架构边界与依赖倒置执行（按宝典布阵）
*目标：贯彻“依赖则短路，独立则一次收全错”、“模块画界，设海关传所需”。*

**1. 严格分离纯逻辑与 IO**
- `engine/runner/jobs.ts` 中的 `execute` 过于庞大（>130行），混合了状态更新、子进程 Spawn、Stream 写入和 Timeout 竞速。
- **重构动作**：
  - 拆分出纯函数 `prepareRunnerCommand`：解析依赖、剥离 head/tail 管道，返回确定的执行命令和脚本。
  - 拆分出隔离的 IO 函数 `spawnAndStream`，仅负责对接 Node.js `child_process`。
  - 拆分出纯函数 `processRunnerOutput`：负责拦截特殊输出、截断防爆（`truncateTail`）。

**2. 统一环境上下文 (Unified Context)**
- 当前有很多工具函数需要传入 `(client, sessionID, directory, abortSignal)`。
- **重构动作**：定义不可变的 `InvocationContext`，由入口拦截器统一生成并向下传递。禁止在底层函数重新通过可选链 `ctx.sessionID ?? default` 来回猜状态。

**3. 异常处理的显式化（业务失败不伪装异常）**
- 消除通过 `try { ... } catch { return "error string" }` 掩盖执行失败的逻辑。
- 将引擎底层的返回值全面切换为现有的 `Result<T, E>` 类型。外壳层（Mux/Opencode）再负责将 `Err` 模式匹配为工具的输出字符串（例如 `"[System] Task Failed: ..."`）。

---

### 第六战役：代码风格与宝典铁律自查清单（收尾）
在重构时，实施以下“强迫症”级别的代码审计：

1. **消灭所有 `any` 和 `as`**：强制使用 `unknown` 并配合 Type Guard 或 Zod/Schema 校验进行窄化。
2. **函数超长切分**：如果在瘦身外壳和拆分纯核后，仍有函数超过 60 行（如 `vibe-me-engine/src/fuzzy/coordinator.ts` 的 `fuzzyGrep`），强制拆分为：参数解析 -> 环境组装 -> Finder调用 -> 格式化输出。
3. **禁用空值和布尔值组合状态**：排查 `JobRecord`、`SearchState` 中是否存在 `isError?: boolean` 这种设计，强制改用 `Discriminated Unions` (可辨识联合类型)。
4. **统一命名约定**：
   - 彻底消灭 `sessionId` 与 `sessionID` 混用的情况（在引擎层统一定义为 `sessionId`，在 SDK 转换层进行映射）。
   - 彻底消灭文件路径属性 `file_path`, `filePath`, `path` 的混杂，在引擎入口处执行标准化。

执行完上述 6 大战役，该项目将达到**“内核纯粹无瑕、状态可重放、外壳极薄、架构彻底扁平”**的宝典最高境界。你可以根据此方案，分模块下达代码生成指令。
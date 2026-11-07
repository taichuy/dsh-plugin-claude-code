# dsh-plugin-claude-code

在 DeepSeek Harness 的主对话中运行本机 Claude Code，并把 DSH `anthropic-messages` 模型及 1flowbase 已导入模型、已启用 MCP 注入到 Claude Code 会话。

## 安装

要求 DSH Web profile、Node.js 20+ 与本机 Claude Code CLI。使用本地认证的默认实例要求 Claude Code 已可在终端正常调用；使用 DSH 或 1flowbase 模型的实例通过已有 API Key 接入。

```sh
dsh plugin --profile web add dsh-plugin-claude-code
```

重启 DSH Web 后，在设置页打开 **Claude Code**，从已注册的 DSH Messages 或 1flowbase 模型建立实例。新建对话选择 **Claude Code** Agent Preset，再从模型选择器选择实例。默认的“本地 Claude Code”实例使用现有认证与配置。实例可单独启用、停用和删除；本地默认实例始终保留。

## 配置与边界

- DSH 来源只列出 `llm-pi-ai` 中协议为 `anthropic-messages` 且配置了端点、模型与凭据引用的供应商。启动会话时经 DSH 凭据服务重新解析 API Key，不在本插件的实例文件中保存它。
- 1flowbase 来源列出已导入 Agent Flow 应用发布的模型。它们的模型 ID 和应用 API Key 来自现有 `1flowbase-dsh-plugin` 状态；Claude Code 直接调用 1flowbase 的 Messages 兼容端点。
- 每个实例可分别指定主模型与 Opus、Sonnet、Haiku 层级的模型；层级未指定时映射到主模型，避免 Claude Code 的内部任务调用供应商未发布的默认 Claude 模型名。
- 1flowbase 已启用的 MCP 实例在每次 Claude Code 启动时重新读取，并作为 HTTP MCP server 注入。停用或新增后，下一个 Claude Code 会话或恢复的下一个回合生效。
- **启用 Claude Code 配置** 控制是否加载 Claude Code 设置来源。可填写绝对路径的设置文件或配置目录，让实例使用另一套 Claude Code 配置。远程模型实例关闭该开关时，Claude Code 状态隔离在 DSH 插件目录。插件不写入 `~/.claude/settings.json`。
- 实例保存在 `$DSH_HOME/dsh-plugin-claude-code/instances.json`，会话关联保存在同目录的 `sessions/`。它们仅影响 DSH 的 Claude Code preset；不会修改用户默认 Claude Code 模型或配置。
- Claude Code 仍拥有内部工具循环；需授权的工具调用交由 DSH 审批服务。对话文本在 Claude Code 完成一个回合后显示。

## 从源码验证

```sh
npm install
npm run check
dsh plugin --profile web add "link:$(pwd)"
```

本插件使用 DSH 的公开插件接口，不改动 DSH 源码。

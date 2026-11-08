# dsh-plugin-claude-code

在 DeepSeek Harness 的主对话中运行本机 Claude Code。插件借鉴 CC Switch 的供应商列表与配置编辑方式，但只使用 DSH 中已经注册的供应商和凭据。

## 可用来源

- **本地 Claude Code**：默认配置，沿用本机已登录的 Claude Code。
- **DSH Messages**：只显示 DSH `llm-pi-ai` 中使用 `anthropic-messages` 协议的供应商；模型从该供应商的已注册目录选择，API Key 在启动对话时由 DSH 凭据服务解析。
- **1flowbase**：显示 `1flowbase-dsh-plugin` 已导入的应用供应商与其模型。其模型经过 1flowbase 的 Messages 转换，可直接供 Claude Code 使用；已经启用的 1flowbase MCP 实例也会在下一回合启动时注入。

一个供应商可以保存多份 Claude 配置。每份配置可单独命名、启用、停用、编辑和删除；已启用的配置作为 Claude Code preset 下的模型选项供对话选择。可分别指定主模型以及 Opus、Sonnet、Haiku 默认模型；未单独指定的层级跟随主模型。

## 配置文件

设置页提供实例专属的 JSON 编辑器。保存后写入 `$DSH_HOME/dsh-plugin-claude-code/configs/<实例 ID>.json`，权限为 `0600`。列表和文件只用于 DSH，不修改 `~/.claude/settings.json`、DSH 已有模型供应商或 1flowbase 的状态。

远程模型实例启动时，插件从该文件构造临时 Claude 设置层：保留其他设置，把模型、Messages 地址及模型层级锁定为所选供应商；供应商 API Key 只在启动时进入进程环境，不写入编辑文件。临时层在回合结束后删除。远程实例不加载项目级 Claude 设置和 `CLAUDE.md`；本地实例仍使用 Claude Code 原有设置层级。旧版实例填写的外部设置文件路径只作兼容读取，保存新的 JSON 后改用 DSH 私有文件。

## 安装与使用

要求 DSH Web profile、Node.js 20+ 和本机 Claude Code CLI。目前 npm 发布待完成，可先从源码安装：

```sh
git clone https://github.com/taichuy/dsh-plugin-claude-code.git
cd dsh-plugin-claude-code
npm install --legacy-peer-deps
npm run check
dsh plugin --profile web add "link:$(pwd)"
```

安装后重启 DSH Web，在 **设置 → Claude Code** 中添加配置：先选供应商，再选择该供应商的模型并编辑 JSON。新建对话选择 **Claude Code** Agent Preset，然后在模型列表选择已启用的配置。

DSH 当前没有 Messages 供应商时，设置页会显示提示；在 DSH「模型」中先配置一个 `anthropic-messages` 供应商，或直接选用已导入的 1flowbase 应用。发布到 npm 后可用 `dsh plugin --profile web add dsh-plugin-claude-code` 安装。

## 验证

```sh
npm run check
npm pack
```

插件使用 DSH 公共接口，不修改 DSH 或 Claude Code 源码。

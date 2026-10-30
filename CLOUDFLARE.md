# 免费联机后端

在 Cloudflare Workers Free 套餐上部署，使用 SQLite-backed Durable Objects。不需要购买服务器和域名。本项目不会开通付费套餐；超过平台免费限额时可能无法使用，勿自行升级套餐。

## 从 GitHub 导入

Cloudflare 控制台 → Workers & Pages → Create application → 导入 GitHub 仓库 Yejidog/word_meet。选择 Workers，不选纯静态 Pages。

- 项目/Worker 名称：word-meet-api（与 wrangler.jsonc 一致）。
- 分支：main；根目录：仓库根目录。
- 构建命令：留空；部署命令：npx wrangler deploy。
- 安装依赖使用 npm install。
- 选择 Free；不需要购买域名或提供付款信息。

部署会按 wrangler.jsonc 创建 ROOMS 绑定和 Room 的 SQLite 迁移。如果页面要求手动建立绑定或开通付费，先检查导入的是 Workers、配置文件在根目录且使用 new_sqlite_classes。

成功后复制分配的 https://word-meet-api.<账户子域>.workers.dev 地址。访问 /api/health 应返回 {"ok":true,"service":"word-meet","version":1}。

## 接到网页

执行 node build-online.mjs https://实际后端地址 ，将生成的 online.html 上传 GitHub Pages。完成后访问 https://yejidog.github.io/word_meet/online.html ，一人创建房间并将邀请链接发给另一人。原首页同屏试玩不受影响。

首次从 Cloudflare 部署成功后，还需双方在国内实际网络测试 workers.dev 可达性。网页可打开不代表后端可达；无法连接时应更换后端方案，不能声称已经实现稳定联机。

## 实现与验证限制

- 每房间一个 Durable Object，串行处理提交，SQLite-backed storage 保存答案与身份哈希。
- GitHub 来源白名单 https://yejidog.github.io；浏览器跨域请求支持 Authorization 和 X-Room-ID。
- 每3秒同步，网络异常自动退避；同一浏览器保留座位和草稿。刷新、网络恢复自动继续。
- 房间连续7天未活动后清理；每30秒保存在线心跳，写词与准备立即持久化。单局最多100轮。
- 分享链接是入房凭据，只发给预期朋友；第二个座位被占用后无法加入。清理浏览器数据将丢失身份。
- npm test 中的 Cloudflare 测试使用 Web API 与模拟 Durable Object 存储，覆盖协议与游戏逻辑；Cloudflare 实际运行时及迁移仍需线上部署验证。
- 免费额度由账号共享，公开入口仍可能被滥用导致限额。本版本限制每座位请求频率，但没有账号登录和全局防刷服务。

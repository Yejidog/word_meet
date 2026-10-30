# Netlify 免费网络验证版

网页与联机接口均从 Netlify 访问，Netlify Function 将受限的游戏 API 请求转发到现有 Cloudflare Worker，房间状态仍由 Cloudflare Durable Objects 保存。本版本不使用临时函数内存存房间，也不宣称已将数据库迁至 Netlify。

## 部署

1. 登录 https://app.netlify.com/ ，选择 Free 免费套餐。
2. Add new project / Add new site → Import an existing project → GitHub。
3. 授权只访问 Yejidog/word_meet 并选择该仓库。
4. 分支 main；Base directory 留空（仓库根目录）。
5. Build command：node build-netlify.mjs；Publish directory：netlify-site；Functions directory：netlify/functions。根目录 netlify.toml 已提供这些配置。
6. 发布。无需添加域名、数据库或付款信息，也无需复制 Cloudflare 密钥。
7. 将分配的 https://项目名.netlify.app 地址交给助手验证。

## 验证

先关闭 VPN 打开 /api/health ，应返回包含 ok:true、service:word-meet 的 JSON。随后两人使用 Netlify 网站，各自创建/加入房间、提交不同词、共同进入下一轮、提交相同词、刷新恢复。

国内可达性必须用双方真实网络测试。若 Netlify 无法访问，或其 Function 无法连接 Cloudflare，不能视为解决国内无 VPN 联机。

原 GitHub Pages 入口目前仍直接访问 Cloudflare；测试时请使用新 Netlify 地址。测试成功后再更新 GitHub 入口。

## 免费额度与边界

Netlify Free 按月提供共享 credits，有调用、带宽、部署等消耗；达到限额可能暂停项目。保持 Free，不开通自动付费。页面默认每4秒轮询，离开页面后降低频率。Cloudflare 的免费额度仍适用。

函数只允许固定后端和 health/create/join/state/word/next 接口，不接受任意转发地址，不记录凭据。测试覆盖转发协议与错误处理；真实 Netlify 路由、冷启动和网络仍需部署后验证。

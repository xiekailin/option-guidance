@AGENTS.md

# BTC 期权收租指导工具

实时 BTC 期权策略推荐网页，支持 Covered Call、Cash-Secured Put、Synthetic Long 三种策略。

## 技术栈

- Next.js 16 App Router + **静态导出**（`output: 'export'`），部署在 GitHub Pages
- React 19、TypeScript、Tailwind CSS v4、SWR、lucide-react
- 数据来源：Deribit 公开 API（**客户端直接调用**，无服务端代理）
- GitHub: https://github.com/xiekailin/option-guidance
- 线上地址: https://xiekailin.github.io/option-guidance/

## 构建与部署

- `npm run dev -- --webpack` — 必须用 webpack，Turbopack 在中文路径下会崩溃
- `npm run build` — 静态导出到 `out/` 目录
- `npm test` — Node.js 内置测试运行器（tsx）
- `npm run lint` — ESLint
- 推送到 main 分支自动触发 GitHub Actions 部署到 gh-pages

## 项目架构

```
app/
  layout.tsx          — 根布局，Google Fonts
  page.tsx            — 入口，渲染 OptionsDashboard
components/
  strategy/           — 策略输入表单（三策略切换）
  dashboard/          — 主面板（摘要卡、首选建议、推荐列表、算法说明）
  recommendation/     — 推荐表格、详情抽屉
lib/
  types/option.ts     — 全部类型定义
  domain/
    calculations.ts   — 数学工具、校验、评分辅助
    recommendation.ts — Covered Call / CSP 推荐（过滤 + 加权评分）
    synthetic-long.ts — 买 call + 卖 put 合成现货策略
  market/
    deribit.ts        — Deribit API 客户端（fetch、解析、Delta 估算）
    deribit-client.ts — 包装为 SWR 可用的 fetcher
```

## 核心设计决策

1. **规则过滤 + 加权评分**，不是黑箱 AI。所有维度和权重在算法说明区透明展示。
2. **Synthetic Long 独立建模**，不与收租策略混写。风险结构完全不同（强看涨 vs 稳定收租）。
3. **`basePath: '/option-guidance'`** — GitHub Pages 部署必须。迁移到其他平台时需同步修改 `next.config.ts`。
4. **CSP 已配置** `connect-src https://www.deribit.com`，允许浏览器直接调 Deribit API。
5. **UI 主题**：标准策略用 cyan，合成策略用 fuchsia，风险用 amber/rose。

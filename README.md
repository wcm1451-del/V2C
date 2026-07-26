# 員工差旅辦法問答 · Daxin Travel Policy RAG Demo

Next.js 14 + Gemini API 打造的 RAG 問答 chatbot，讓員工用自然語言查詢《大新科技員工差旅管理辦法 2026 年版》。

## 特色

- **PDF 直接餵給 Gemini**：不做 embedding、不做 vector search，PDF 每次以 `inline_data` 塞給 Gemini。適合單一小型文件（本案例 4 頁）。
- **結構化輸出**：Gemini 用新版 `responseFormat` 強制回 JSON（`answer` + `sources` + `isOutOfScope`），前端可靠地渲染。
- **超出範圍偵測**：問題若不在辦法規範內，明確標示，避免 model 瞎編。
- **獨立問答**：每次提問不帶歷史，避免上下文污染，簡單可靠。
- **極簡黑白 UI**：Inter + JetBrains Mono，克制、專業。
- **PDF 原檔可下載**：員工可點連結拿到原始 PDF 對照。

## 目錄結構

```
daxin-rag/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              ← 前端 chat UI
│   ├── globals.css
│   └── api/chat/route.ts     ← Gemini API 呼叫
├── public/docs/
│   └── travel-policy.pdf     ← 員工差旅管理辦法 2026 年版
├── next.config.mjs
├── package.json
└── .env.local.example
```

## 本地啟動

```bash
# 1. 安裝依賴
npm install

# 2. 設定 API Key
cp .env.local.example .env.local
# 打開 .env.local 填入 GEMINI_API_KEY（從 Google AI Studio 拿）
# GEMINI_MODEL 預設使用 gemini-3.5-flash-lite

# 3. 啟動
npm run dev
# → http://localhost:3000
```

## Deploy 到 Vercel

1. 把整個資料夾推上 GitHub。
2. 到 Vercel → **New Project** → Import 這個 repo。
3. **Environment Variables** 加：
   - `GEMINI_API_KEY` = 你的 Gemini API Key
   - `GEMINI_MODEL` = `gemini-3.5-flash-lite`
4. Deploy。

`next.config.mjs` 已經設定 `outputFileTracingIncludes`，PDF 會被打包進 serverless function，不需要額外處理。

## Model 切換

模型由環境變數 `GEMINI_MODEL` 控制；未設定時會自動使用：

```ts
gemini-3.5-flash-lite
```

- `gemini-3.5-flash-lite`：預設推薦，適合文件解析、結構化 JSON、低延遲與低成本。
- `gemini-3.6-flash`：品質優先，適合更複雜的文件與推理。

例如要切換到高品質模型，在 `.env.local` 或 Vercel Environment Variables 設定：

```dotenv
GEMINI_MODEL=gemini-3.6-flash
```

修改環境變數後需重新啟動本地開發伺服器或重新 Deploy。

## 替換 / 更新 PDF

把新的 PDF 蓋掉 `public/docs/travel-policy.pdf`，重新 deploy 即可。檔名保持不變就不用改程式。

## Prompt 邏輯

`app/api/chat/route.ts` 的 `SYSTEM_INSTRUCTION` 定義了：
- 只根據 PDF 回答，禁止外部知識
- 必須標出處（例如「第二條 · 住宿費」）
- 超出範圍要標 `isOutOfScope`
- 打招呼 / 閒聊也視為 out of scope

要調整答題風格就改這一段。

## 限制與已知事項

- **這是 demo**：沒做 rate limit、沒做登入驗證、沒做 log。要正式上線給全員用，請補上這三塊，並考慮加 Redis / KV 做請求記數。
- **成本**：每次呼叫都送 4 頁 PDF（約 150KB base64 → 200KB）。Demo 規模可接受，如果流量大要改用 Gemini Files API 或 context caching。
- **無多輪對話**：使用者若要「延續前一題」需要重新在問題裡描述前題脈絡。

## 授權

Internal demo only.

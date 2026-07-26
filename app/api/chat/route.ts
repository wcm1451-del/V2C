import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

// Node runtime（需要 fs），非 edge
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================
// 設定
// ============================================================

// 預設使用適合文件解析與結構化輸出的低成本 GA 模型。
// 若需要更高品質，可在環境變數設定 GEMINI_MODEL=gemini-3.6-flash。
const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';

const PDF_RELATIVE_PATH = 'public/docs/travel-policy.pdf';

const SYSTEM_INSTRUCTION = `你是「大新科技員工差旅管理辦法」的問答助手。

嚴格規則：
1. 只根據附加的 PDF 內容回答，不要引用外部知識或常識補充。
2. 每則回答務必在 sources 陣列裡標示出處，格式如「第二條 · 住宿費」「第四條 · 報帳期限」。
3. 若 PDF 沒有明確規定該問題的答案，回答「本辦法未規定，建議洽行政部門確認」，並將 isOutOfScope 設為 true，sources 留空陣列。
4. 語氣專業、簡潔、務實。用繁體中文。不要瞎編條文。不要用 markdown 標題。
5. 若使用者問的是打招呼、閒聊、或明顯與差旅辦法無關的內容，isOutOfScope 設 true，禮貌說明本助手只回答差旅辦法相關問題。

輸出必須為 JSON，欄位：answer (string) / sources (string[]) / isOutOfScope (boolean)。`;

// ============================================================
// PDF 讀檔（cache 起來避免每 request 重讀）
// ============================================================

let cachedPdfBase64: string | null = null;

function getPdfBase64(): string {
  if (cachedPdfBase64) return cachedPdfBase64;
  const pdfPath = path.join(process.cwd(), PDF_RELATIVE_PATH);
  const buffer = fs.readFileSync(pdfPath);
  cachedPdfBase64 = buffer.toString('base64');
  return cachedPdfBase64;
}

// ============================================================
// Gemini API
// ============================================================

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string; code?: number };
};

async function callGemini(question: string, pdfBase64: string, apiKey: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const body = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          { text: `員工問題：${question}` },
        ],
      },
    ],
    generationConfig: {
      responseFormat: {
        text: {
          mimeType: 'application/json',
          schema: {
            type: 'object',
            properties: {
              answer: { type: 'string' },
              sources: {
                type: 'array',
                items: { type: 'string' },
              },
              isOutOfScope: { type: 'boolean' },
            },
            required: ['answer', 'sources', 'isOutOfScope'],
          },
        },
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as GeminiResponse;

  if (!res.ok || data.error) {
    const msg = data.error?.message ?? `Gemini API HTTP ${res.status}`;
    throw new Error(msg);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 回傳空內容');

  return JSON.parse(text) as {
    answer: string;
    sources: string[];
    isOutOfScope: boolean;
  };
}

// ============================================================
// Route Handler
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY 未設定，請在 Vercel Environment Variables 或 .env.local 設定' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const question: unknown = body?.question;

    if (typeof question !== 'string' || !question.trim()) {
      return NextResponse.json(
        { error: '請提供 question 欄位（string）' },
        { status: 400 }
      );
    }

    if (question.length > 500) {
      return NextResponse.json(
        { error: '問題長度上限 500 字' },
        { status: 400 }
      );
    }

    const pdfBase64 = getPdfBase64();
    const result = await callGemini(question, pdfBase64, apiKey);

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '未知錯誤';
    console.error('[chat] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

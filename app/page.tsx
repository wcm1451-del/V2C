'use client';

import { useState, useRef, useEffect } from 'react';

type Message =
  | { role: 'user'; content: string }
  | {
      role: 'assistant';
      content: string;
      sources: string[];
      isOutOfScope: boolean;
    }
  | { role: 'assistant-loading' }
  | { role: 'error'; content: string };

const SAMPLE_QUESTIONS = [
  '一般員工國內出差住宿費上限是多少？',
  '高鐵商務車廂可以報帳嗎？',
  '出差後多少工作日內要完成報帳？',
  '搭計程車需要提供什麼？',
  '因為颱風多住一晚可以申請嗎？',
];

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setLoading(true);
    setInput('');

    // 獨立問答：每次只送當前這題，不傳歷史
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: question },
      { role: 'assistant-loading' },
    ]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const data = await res.json();

      setMessages((prev) => {
        const next = prev.slice(0, -1); // 移除 loading
        return [
          ...next,
          {
            role: 'assistant',
            content: data.answer ?? '（無回應）',
            sources: Array.isArray(data.sources) ? data.sources : [],
            isOutOfScope: Boolean(data.isOutOfScope),
          },
        ];
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知錯誤';
      setMessages((prev) => {
        const next = prev.slice(0, -1);
        return [...next, { role: 'error', content: msg }];
      });
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div className="eyebrow">Daxin Technology · Policy QA</div>
        <h1 className="title">員工差旅辦法問答</h1>
        <p className="subtitle">
          根據《員工差旅管理辦法 2026 年版》回答提問。答案僅供參考，正式依據以原辦法為準。
        </p>
        <a
          className="doc-link"
          href="/docs/travel-policy.pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          下載原始 PDF <span className="arrow">↗</span>
        </a>
      </header>

      {messages.length === 0 && (
        <section className="quick-ask" aria-label="範例問題">
          <div className="section-label">試試看</div>
          <div className="quick-list">
            {SAMPLE_QUESTIONS.map((q, i) => (
              <button
                key={q}
                type="button"
                className="quick-item"
                onClick={() => ask(q)}
                disabled={loading}
              >
                <span className="quick-num">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{q}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="chat" aria-live="polite">
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} className="msg msg-user">
                <div className="msg-role">你</div>
                <div className="msg-body">{m.content}</div>
              </div>
            );
          }
          if (m.role === 'assistant-loading') {
            return (
              <div key={i} className="msg msg-assistant">
                <div className="msg-role">回答</div>
                <div className="loading-dots" aria-label="思考中">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            );
          }
          if (m.role === 'error') {
            return (
              <div key={i} className="msg">
                <div className="msg-role">系統</div>
                <div className="error">呼叫失敗：{m.content}</div>
              </div>
            );
          }
          // assistant
          return (
            <div key={i} className="msg msg-assistant">
              <div className="msg-role">回答</div>
              <div className="msg-body">{m.content}</div>
              {m.isOutOfScope && (
                <div className="msg-oos">SCOPE · 本辦法未明確規定此事項</div>
              )}
              {m.sources.length > 0 && (
                <div className="sources">
                  {m.sources.map((s, j) => (
                    <span key={j} className="source-chip">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </section>

      <form className="composer" onSubmit={onSubmit}>
        <div className="composer-inner">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="輸入你的問題…（Enter 送出，Shift+Enter 換行）"
            disabled={loading}
            rows={1}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            送出
          </button>
        </div>
        <div className="footer-note">
          Independent Q&amp;A · 不記錄歷史 · Powered by Gemini
        </div>
      </form>
    </div>
  );
}

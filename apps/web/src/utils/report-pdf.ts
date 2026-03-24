import type { ConversationReportPayload } from '../types/api';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const renderList = (items: string[]) =>
  items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

const renderHighlights = (items: string[]) =>
  items.length
    ? `<div class="pills">${items.map((i) => `<span class="pill">${escapeHtml(i)}</span>`).join('')}</div>`
    : '';

const isZh = (report: ConversationReportPayload) => report.reportLanguage === 'zh';

const label = (report: ConversationReportPayload, zh: string, en: string) =>
  isZh(report) ? zh : en;

export const downloadConversationReportPdf = (
  report: ConversationReportPayload,
) => {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=960,height=900');
  if (!popup) {
    return;
  }

  const l = (zh: string, en: string) => label(report, zh, en);

  popup.document.write(`<!doctype html>
<html lang="${isZh(report) ? 'zh-CN' : 'en'}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.report.headline)}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif;
        background: #f5f5f7;
        color: #1d1d1f;
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
      }
      .page { max-width: 720px; margin: 0 auto; padding: 32px 20px 48px; }
      .card {
        background: #fff;
        border: 1px solid rgba(0,0,0,0.06);
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 12px;
      }
      .eyebrow {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #86868b;
        margin-bottom: 8px;
      }
      h1 { font-size: 24px; font-weight: 700; line-height: 1.25; margin-bottom: 8px; }
      h2 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
      p, li { font-size: 13px; line-height: 1.7; color: #424245; }
      ul { padding-left: 16px; margin: 0; }
      ul li { margin-bottom: 4px; }
      .summary { font-size: 14px; color: #424245; margin-bottom: 16px; }
      .metrics { display: grid; gap: 8px; grid-template-columns: repeat(4, 1fr); margin-top: 16px; }
      .metric {
        border: 1px solid rgba(0,0,0,0.06);
        border-radius: 12px;
        padding: 12px;
        text-align: center;
      }
      .metric-label { font-size: 10px; font-weight: 600; color: #86868b; text-transform: uppercase; letter-spacing: 0.08em; }
      .metric-value { margin-top: 4px; font-size: 20px; font-weight: 700; color: #1d1d1f; }
      .grid { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); }
      .snapshot { background: #f5f5f7; border-radius: 12px; padding: 14px; margin-bottom: 16px; font-size: 13px; color: #424245; }
      .pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .pill {
        display: inline-block;
        padding: 3px 10px;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 20px;
        font-size: 11px;
        color: #424245;
        background: #fafafa;
      }
      .moment { border-left: 3px solid #007AFF; padding: 8px 12px; margin-bottom: 8px; background: #f8f9fb; border-radius: 0 10px 10px 0; }
      .moment-speaker { font-size: 10px; font-weight: 600; color: #86868b; text-transform: uppercase; letter-spacing: 0.06em; }
      .moment-quote { font-size: 13px; color: #1d1d1f; margin: 4px 0; }
      .moment-note { font-size: 12px; color: #86868b; }
      .checkpoint { background: rgba(0,122,255,0.06); border: 1px solid rgba(0,122,255,0.15); border-radius: 10px; padding: 10px 14px; margin-top: 10px; font-size: 12px; color: #007AFF; }
      .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #86868b; }
      @media (max-width: 600px) {
        .page { padding: 16px 12px 32px; }
        .metrics { grid-template-columns: repeat(2, 1fr); }
        .grid { grid-template-columns: 1fr; }
        h1 { font-size: 20px; }
        .card { padding: 16px; }
      }
      @media print {
        body { background: white; }
        .page { padding: 12px; max-width: none; }
        .card { box-shadow: none; break-inside: avoid; border-color: #e5e5e5; }
        .moment { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="card">
        <div class="eyebrow">${l('沉浸式复盘', 'Immersive Review')}</div>
        <h1>${escapeHtml(report.report.headline)}</h1>
        <p class="summary">${escapeHtml(report.report.overallSummary)}</p>
        <div class="metrics">
          <div class="metric"><div class="metric-label">${l('平均分', 'Average')}</div><div class="metric-value">${report.metrics.averageScore ?? '--'}</div></div>
          <div class="metric"><div class="metric-label">${l('时长', 'Duration')}</div><div class="metric-value">${report.metrics.durationMinutes}<span style="font-size:12px;font-weight:400;color:#86868b"> ${l('分钟', 'min')}</span></div></div>
          <div class="metric"><div class="metric-label">${l('轮次', 'Turns')}</div><div class="metric-value">${report.metrics.userTurns}/${report.metrics.aiTurns}</div></div>
          <div class="metric"><div class="metric-label">${l('实时', 'Realtime')}</div><div class="metric-value">${report.metrics.realtimeTurns}</div></div>
        </div>
      </section>

      <div class="snapshot">${escapeHtml(report.report.learnerSnapshot)}</div>

      <section class="grid">
        <section class="card">
          <div class="eyebrow">${l('优势', 'Strengths')}</div>
          <ul>${renderList(report.report.strengths)}</ul>
        </section>
        <section class="card">
          <div class="eyebrow">${l('改进', 'Improvements')}</div>
          <ul>${renderList(report.report.opportunities)}</ul>
        </section>
      </section>

      <section class="grid">
        <section class="card">
          <div class="eyebrow">${l('发音', 'Pronunciation')}</div>
          <p>${escapeHtml(report.report.pronunciation.summary)}</p>
          ${renderHighlights(report.report.pronunciation.highlights)}
        </section>
        <section class="card">
          <div class="eyebrow">${l('用词', 'Vocabulary')}</div>
          <p>${escapeHtml(report.report.vocabulary.summary)}</p>
          ${renderHighlights(report.report.vocabulary.highlights)}
        </section>
        <section class="card">
          <div class="eyebrow">${l('语法', 'Grammar')}</div>
          <p>${escapeHtml(report.report.grammar.summary)}</p>
        </section>
        <section class="card">
          <div class="eyebrow">${l('节奏', 'Rhythm')}</div>
          <p>${escapeHtml(report.report.rhythm.summary)}</p>
        </section>
      </section>

      <section class="card">
        <div class="eyebrow">${l('下轮计划', 'Next Session')}</div>
        <p>${escapeHtml(report.report.nextSessionPlan.focus)}</p>
        <ul style="margin-top:8px">${renderList(report.report.nextSessionPlan.drills)}</ul>
        <div class="checkpoint">${escapeHtml(report.report.nextSessionPlan.checkpoint)}</div>
      </section>

      ${report.report.keyMoments.length > 0 ? `
      <section class="card">
        <div class="eyebrow">${l('关键片段', 'Key Moments')}</div>
        ${report.report.keyMoments.map((m) => `
          <div class="moment">
            <div class="moment-speaker">${m.speaker === 'user' ? l('学员', 'Learner') : l('导师', 'Tutor')}</div>
            <div class="moment-quote">"${escapeHtml(m.quote)}"</div>
            <div class="moment-note">${escapeHtml(m.note)}</div>
          </div>
        `).join('')}
      </section>
      ` : ''}

      <div class="footer">LuvTALK · AI Language Tutor</div>
    </main>
  </body>
</html>`);
  popup.document.close();
  popup.focus();
  popup.print();
};

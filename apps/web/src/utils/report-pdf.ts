import type { ConversationReportPayload } from '../types/api';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const renderList = (items: string[], className = 'pdf-list') =>
  items.map((item) => `<li class="${className}__item">${escapeHtml(item)}</li>`).join('');

const renderHighlights = (items: string[]) =>
  items.length
    ? `<div class="pdf-pills">${items.map((item) => `<span class="pdf-pill">${escapeHtml(item)}</span>`).join('')}</div>`
    : '';

const isZh = (report: ConversationReportPayload) => report.reportLanguage === 'zh';

const label = (report: ConversationReportPayload, zh: string, en: string) =>
  isZh(report) ? zh : en;

const formatTimestamp = (report: ConversationReportPayload) => {
  const date = new Date(report.updatedAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(isZh(report) ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const buildReportMarkup = (report: ConversationReportPayload) => {
  const l = (zh: string, en: string) => label(report, zh, en);
  const updatedAt = formatTimestamp(report);

  return `
    <style>
      .report-pdf-shell, .report-pdf-shell * { box-sizing: border-box; }
      .report-pdf-shell {
        width: 794px;
        padding: 18px;
        background:
          radial-gradient(circle at top left, rgba(22, 120, 255, 0.12), transparent 24%),
          linear-gradient(180deg, #f4f7fb 0%, #eef3f9 100%);
        color: #16202f;
        font-family: "SF Pro Text", "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
      }
      .report-pdf-page {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .pdf-card {
        border: 1px solid rgba(67, 97, 138, 0.08);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.96);
        padding: 14px 16px;
        box-shadow: 0 8px 20px rgba(54, 81, 118, 0.06);
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .pdf-hero {
        padding: 16px 18px;
        background:
          linear-gradient(135deg, rgba(255,255,255,0.98), rgba(243,248,255,0.94)),
          linear-gradient(180deg, rgba(22,120,255,0.06), transparent);
      }
      .pdf-kicker {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #6b7b93;
      }
      .pdf-title {
        margin: 6px 0 0;
        font-size: 24px;
        line-height: 1.18;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #101826;
      }
      .pdf-summary {
        margin: 8px 0 0;
        font-size: 13px;
        line-height: 1.6;
        color: #445166;
      }
      .pdf-meta {
        margin-top: 10px;
        display: inline-flex;
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(22, 120, 255, 0.08);
        color: #2457c5;
        font-size: 10px;
        font-weight: 600;
      }
      .pdf-metrics {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .pdf-metric {
        border-radius: 16px;
        padding: 11px 10px;
        background: linear-gradient(180deg, rgba(247, 250, 255, 0.98), rgba(241, 246, 252, 0.95));
        border: 1px solid rgba(67, 97, 138, 0.08);
      }
      .pdf-metric__label {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #7a8698;
      }
      .pdf-metric__value {
        margin-top: 5px;
        font-size: 18px;
        line-height: 1.1;
        font-weight: 700;
        color: #101826;
      }
      .pdf-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .pdf-section-title {
        margin: 0 0 7px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #7a8698;
      }
      .pdf-body {
        font-size: 12px;
        line-height: 1.58;
        color: #445166;
      }
      .pdf-list {
        margin: 0;
        padding-left: 16px;
      }
      .pdf-list__item {
        margin-bottom: 4px;
        font-size: 12px;
        line-height: 1.55;
        color: #445166;
      }
      .pdf-pills {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .pdf-pill {
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 999px;
        background: #f3f6fb;
        border: 1px solid rgba(67, 97, 138, 0.08);
        font-size: 10px;
        color: #546176;
      }
      .pdf-snapshot {
        padding: 12px 14px;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(250,252,255,0.98), rgba(242,247,252,0.95));
        border: 1px solid rgba(67, 97, 138, 0.08);
      }
      .pdf-tone-good {
        background: linear-gradient(180deg, rgba(236, 248, 242, 0.98), rgba(248, 252, 249, 0.94));
        border-color: rgba(52, 199, 89, 0.14);
      }
      .pdf-tone-warn {
        background: linear-gradient(180deg, rgba(255, 249, 238, 0.98), rgba(255, 252, 245, 0.94));
        border-color: rgba(255, 149, 0, 0.16);
      }
      .pdf-plan-note {
        margin-top: 8px;
        padding: 9px 11px;
        border-radius: 14px;
        background: rgba(22, 120, 255, 0.08);
        border: 1px solid rgba(22, 120, 255, 0.12);
        font-size: 11px;
        line-height: 1.55;
        color: #2457c5;
      }
      .pdf-moment {
        padding: 10px 11px;
        border-radius: 14px;
        background: #f7f9fc;
        border: 1px solid rgba(67, 97, 138, 0.08);
      }
      .pdf-moment + .pdf-moment {
        margin-top: 8px;
      }
      .pdf-moment__speaker {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #7a8698;
      }
      .pdf-moment__quote {
        margin: 5px 0 0;
        font-size: 12px;
        line-height: 1.55;
        color: #101826;
      }
      .pdf-moment__note {
        margin: 4px 0 0;
        font-size: 11px;
        line-height: 1.5;
        color: #5a667a;
      }
      .pdf-footer {
        text-align: center;
        font-size: 10px;
        color: #7a8698;
        margin-top: 0;
      }
    </style>
    <div class="report-pdf-shell">
      <main class="report-pdf-page">
        <section class="pdf-card pdf-hero">
          <div class="pdf-kicker">${l('沉浸式复盘', 'Immersive Review')}</div>
          <h1 class="pdf-title">${escapeHtml(report.report.headline)}</h1>
          <p class="pdf-summary">${escapeHtml(report.report.overallSummary)}</p>
          ${updatedAt ? `<div class="pdf-meta">${escapeHtml(updatedAt)}</div>` : ''}
        </section>

        <section class="pdf-metrics">
          <div class="pdf-metric">
            <div class="pdf-metric__label">${l('平均分', 'Average')}</div>
            <div class="pdf-metric__value">${report.metrics.averageScore ?? '--'}</div>
          </div>
          <div class="pdf-metric">
            <div class="pdf-metric__label">${l('轮次', 'Turns')}</div>
            <div class="pdf-metric__value">${report.metrics.userTurns}/${report.metrics.aiTurns}</div>
          </div>
          <div class="pdf-metric">
            <div class="pdf-metric__label">${l('时长', 'Duration')}</div>
            <div class="pdf-metric__value">${report.metrics.durationMinutes}${isZh(report) ? ' 分' : ' min'}</div>
          </div>
          <div class="pdf-metric">
            <div class="pdf-metric__label">${l('实时', 'Realtime')}</div>
            <div class="pdf-metric__value">${report.metrics.realtimeTurns}</div>
          </div>
        </section>

        <section class="pdf-card pdf-snapshot">
          <div class="pdf-section-title">${l('学习者快照', 'Learner Snapshot')}</div>
          <div class="pdf-body">${escapeHtml(report.report.learnerSnapshot)}</div>
        </section>

        <section class="pdf-grid">
          <section class="pdf-card pdf-tone-good">
            <div class="pdf-section-title">${l('当前优势', 'Current Strengths')}</div>
            <ul class="pdf-list">${renderList(report.report.strengths)}</ul>
          </section>
          <section class="pdf-card pdf-tone-warn">
            <div class="pdf-section-title">${l('优先改进', 'Priority Improvements')}</div>
            <ul class="pdf-list">${renderList(report.report.opportunities)}</ul>
          </section>
        </section>

        <section class="pdf-grid">
          <section class="pdf-card">
            <div class="pdf-section-title">${l('发音观察', 'Pronunciation')}</div>
            <div class="pdf-body">${escapeHtml(report.report.pronunciation.summary)}</div>
            ${renderHighlights(report.report.pronunciation.highlights)}
          </section>
          <section class="pdf-card">
            <div class="pdf-section-title">${l('用词与表达', 'Vocabulary & Usage')}</div>
            <div class="pdf-body">${escapeHtml(report.report.vocabulary.summary)}</div>
            ${renderHighlights(report.report.vocabulary.highlights)}
          </section>
          <section class="pdf-card">
            <div class="pdf-section-title">${l('语法组织', 'Grammar Structure')}</div>
            <div class="pdf-body">${escapeHtml(report.report.grammar.summary)}</div>
            ${renderHighlights(report.report.grammar.highlights)}
          </section>
          <section class="pdf-card">
            <div class="pdf-section-title">${l('节奏与停顿', 'Rhythm & Pausing')}</div>
            <div class="pdf-body">${escapeHtml(report.report.rhythm.summary)}</div>
            ${renderHighlights(report.report.rhythm.highlights)}
          </section>
        </section>

        <section class="pdf-card">
          <div class="pdf-section-title">${l('下一轮训练计划', 'Next Session Plan')}</div>
          <div class="pdf-body">${escapeHtml(report.report.nextSessionPlan.focus)}</div>
          ${report.report.nextSessionPlan.drills.length > 0 ? `<ul class="pdf-list" style="margin-top:8px">${renderList(report.report.nextSessionPlan.drills)}</ul>` : ''}
          <div class="pdf-plan-note">${escapeHtml(report.report.nextSessionPlan.checkpoint)}</div>
        </section>

        ${report.report.keyMoments.length > 0 ? `
          <section class="pdf-card">
            <div class="pdf-section-title">${l('关键片段', 'Key Moments')}</div>
            ${report.report.keyMoments.map((moment) => `
              <div class="pdf-moment">
                <div class="pdf-moment__speaker">${moment.speaker === 'user' ? l('学员', 'Learner') : l('导师', 'Tutor')}</div>
                <p class="pdf-moment__quote">${escapeHtml(moment.quote)}</p>
                <p class="pdf-moment__note">${escapeHtml(moment.note)}</p>
              </div>
            `).join('')}
          </section>
        ` : ''}

        <div class="pdf-footer">LuvTALK · AI Language Tutor</div>
      </main>
    </div>
  `;
};

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 64);

const createExportContainer = (report: ConversationReportPayload) => {
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.position = 'fixed';
  container.style.left = '-100000px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.pointerEvents = 'none';
  container.style.opacity = '0';
  container.innerHTML = buildReportMarkup(report);
  document.body.appendChild(container);
  return container;
};

export const downloadConversationReportPdf = async (
  report: ConversationReportPayload,
) => {
  const { default: html2pdf } = await import('html2pdf.js');
  const container = createExportContainer(report);
  const content = container.querySelector('.report-pdf-shell');

  if (!(content instanceof HTMLElement)) {
    container.remove();
    throw new Error('Report export container was not created correctly.');
  }

  const stamp = report.updatedAt.slice(0, 10);

  try {
    await html2pdf()
      .set({
        margin: [5, 5, 6, 5],
        filename: `${sanitizeFileName(report.report.headline || 'luvtalk-report')}-${stamp}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#eef3f9',
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
      })
      .from(content)
      .save();
  } finally {
    container.remove();
  }
};

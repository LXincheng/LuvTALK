import type { ConversationReportPayload } from '../types/api';

/**
 * Mock immersive report for development preview and layout debugging.
 * Structure matches the production ConversationReportPayload exactly.
 */
export const IMMERSIVE_MOCK_REPORT: ConversationReportPayload = {
  id: 'mock-immersive-001',
  conversationId: 'mock-conv-001',
  userId: 'dev-preview',
  createdAt: '2026-03-24T10:30:00.000Z',
  updatedAt: '2026-03-24T10:42:00.000Z',
  targetLanguage: 'cantonese',
  nativeLanguage: 'mandarin',
  sourceMode: 'immersive',
  voiceStyle: 'alloy',
  reportLanguage: 'zh',
  metrics: {
    durationMinutes: 12,
    userTurns: 18,
    aiTurns: 17,
    averageScore: 82,
    latestScore: 87,
    pronunciationMentions: 4,
    grammarMentions: 3,
    rhythmMentions: 2,
    realtimeTurns: 18,
  },
  report: {
    headline: '茶餐厅点餐实战复盘',
    overallSummary:
      '整轮对话保持自然节奏，点餐用语准确率明显提升。下一步重点优化句尾语调和复合句结构。',
    learnerSnapshot:
      '回应速度稳定，日常场景词汇覆盖良好，语法组织正在从模仿阶段过渡到自主输出。',
    strengths: [
      '点餐核心句式掌握准确，表达意图清晰',
      '能主动使用确认句型，对话连贯性好',
      '关键词发音清楚，语速适中',
    ],
    opportunities: [
      '复合句结构偏长，建议拆分为短句',
      '句尾语调需要更明显的升降变化',
      '量词使用偶有不准确',
    ],
    pronunciation: {
      summary:
        '声母韵母基本准确，但声调在句尾位置容易趋平，缺少自然的升降起伏。',
      highlights: ['m4 goi1', 'jat1 bui1', 'do1 ze6'],
      actionPlan: [
        '句尾词单独练习声调，录音对比',
        '跟读 3 遍后尝试不看文字复述',
      ],
    },
    vocabulary: {
      summary:
        '餐厅场景核心词汇使用自然，但同义替换偏少，建议拓展点餐变体表达。',
      highlights: ['冻柠茶', '走冰', '加底', '例汤'],
      actionPlan: [
        '每个常用请求准备 2 种替代说法',
        '练习用不同表达完成同一个点餐意图',
      ],
    },
    grammar: {
      summary:
        '基础语序正确，但部分句子嵌套层级过深，听感不够简洁。',
      highlights: [],
      actionPlan: [
        '将超过 15 字的句子拆成两句',
        '先说动作再说修饰，避免倒装',
      ],
    },
    rhythm: {
      summary:
        '整体语速合适，但意群之间缺少明显停顿，容易让听者跟不上重点。',
      highlights: [],
      actionPlan: [
        '在"请求 + 具体内容"之间加入 0.5 秒停顿',
        '关键词前适当放慢语速以强调',
      ],
    },
    nextSessionPlan: {
      focus: '保持茶餐厅场景，加入"追加点单"和"结账"环节，目标句长控制在 12 字以内。',
      drills: [
        '用 3 句短句完成：点单 → 确认 → 追加',
        '练习"唔该，我想改一下"的变体表达',
        '模拟结账场景：问价 → 付款 → 道谢',
      ],
      checkpoint:
        '如果下轮对话平均句长明显缩短且意群停顿更自然，说明调整生效。',
    },
    keyMoments: [
      {
        speaker: 'user',
        quote: '唔该，我想要一杯冻柠茶，走冰。',
        note: '意图清晰，用词准确，语气自然。',
      },
      {
        speaker: 'ai',
        quote: '好嘅，冻柠走冰。仲要唔要其他嘢？',
        note: '导师使用了缩略确认句式，可以学习模仿。',
      },
      {
        speaker: 'user',
        quote: '加一个菠萝包，唔该。',
        note: '追加点单表达流畅，量词使用正确。',
      },
    ],
  },
};

/** English version of the mock for locale testing */
export const IMMERSIVE_MOCK_REPORT_EN: ConversationReportPayload = {
  ...IMMERSIVE_MOCK_REPORT,
  id: 'mock-immersive-en-001',
  reportLanguage: 'en',
  report: {
    headline: 'Cafe Ordering Practice Review',
    overallSummary:
      'Natural conversation flow throughout. Ordering phrases were accurate. Focus next on shorter sentences and clearer intonation at sentence endings.',
    learnerSnapshot:
      'Stable response speed, good coverage of daily vocabulary. Grammar is transitioning from imitation to independent output.',
    strengths: [
      'Core ordering patterns are accurate and clear',
      'Actively used confirmation phrases to maintain flow',
      'Key word pronunciation is clear with moderate pace',
    ],
    opportunities: [
      'Compound sentences tend to be long — split into shorter ones',
      'Sentence-final intonation needs more contrast',
      'Occasional classifier inaccuracy',
    ],
    pronunciation: {
      summary:
        'Initials and finals are mostly accurate, but tones flatten at sentence endings.',
      highlights: ['m4 goi1', 'jat1 bui1', 'do1 ze6'],
      actionPlan: [
        'Practice tones on sentence-final words separately',
        'Shadow-read 3 times then retell without text',
      ],
    },
    vocabulary: {
      summary:
        'Restaurant vocabulary is natural but synonymous alternatives are limited.',
      highlights: ['iced lemon tea', 'no ice', 'extra rice', 'soup of the day'],
      actionPlan: [
        'Prepare 2 alternative ways for each common request',
        'Practice expressing the same ordering intent differently',
      ],
    },
    grammar: {
      summary:
        'Basic word order is correct but some sentences are over-nested.',
      highlights: [],
      actionPlan: [
        'Break sentences longer than 15 words into two',
        'Lead with the action, then add modifiers',
      ],
    },
    rhythm: {
      summary:
        'Overall pace is good but pauses between thought groups are too short.',
      highlights: [],
      actionPlan: [
        'Add a 0.5s pause between request and specific content',
        'Slow down slightly before key words for emphasis',
      ],
    },
    nextSessionPlan: {
      focus: 'Same cafe scenario, add "modifying an order" and "checking out". Target sentence length under 12 words.',
      drills: [
        'Complete order → confirm → modify in 3 short sentences',
        'Practice variations of "Excuse me, I want to change..."',
        'Simulate checkout: ask price → pay → thank',
      ],
      checkpoint:
        'If average sentence length drops and thought-group pauses feel more natural, the adjustment worked.',
    },
    keyMoments: [
      {
        speaker: 'user',
        quote: 'Excuse me, I\'d like an iced lemon tea, no ice please.',
        note: 'Clear intent, accurate vocabulary, natural tone.',
      },
      {
        speaker: 'ai',
        quote: 'Sure, iced lemon no ice. Anything else?',
        note: 'Tutor used abbreviated confirmation — good to mimic.',
      },
      {
        speaker: 'user',
        quote: 'Add a pineapple bun, please.',
        note: 'Smooth follow-up order with correct classifier.',
      },
    ],
  },
};

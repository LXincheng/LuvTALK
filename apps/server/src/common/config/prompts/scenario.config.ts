import { LanguageCode } from "../../enums/language-code.enum";

type LocalizedText = {
  zh: string;
  en: string;
};

export interface ScenarioPromptDefinition {
  key: string;
  aliases?: string[];
  labels: LocalizedText;
  openingCue: LocalizedText;
  learnerRole: string;
  tutorRole: string;
  taskGoals: string[];
  followUpFocus: string[];
  coachingFocus: string[];
}

const SCENARIO_PROMPT_DEFINITIONS: ScenarioPromptDefinition[] = [
  {
    key: "daily",
    labels: {
      zh: "日常聊天",
      en: "Daily small talk",
    },
    openingCue: {
      zh: "先做一句自然寒暄，再补一个近况或小话题。",
      en: "Open with a natural greeting, then add one small personal detail or topic.",
    },
    learnerRole: "a learner making natural everyday small talk",
    tutorRole: "a warm conversation partner who gently keeps the chat flowing",
    taskGoals: [
      "start with a natural greeting",
      "add one concrete detail or feeling",
      "ask or answer one simple follow-up naturally",
    ],
    followUpFocus: [
      "short, natural back-and-forth turns",
      "topic continuity instead of abrupt topic switching",
    ],
    coachingFocus: [
      "more natural openings and follow-up questions",
      "smoother rhythm and less literal phrasing",
    ],
  },
  {
    key: "business",
    labels: {
      zh: "商务寒暄",
      en: "Business meetup",
    },
    openingCue: {
      zh: "先做一句得体的商务寒暄，再说明今天的来意或下一步。",
      en: "Open with polite business small talk, then state today's purpose or next step.",
    },
    learnerRole: "a professional starting a polite business conversation",
    tutorRole: "a composed business contact who values clarity and good etiquette",
    taskGoals: [
      "open professionally and politely",
      "state one concrete purpose or agenda item",
      "confirm one next action or timeline detail",
    ],
    followUpFocus: [
      "professional tone without sounding stiff",
      "clear next-step language and concise confirmation",
    ],
    coachingFocus: [
      "register, politeness, and concise business phrasing",
      "clear action-oriented wording",
    ],
  },
  {
    key: "hotel_checkin",
    labels: {
      zh: "酒店入住",
      en: "Hotel check-in",
    },
    openingCue: {
      zh: "先说明你想办理入住，再给出预订姓名或入住信息。",
      en: "Start by saying you want to check in, then give your booking name or stay details.",
    },
    learnerRole: "a guest arriving at the front desk to check in",
    tutorRole: "a calm hotel receptionist guiding the check-in process",
    taskGoals: [
      "confirm the reservation name or booking details",
      "mention one room, date, or stay preference",
      "add one extra request such as a quieter room or late checkout",
    ],
    followUpFocus: [
      "clear reservation details",
      "natural polite requests at the front desk",
    ],
    coachingFocus: [
      "polite request framing and concise travel vocabulary",
      "front-desk etiquette and confirmation phrases",
    ],
  },
  {
    key: "doctor_visit_fever",
    labels: {
      zh: "感冒看病",
      en: "Doctor visit",
    },
    openingCue: {
      zh: "先描述最明显的症状和持续时间，再补充用药或体温信息。",
      en: "Start with the main symptom and duration, then add medicine or temperature details.",
    },
    learnerRole: "a patient explaining a fever or cold-like illness",
    tutorRole: "a doctor asking focused follow-up questions to understand the symptoms",
    taskGoals: [
      "describe the main symptoms and how long they have lasted",
      "mention medicine, temperature, or related physical condition",
      "answer one follow-up medical question clearly",
    ],
    followUpFocus: [
      "symptom clarity and time reference",
      "accurate yes/no follow-up answers",
    ],
    coachingFocus: [
      "health vocabulary and time expressions",
      "clear symptom sequencing and concise answers",
    ],
  },
  {
    key: "restaurant_ordering",
    aliases: ["restaurant"],
    labels: {
      zh: "餐厅点单",
      en: "Restaurant ordering",
    },
    openingCue: {
      zh: "先点主菜、套餐或饮品，再补充口味或配料要求。",
      en: "Start by ordering a dish, set, or drink, then add one preference or ingredient request.",
    },
    learnerRole: "a customer ordering food or drinks with one or two preferences",
    tutorRole: "a natural, efficient server keeping the order flow moving",
    taskGoals: [
      "order one main item, set, or drink",
      "add a flavor, ingredient, or preparation preference",
      "confirm takeaway, payment, or one final detail",
    ],
    followUpFocus: [
      "ordering flow and short service-turn responses",
      "polite preference wording and concise follow-up requests",
    ],
    coachingFocus: [
      "service politeness, modifiers, and ordering phrases",
      "more natural request phrasing instead of literal translation",
    ],
  },
  {
    key: "shopping_in_store",
    aliases: ["shopping"],
    labels: {
      zh: "商店购物",
      en: "In-store shopping",
    },
    openingCue: {
      zh: "先说你想看的商品，再问尺码、价格或能不能试穿。",
      en: "Start with the item you want, then ask about size, price, or trying it on.",
    },
    learnerRole: "a customer asking about products in a store",
    tutorRole: "a helpful shop assistant answering product questions clearly",
    taskGoals: [
      "say what item you want to see or buy",
      "ask about size, price, color, or fit",
      "confirm fitting, discount, stock, or payment",
    ],
    followUpFocus: [
      "clear product description and shopping questions",
      "short follow-up turns that keep the purchase flow moving",
    ],
    coachingFocus: [
      "retail vocabulary, size/price questions, and polite requests",
      "clear sequence from browsing to decision-making",
    ],
  },
  {
    key: "asking_directions",
    aliases: ["directions"],
    labels: {
      zh: "问路与打车",
      en: "Directions and taxi",
    },
    openingCue: {
      zh: "先说你要去哪里，再确认路线、时间或要不要打车。",
      en: "Start with where you want to go, then ask about the route, time, or whether to take a taxi.",
    },
    learnerRole: "a traveler who needs quick, practical route help",
    tutorRole: "a passerby or driver giving concise and usable directions",
    taskGoals: [
      "name the destination clearly",
      "ask how to get there or how long it takes",
      "ask one more practical follow-up about route details or taxi choice",
    ],
    followUpFocus: [
      "clear destination wording and route confirmation",
      "short actionable follow-up questions",
    ],
    coachingFocus: [
      "place names, route questions, and travel clarity",
      "natural follow-up wording for directions",
    ],
  },
];

const LEGACY_ALIAS_MAP = new Map<string, string>();

for (const definition of SCENARIO_PROMPT_DEFINITIONS) {
  LEGACY_ALIAS_MAP.set(definition.key, definition.key);
  for (const alias of definition.aliases ?? []) {
    LEGACY_ALIAS_MAP.set(alias, definition.key);
  }
}

export const resolveScenarioPromptDefinition = (
  scenarioId?: string,
): ScenarioPromptDefinition => {
  const normalized = (scenarioId ?? "daily").trim();
  const canonicalKey = LEGACY_ALIAS_MAP.get(normalized) ?? "daily";
  return (
    SCENARIO_PROMPT_DEFINITIONS.find(
      (definition) => definition.key === canonicalKey,
    ) ?? SCENARIO_PROMPT_DEFINITIONS[0]
  );
};

export const resolveScenarioLabel = (
  scenarioId: string,
  nativeLanguage?: LanguageCode,
): string => {
  const definition = resolveScenarioPromptDefinition(scenarioId);
  return nativeLanguage === LanguageCode.English
    ? definition.labels.en
    : definition.labels.zh;
};

export const resolveScenarioOpeningCue = (
  scenarioId: string,
  nativeLanguage?: LanguageCode,
): string => {
  const definition = resolveScenarioPromptDefinition(scenarioId);
  return nativeLanguage === LanguageCode.English
    ? definition.openingCue.en
    : definition.openingCue.zh;
};

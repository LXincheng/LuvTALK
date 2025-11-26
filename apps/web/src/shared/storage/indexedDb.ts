import { openDB, type DBSchema } from "idb";
import type { ConversationSession } from "../../types/api";
import type { LanguageCode } from "../../types/language";
import type { VoiceOperationStatus } from "../../services/conversationService";

const DB_NAME = "luvtalk-cache";
const DB_VERSION = 1;
const STORE_PENDING = "pendingVoices";
const STORE_RECENT = "recentConversations";
const RECENT_LIMIT = 5;

interface PendingVoiceRecord {
  operationId: string;
  conversationId: string;
  status: VoiceOperationStatus;
  blob?: Blob;
  transcript?: string;
  updatedAt: number;
}

interface RecentConversationRecord {
  id: string;
  scenarioId: string;
  targetLanguage: LanguageCode;
  nativeLanguage?: LanguageCode;
  updatedAt: number;
  lastMessage?: string;
  score?: number;
}

interface LuvTalkDbSchema extends DBSchema {
  [STORE_PENDING]: {
    key: string;
    value: PendingVoiceRecord;
    indexes: {
      "by-conversation": string;
    };
  };
  [STORE_RECENT]: {
    key: string;
    value: RecentConversationRecord;
    indexes: {
      "by-updatedAt": number;
    };
  };
}

let dbPromise:
  | Promise<import("idb").IDBPDatabase<LuvTalkDbSchema>>
  | undefined;

async function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<LuvTalkDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_PENDING)) {
          const pendingStore = db.createObjectStore(STORE_PENDING, {
            keyPath: "operationId",
          });
          pendingStore.createIndex("by-conversation", "conversationId");
        }
        if (!db.objectStoreNames.contains(STORE_RECENT)) {
          const recentStore = db.createObjectStore(STORE_RECENT, {
            keyPath: "id",
          });
          recentStore.createIndex("by-updatedAt", "updatedAt");
        }
      },
    });
  }
  return dbPromise;
}

export async function savePendingVoiceRecord(
  record: Omit<PendingVoiceRecord, "updatedAt"> & { updatedAt?: number },
) {
  const db = await getDb();
  const value: PendingVoiceRecord = {
    ...record,
    updatedAt: record.updatedAt ?? Date.now(),
  };
  await db.put(STORE_PENDING, value);
}

export async function updatePendingVoiceRecord(
  operationId: string,
  patch: Partial<PendingVoiceRecord>,
) {
  const db = await getDb();
  const tx = db.transaction(STORE_PENDING, "readwrite");
  const store = tx.objectStore(STORE_PENDING);
  const existing = await store.get(operationId);
  if (!existing) {
    await tx.done;
    return;
  }
  const next: PendingVoiceRecord = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };
  await store.put(next);
  await tx.done;
}

export async function removePendingVoiceRecord(operationId: string) {
  const db = await getDb();
  await db.delete(STORE_PENDING, operationId);
}

export async function listPendingVoicesForConversation(
  conversationId: string,
) {
  const db = await getDb();
  return db.getAllFromIndex(STORE_PENDING, "by-conversation", conversationId);
}

export async function saveRecentConversationSnapshot(
  session: ConversationSession,
) {
  const db = await getDb();
  const summary: RecentConversationRecord = {
    id: session.id,
    scenarioId: session.scenarioId,
    targetLanguage: session.targetLanguage,
    nativeLanguage: session.nativeLanguage,
    updatedAt: Date.now(),
    lastMessage: session.messages.at(-1)?.text,
    score: session.coach?.overallScore,
  };
  const tx = db.transaction(STORE_RECENT, "readwrite");
  const store = tx.objectStore(STORE_RECENT);
  await store.put(summary);
  const index = store.index("by-updatedAt");
  while ((await index.count()) > RECENT_LIMIT) {
    const cursor = await index.openCursor();
    if (!cursor) {
      break;
    }
    await cursor.delete();
  }
  await tx.done;
}

export async function getRecentConversations(limit = RECENT_LIMIT) {
  const db = await getDb();
  const store = db.transaction(STORE_RECENT).store;
  const index = store.index("by-updatedAt");
  const result: RecentConversationRecord[] = [];
  let cursor = await index.openCursor(null, "prev");
  while (cursor && result.length < limit) {
    result.push(cursor.value);
    cursor = await cursor.continue();
  }
  return result;
}

export type { PendingVoiceRecord, RecentConversationRecord };


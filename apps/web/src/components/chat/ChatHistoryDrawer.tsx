import { AnimatePresence, motion } from 'motion/react';
import { X, Plus, MessageCircle, Trash2 } from 'lucide-react';
import { useLocale } from '../../providers/LocaleContext';
import type { LocaleKey } from '../../providers/LocaleContext';
import type { ConversationHistorySummary } from '../../types/api';

interface ChatHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationHistorySummary[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewChat: () => void;
  isLoading: boolean;
  isDisabled?: boolean;
}

function formatRelativeTime(dateStr: string, locale: string, t: (key: LocaleKey) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('timeJustNow');
  if (diffMin < 60)
    return t('timeMinutesAgo').replace('{n}', String(diffMin));
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)
    return t('timeHoursAgo').replace('{n}', String(diffHr));
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30)
    return t('timeDaysAgo').replace('{n}', String(diffDay));
  return new Date(dateStr).toLocaleDateString(
    locale === 'zh' ? 'zh-CN' : 'en-US',
    { month: 'short', day: 'numeric' },
  );
}

export default function ChatHistoryDrawer({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
  isLoading,
  isDisabled = false,
}: ChatHistoryDrawerProps) {
  const { t, locale } = useLocale();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 w-[min(20rem,calc(100vw-0.75rem))] glass-sidebar border-r border-separator flex flex-col"
          >
            <div className="p-4 border-b border-separator flex items-center justify-between">
              <h3 className="font-semibold text-label">
                {t('chatHistory')}
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-fill-secondary transition-colors"
              >
                <X className="w-5 h-5 text-label-tertiary" />
              </button>
            </div>

            <button
              onClick={onNewChat}
              disabled={isDisabled}
              className="mx-4 mt-4 flex items-center justify-center gap-2 glass-button text-white rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="w-4 h-4" />
              {t('newChat')}
            </button>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isLoading && (
                <div className="text-center py-8 text-sm text-label-tertiary">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                </div>
              )}

              {!isLoading && conversations.length === 0 && (
                <div className="text-center py-12">
                  <MessageCircle className="w-10 h-10 text-label-tertiary mx-auto mb-3" />
                  <p className="text-sm text-label-secondary">
                    {t('noHistory')}
                  </p>
                  <p className="text-xs text-label-tertiary mt-1">
                    {t('noHistoryHint')}
                  </p>
                </div>
              )}

              {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                return (
                  <div
                    key={conv.id}
                    className={`w-full text-left glass-card border rounded-xl p-3 transition-all ${
                      isActive
                        ? 'border-primary bg-primary/10'
                        : 'border-separator hover:bg-fill-secondary'
                    } ${isDisabled ? 'opacity-55' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => onSelectConversation(conv.id)}
                        disabled={isDisabled}
                        className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm text-label truncate flex-1">
                            {conv.title || conv.scenarioId}
                          </p>
                          {conv.status === 'active' && (
                            <span className="ml-2 w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-label-secondary truncate mt-1">
                          {conv.lastMessage}
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-label-tertiary">
                            {formatRelativeTime(conv.updatedAt, locale, t)}
                          </span>
                          {conv.messageCount != null && (
                            <span className="text-xs text-label-tertiary">
                              {conv.messageCount} {t('messageCountUnit')}
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteConversation(conv.id)}
                        disabled={isDisabled}
                        className="shrink-0 rounded-lg p-2 text-label-tertiary transition-colors hover:bg-fill-secondary hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={t('conversationDelete')}
                        title={t('conversationDelete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

import { Target, Award, TrendingUp, Calendar } from 'lucide-react';
import { useLocale } from '../providers/LocaleContext';

export default function ProfilePage() {
  const { t, locale } = useLocale();
  const stats = [
    {
      label: locale === 'zh' ? '累计会话' : 'Total Sessions',
      value: '47',
      icon: Calendar,
      color: 'indigo',
    },
    {
      label: locale === 'zh' ? '已学单词' : 'Words Learned',
      value: '342',
      icon: Award,
      color: 'green',
    },
    {
      label: locale === 'zh' ? '连续天数' : 'Streak Days',
      value: '12',
      icon: TrendingUp,
      color: 'orange',
    },
    { label: locale === 'zh' ? '等级' : 'Level', value: 'B1', icon: Target, color: 'purple' },
  ];

  const recentAchievements = [
    {
      id: '1',
      title: locale === 'zh' ? '连续 7 天' : '7-Day Streak',
      description:
        locale === 'zh' ? '连续练习 7 天' : 'Practiced 7 days in a row',
      date: locale === 'zh' ? '2 天前' : '2 days ago',
      icon: '🔥',
    },
    {
      id: '2',
      title: locale === 'zh' ? '高效学习' : 'Fast Learner',
      description:
        locale === 'zh' ? '一周学习 50 个新词' : 'Learned 50 new words in a week',
      date: locale === 'zh' ? '5 天前' : '5 days ago',
      icon: '⚡',
    },
    {
      id: '3',
      title: locale === 'zh' ? '会话达人' : 'Conversation Master',
      description:
        locale === 'zh' ? '完成 20 次对话' : 'Completed 20 chat sessions',
      date: locale === 'zh' ? '1 周前' : '1 week ago',
      icon: '💬',
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <div className="glass-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
              JD
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">
                John Doe
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-3">
                {locale === 'zh'
                  ? '学习粤语 · 中级 (B1)'
                  : 'Learning Cantonese · Intermediate (B1)'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-full">
                  {locale === 'zh' ? '加入于 2025 年 1 月' : 'Member since Jan 2025'}
                </span>
                <span className="px-3 py-1 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 text-sm font-medium rounded-full">
                  {locale === 'zh' ? '活跃学习者' : 'Active Learner'}
                </span>
              </div>
            </div>
            <button className="px-6 py-2 glass-button text-white rounded-xl font-medium transition-all hover:opacity-90">
              {t('profileEdit')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const colorClasses = {
              indigo: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400',
              green: 'bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400',
              orange: 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400',
              purple: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
            }[stat.color];

            return (
              <div
                key={stat.label}
                className="glass-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6"
              >
                <div
                  className={`w-10 h-10 ${colorClasses} rounded-lg flex items-center justify-center mb-3`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1">
                  {stat.value}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {stat.label}
                </p>
              </div>
            );
          })}
        </div>

        <div className="glass-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            {t('profileProgress')}
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {locale === 'zh' ? '词汇' : 'Vocabulary'}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {locale === 'zh' ? '342 / 500 词' : '342 / 500 words'}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-3 rounded-full transition-all"
                  style={{ width: '68%' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {locale === 'zh' ? '语法' : 'Grammar'}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {locale === 'zh' ? '45 / 80 主题' : '45 / 80 topics'}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div
                  className="bg-green-600 dark:bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: '56%' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-700 font-medium">
                  {locale === 'zh' ? '发音' : 'Pronunciation'}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {locale === 'zh'
                    ? '平均得分：85/100'
                    : 'Average score: 85/100'}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div
                  className="bg-purple-600 dark:bg-purple-500 h-3 rounded-full transition-all"
                  style={{ width: '85%' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            {t('profileAchievements')}
          </h2>
          <div className="space-y-3">
            {recentAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className="flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
              >
                <div className="text-3xl">{achievement.icon}</div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900 dark:text-white">
                    {achievement.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {achievement.description}
                  </p>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-500 whitespace-nowrap">
                  {achievement.date}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

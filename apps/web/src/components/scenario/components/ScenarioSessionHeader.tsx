import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ScenarioSessionHeaderProps {
  backTo: string;
  title: string;
  emoji: string;
  languageLabel: string;
  turnLabel: string;
  stageLabel: string;
  onEnd: () => void;
  endLabel: string;
  settingsContent?: ReactNode;
}

export default function ScenarioSessionHeader({
  backTo,
  title,
  emoji,
  languageLabel,
  turnLabel,
  stageLabel,
  onEnd,
  endLabel,
  settingsContent,
}: ScenarioSessionHeaderProps) {
  return (
    <div className="border-b border-separator glass-card">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2.5">
          <Link
            to={backTo}
            className="press-scale inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-fill-secondary text-label-secondary transition-colors hover:bg-fill"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-[1.05rem] leading-none">{emoji}</span>
              <h2 className="truncate text-[0.98rem] font-semibold tracking-[-0.03em] text-label sm:text-[1.02rem]">
                {title}
              </h2>
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[12px] leading-5 text-label-tertiary sm:text-[12.5px]">
              <span>{languageLabel}</span>
              <span className="text-label-quaternary">·</span>
              <span>{turnLabel}</span>
              <span className="text-label-quaternary">·</span>
              <span className="truncate">{stageLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onEnd}
            className="press-scale inline-flex h-10 min-w-[108px] shrink-0 items-center justify-center rounded-[14px] bg-primary px-4 text-sm font-medium text-white"
          >
            {endLabel}
          </button>
        </div>
        {settingsContent ? (
          <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-[3.2rem]">
            {settingsContent}
          </div>
        ) : null}
      </div>
    </div>
  );
}

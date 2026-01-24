import VocabularyPopover from './VocabularyPopover';
import type { ReactNode } from 'react';
import type { Annotation } from '../../types/chat';

interface AnnotatedMessageProps {
  content: string;
  annotations?: Annotation[];
  onSaveVocabulary?: (payload: Annotation) => void;
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isCjk = (word: string) => /[\u4e00-\u9fff]/.test(word);

export default function AnnotatedMessage({
  content,
  annotations = [],
  onSaveVocabulary,
}: AnnotatedMessageProps) {
  if (annotations.length === 0) {
    return <p className="text-slate-800 dark:text-slate-200">{content}</p>;
  }

  const renderContent = () => {
    const parts: ReactNode[] = [];
    let remainingText = content;
    let keyCounter = 0;

    const sortedAnnotations = [...annotations].sort(
      (a, b) => b.word.length - a.word.length,
    );

    while (remainingText.length > 0) {
      let matched = false;

      for (const annotation of sortedAnnotations) {
        const pattern = isCjk(annotation.word)
          ? `(${escapeRegExp(annotation.word)})`
          : `\\b(${escapeRegExp(annotation.word)})\\b`;
        const regex = new RegExp(pattern, 'i');
        const match = remainingText.match(regex);

        if (match && match.index !== undefined) {
          const beforeMatch = remainingText.substring(0, match.index);
          const matchedWord = match[1];

          if (beforeMatch) {
            parts.push(
              <span key={`text-${keyCounter++}`}>{beforeMatch}</span>,
            );
          }

          parts.push(
            <VocabularyPopover
              key={`vocab-${keyCounter++}`}
              word={matchedWord}
              explanation={annotation.explanation}
              examples={annotation.examples}
              onSave={onSaveVocabulary}
            />,
          );

          remainingText = remainingText.substring(
            match.index + matchedWord.length,
          );
          matched = true;
          break;
        }
      }

      if (!matched) {
        parts.push(<span key={`text-${keyCounter++}`}>{remainingText}</span>);
        break;
      }
    }

    return parts;
  };

  return <p className="text-slate-800 dark:text-slate-200">{renderContent()}</p>;
}

export type MessageType = 'user' | 'ai';

export interface Annotation {
  word: string;
  explanation: string;
  examples?: string[];
  type?: string;
}

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  translation?: string;
  pronunciationScore?: number;
  pronunciationTip?: string;
  rhythmTip?: string;
  grammarTip?: string;
  audioUrl?: string;
  annotations?: Annotation[];
  isLoading?: boolean;
  isOptimistic?: boolean;
  statusText?: string;
  timestamp: Date;
}

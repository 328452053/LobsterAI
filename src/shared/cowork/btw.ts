import {
  buildSelectedTextPromptSection,
  type CoworkSelectedTextSnippet,
} from './selectedText';
import { stripNullChars } from './text';

export const CoworkBtwStatus = {
  Pending: 'pending',
  Answered: 'answered',
  Failed: 'failed',
  Stopped: 'stopped',
} as const;
export type CoworkBtwStatus = typeof CoworkBtwStatus[keyof typeof CoworkBtwStatus];

// BTW is intentionally a short, one-shot side question. Keep request and
// renderer payloads bounded independently of the much larger chat frame limit.
export const COWORK_BTW_QUESTION_MAX_CHARS = 16_000;
export const COWORK_BTW_DRAFT_MAX_CHARS = 32_000;
export const COWORK_BTW_RESULT_MAX_CHARS = 120_000;
export const COWORK_BTW_IDENTIFIER_MAX_CHARS = 512;
export const COWORK_BTW_THREAD_ENTRY_LIMIT = 50;
export const COWORK_BTW_THREAD_CONTENT_MAX_CHARS = 500_000;
export const COWORK_BTW_EPHEMERAL_THREAD_LIMIT = 12;

export const CoworkBtwCommandValidationError = {
  EmptyQuestion: 'empty_question',
  MultilineUnsupported: 'multiline_unsupported',
  QuestionTooLong: 'question_too_long',
} as const;
export type CoworkBtwCommandValidationError =
  typeof CoworkBtwCommandValidationError[keyof typeof CoworkBtwCommandValidationError];

export interface CoworkBtwEntry {
  runId: string;
  sessionId: string;
  question: string;
  selectedTextSnippets?: CoworkSelectedTextSnippet[];
  status: CoworkBtwStatus;
  answer?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface CoworkBtwThread {
  sessionId: string;
  isOpen: boolean;
  draft: string;
  selectedTextSnippets: CoworkSelectedTextSnippet[];
  entries: CoworkBtwEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface CoworkBtwSubmitRequest {
  sessionId: string;
  question: string;
  runId: string;
}

export interface CoworkBtwSubmitResponse {
  success: boolean;
  runId: string;
  error?: string;
}

export interface CoworkBtwAbortRequest {
  sessionId: string;
  runId: string;
}

export interface CoworkBtwAbortResponse {
  success: boolean;
  aborted: boolean;
  runId: string;
  error?: string;
}

export type CoworkBtwCommandParseResult =
  | { matched: false }
  | {
      matched: true;
      question: string;
      error?: CoworkBtwCommandValidationError;
    };

export const normalizeCoworkBtwQuestion = (value: string): string => (
  stripNullChars(value).trim()
);

export const normalizeCoworkBtwSelectedTextQuestion = (value: string): string => (
  normalizeCoworkBtwQuestion(value).replace(/\s+/g, ' ')
);

export const buildCoworkBtwComposerQuestion = (
  draft: string,
  selectedTextSnippets: CoworkSelectedTextSnippet[] = [],
): string => {
  const normalizedDraft = normalizeCoworkBtwQuestion(draft);
  const selectedTextSection = buildSelectedTextPromptSection(selectedTextSnippets);
  if (!selectedTextSection) return normalizedDraft;
  const question = normalizedDraft
    || 'Analyze the selected text excerpt and answer it directly if it contains a question.';
  return `${question}\n\n${selectedTextSection}`;
};

const truncateBtwContextValue = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
};

export const buildCoworkBtwContextualQuestion = (
  entries: CoworkBtwEntry[],
  question: string,
): string => {
  const currentQuestion = normalizeCoworkBtwSelectedTextQuestion(question);
  if (!currentQuestion) return '';

  const previousTurns = entries
    .filter((entry): entry is CoworkBtwEntry & { answer: string } => (
      entry.status === CoworkBtwStatus.Answered
      && typeof entry.answer === 'string'
      && entry.answer.trim().length > 0
    ))
    .map(entry => ({
      question: truncateBtwContextValue(
        normalizeCoworkBtwSelectedTextQuestion(buildCoworkBtwComposerQuestion(
          entry.question,
          entry.selectedTextSnippets,
        )),
        2_000,
      ),
      answer: truncateBtwContextValue(
        normalizeCoworkBtwSelectedTextQuestion(entry.answer),
        6_000,
      ),
    }))
    .filter(turn => turn.question && turn.answer);
  if (previousTurns.length === 0) {
    return currentQuestion;
  }

  const prefix = 'Continue this temporary side chat using the previous side-chat turns as context. '
    + 'Answer only the current question. Previous side-chat turns, oldest to newest: ';
  const suffix = ` Current question: ${JSON.stringify(currentQuestion)}`;
  const selectedTurns: string[] = [];
  for (let index = previousTurns.length - 1; index >= 0; index -= 1) {
    const serializedTurn = JSON.stringify(previousTurns[index]);
    const candidateTurns = [serializedTurn, ...selectedTurns];
    const candidate = `${prefix}[${candidateTurns.join(',')}]${suffix}`;
    if (candidate.length > COWORK_BTW_QUESTION_MAX_CHARS) {
      break;
    }
    selectedTurns.unshift(serializedTurn);
  }

  if (selectedTurns.length === 0) {
    return currentQuestion;
  }
  return `${prefix}[${selectedTurns.join(',')}]${suffix}`;
};

export const createCoworkBtwRunId = (): string => (
  `btw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

export function parseCoworkBtwCommand(input: string): CoworkBtwCommandParseResult {
  const trimmedStart = input.trimStart();
  const match = /^\/(?:btw|side)(?=\s|$)/i.exec(trimmedStart);
  if (!match) {
    return { matched: false };
  }

  const rawQuestion = trimmedStart.slice(match[0].length);
  const question = normalizeCoworkBtwQuestion(rawQuestion);
  if (!question) {
    return {
      matched: true,
      question: '',
      error: CoworkBtwCommandValidationError.EmptyQuestion,
    };
  }
  if (/[\r\n]/.test(rawQuestion)) {
    return {
      matched: true,
      question,
      error: CoworkBtwCommandValidationError.MultilineUnsupported,
    };
  }
  if (question.length > COWORK_BTW_QUESTION_MAX_CHARS) {
    return {
      matched: true,
      question,
      error: CoworkBtwCommandValidationError.QuestionTooLong,
    };
  }
  return { matched: true, question };
}

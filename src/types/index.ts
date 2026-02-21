export interface Word {
  id: string;
  word: string;
  meaning: string;
  example: string;
  exampleZh: string;
  level: string;
  isMastered: boolean;
  createdAt: number;
}

export interface Source {
  id: string;
  wordId: string;
  songTitle: string;
  artist: string;
  lyricSentence: string;
  lyricSentenceEn: string;
  lyricTranslated: string;
  replaceWord: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  language: 'en' | 'zh';
  lyrics: string;
  status: 'pending' | 'processing' | 'completed';
  createdAt: number;
}

export interface BlacklistItem {
  id: string;
  word: string;
}

export interface UserStats {
  totalWords: number;
  masteredWords: number;
  streakDays: number;
  lastPracticeDate: number | null;
}

export interface WrongAnswer {
  id: string;
  wordId: string;
  word: string;
  meaning: string;
  userAnswer: string;
  correctAnswer: string;
  sentence: string;
  sentenceEn: string;
  score: number;
  feedback: string;
  songTitle: string;
  createdAt: number;
  errorType: '4choice' | 'fill' | 'translate';
}

export interface ProcessResult {
  words: Array<{
    word: string;
    meaning: string;
    level: string;
    example: string;
    exampleZh: string;
    sentence: string;
    sentenceEn: string;
    replaceWord: string;
  }>;
}

export type ApiProvider = 'gemini' | 'nvidia' | 'opencode';
export type AIStyle = 'lyric' | 'poetic' | 'academic' | 'casual';

export interface UserSettings {
  apiProvider: ApiProvider;
  nvidiaApiKey: string;
  geminiApiKey: string;
  opencodeApiKey: string;
  nvidiaModel: string;
  geminiModel: string;
  opencodeModel: string;
  aiStyle: AIStyle;
}

export const DEFAULT_SETTINGS: UserSettings = {
  apiProvider: 'gemini',
  nvidiaApiKey: '',
  geminiApiKey: '',
  opencodeApiKey: '',
  nvidiaModel: 'moonshotai/kimi-k2.5',
  geminiModel: 'gemini-2.5-flash-lite',
  opencodeModel: 'big-pickle',
  aiStyle: 'lyric',
};

export const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemma-3-27b-it',
];

export const NVIDIA_MODELS = [
  'moonshotai/kimi-k2.5',
  'deepseek-ai/deepseek-v3.2',
  'qwen/qwen3.5-397b-a17b',
  'minimaxai/minimax-m2.1',
];

export const OPENCODE_MODELS = [
  'big-pickle',
  'glm-4.7-free',
  'kimi-k2.5-free',
  'minimax-m2.1-free',
  'grok-code-fast-1',
  'gpt-5-nano',
];

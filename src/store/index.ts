import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Word, Source, Song, BlacklistItem, UserStats, UserSettings, DEFAULT_SETTINGS, WrongAnswer } from '../types';

const STATS_KEY = '@melody_stats';
const BLACKLIST_KEY = '@melody_blacklist';
const SETTINGS_KEY = '@melody_settings';
const WRONG_ANSWERS_KEY = '@melody_wrong_answers';

interface AppState {
  words: Word[];
  sources: Source[];
  songs: Song[];
  blacklist: BlacklistItem[];
  wrongAnswers: WrongAnswer[];
  stats: UserStats;
  settings: UserSettings;
  isLoading: boolean;

  addWord: (word: Word) => void;
  addSource: (source: Source) => void;
  addSong: (song: Song) => void;
  updateWord: (id: string, updates: Partial<Word>) => void;
  addToBlacklist: (word: string) => void;
  removeFromBlacklist: (id: string) => void;
  addWrongAnswer: (wrongAnswer: WrongAnswer) => Promise<void>;
  removeWrongAnswer: (id: string) => Promise<void>;
  clearWrongAnswers: () => Promise<void>;
  loadData: () => Promise<void>;
  updateStats: (total: number, mastered: number) => void;
  getSourcesForWord: (wordId: string) => Source[];
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  words: [],
  sources: [],
  songs: [],
  blacklist: [],
  wrongAnswers: [],
  stats: {
    totalWords: 0,
    masteredWords: 0,
    streakDays: 0,
    lastPracticeDate: null,
  },
  settings: DEFAULT_SETTINGS,
  isLoading: true,

  addWord: (word) => set((state) => ({ words: [...state.words, word] })),

  addSource: (source) => set((state) => ({ sources: [...state.sources, source] })),

  addSong: (song) => set((state) => ({ songs: [...state.songs, song] })),

  updateWord: (id, updates) => set((state) => ({
    words: state.words.map((w) => (w.id === id ? { ...w, ...updates } : w)),
  })),

  addToBlacklist: async (word) => {
    const newItem: BlacklistItem = {
      id: Date.now().toString(),
      word: word.toLowerCase(),
    };
    const newBlacklist = [...get().blacklist, newItem];
    set({ blacklist: newBlacklist });
    await AsyncStorage.setItem(BLACKLIST_KEY, JSON.stringify(newBlacklist));
  },

  removeFromBlacklist: async (id) => {
    const newBlacklist = get().blacklist.filter((item) => item.id !== id);
    set({ blacklist: newBlacklist });
    await AsyncStorage.setItem(BLACKLIST_KEY, JSON.stringify(newBlacklist));
  },

  addWrongAnswer: async (wrongAnswer) => {
    const newWrongAnswers = [...get().wrongAnswers, wrongAnswer];
    set({ wrongAnswers: newWrongAnswers });
    await AsyncStorage.setItem(WRONG_ANSWERS_KEY, JSON.stringify(newWrongAnswers));
  },

  removeWrongAnswer: async (id) => {
    const newWrongAnswers = get().wrongAnswers.filter((item) => item.id !== id);
    set({ wrongAnswers: newWrongAnswers });
    await AsyncStorage.setItem(WRONG_ANSWERS_KEY, JSON.stringify(newWrongAnswers));
  },

  clearWrongAnswers: async () => {
    set({ wrongAnswers: [] });
    await AsyncStorage.setItem(WRONG_ANSWERS_KEY, JSON.stringify([]));
  },

  loadData: async () => {
    try {
      const [statsData, blacklistData, settingsData, wrongAnswersData] = await Promise.all([
        AsyncStorage.getItem(STATS_KEY),
        AsyncStorage.getItem(BLACKLIST_KEY),
        AsyncStorage.getItem(SETTINGS_KEY),
        AsyncStorage.getItem(WRONG_ANSWERS_KEY),
      ]);

      set({
        stats: statsData ? JSON.parse(statsData) : get().stats,
        blacklist: blacklistData ? JSON.parse(blacklistData) : [],
        wrongAnswers: wrongAnswersData ? JSON.parse(wrongAnswersData) : [],
        settings: settingsData ? { ...DEFAULT_SETTINGS, ...JSON.parse(settingsData) } : DEFAULT_SETTINGS,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load data:', error);
      set({ isLoading: false });
    }
  },

  updateStats: async (total, mastered) => {
    const newStats = { ...get().stats, totalWords: total, masteredWords: mastered };
    set({ stats: newStats });
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(newStats));
  },

  getSourcesForWord: (wordId) => get().sources.filter((s) => s.wordId === wordId),

  updateSettings: async (updates) => {
    const newSettings = { ...get().settings, ...updates };
    set({ settings: newSettings });
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  },
}));

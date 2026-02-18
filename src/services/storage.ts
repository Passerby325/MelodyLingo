import AsyncStorage from '@react-native-async-storage/async-storage';
import { Word, Source, Song } from '../types';

const WORDS_KEY = '@melody_words';
const SOURCES_KEY = '@melody_sources';
const SONGS_KEY = '@melody_songs';

export const StorageService = {
  async getWords(): Promise<Word[]> {
    try {
      const data = await AsyncStorage.getItem(WORDS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting words:', error);
      return [];
    }
  },

  async saveWords(words: Word[]): Promise<void> {
    try {
      await AsyncStorage.setItem(WORDS_KEY, JSON.stringify(words));
    } catch (error) {
      console.error('Error saving words:', error);
    }
  },

  async getSources(): Promise<Source[]> {
    try {
      const data = await AsyncStorage.getItem(SOURCES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting sources:', error);
      return [];
    }
  },

  async saveSources(sources: Source[]): Promise<void> {
    try {
      await AsyncStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
    } catch (error) {
      console.error('Error saving sources:', error);
    }
  },

  async getSongs(): Promise<Song[]> {
    try {
      const data = await AsyncStorage.getItem(SONGS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting songs:', error);
      return [];
    }
  },

  async saveSongs(songs: Song[]): Promise<void> {
    try {
      await AsyncStorage.setItem(SONGS_KEY, JSON.stringify(songs));
    } catch (error) {
      console.error('Error saving songs:', error);
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([WORDS_KEY, SOURCES_KEY, SONGS_KEY]);
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  },
};

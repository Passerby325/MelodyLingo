import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAppStore } from './src/store';
import { StorageService } from './src/services/storage';

export default function App() {
  const { loadData, addWord, addSource, addSong } = useAppStore();

  useEffect(() => {
    const initializeApp = async () => {
      await loadData();

      const [words, sources, songs] = await Promise.all([
        StorageService.getWords(),
        StorageService.getSources(),
        StorageService.getSongs(),
      ]);

      words.forEach((w) => addWord(w));
      sources.forEach((s) => addSource(s));
      songs.forEach((s) => addSong(s));
    };

    initializeApp();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

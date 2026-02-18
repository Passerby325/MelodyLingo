import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS } from '../constants';
import { extractVocabulary } from '../services/gemini';
import { StorageService } from '../services/storage';
import { useAppStore } from '../store';
import { Word, Source, Song } from '../types';

interface FactoryScreenProps {
  navigation: any;
}

export const FactoryScreen: React.FC<FactoryScreenProps> = ({ navigation }) => {
  const [songTitle, setSongTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  
  const { addWord, addSource, addSong, blacklist, words, sources, songs, settings } = useAppStore();

  const handleProcess = async () => {
    if (!songTitle.trim() || !lyrics.trim()) {
      Alert.alert('Error', 'Please fill in song title and lyrics');
      return;
    }

    setIsProcessing(true);
    setProgress('AI is analyzing lyrics...');
    setProgressPercent(5);

    try {
      const blacklistWords = blacklist.map((b) => b.word);
      
      const allWords: Array<{ word: string; meaning: string; level: string; example: string; exampleZh: string; sentence: string; sentenceEn: string; replaceWord: string }> = [];
      let requestCount = 0;
      const maxRequests = 3;

      while (requestCount < maxRequests) {
        requestCount++;
        const progressBase = Math.floor((requestCount / maxRequests) * 60);
        setProgressPercent(10 + progressBase);
        setProgress(`AI is extracting words... (${requestCount}/${maxRequests})`);
        
        const result = await extractVocabulary(lyrics, songTitle, blacklistWords, settings);
        
        if (result.words.length === 0) {
          break;
        }

        for (const w of result.words) {
          if (!allWords.some(existing => existing.word.toLowerCase() === w.word.toLowerCase())) {
            allWords.push(w);
          }
        }

        if (result.words.length < 10) {
          break;
        }

        if (allWords.length >= 25) {
          break;
        }
      }

      setProgressPercent(75);
      setProgress(`Found ${allWords.length} B2+ words`);

      const songId = Date.now().toString();
      const newSong: Song = {
        id: songId,
        title: songTitle,
        artist: '',
        language: 'en',
        lyrics: lyrics,
        status: 'completed',
        createdAt: Date.now(),
      };
      addSong(newSong);

      setProgressPercent(85);

      const existingWords = await StorageService.getWords();
      const existingSources = await StorageService.getSources();

      for (const vocabWord of allWords) {
        const existingWord = existingWords.find(
          (w) => w.word.toLowerCase() === vocabWord.word.toLowerCase()
        );

        if (existingWord) {
          const newSource: Source = {
            id: Date.now().toString() + Math.random(),
            wordId: existingWord.id,
            songTitle: songTitle,
            artist: '',
            lyricSentence: vocabWord.sentence || '',
            lyricSentenceEn: vocabWord.sentenceEn || '',
            lyricTranslated: vocabWord.meaning,
            replaceWord: vocabWord.replaceWord || '',
          };
          existingSources.push(newSource);
          addSource(newSource);
        } else {
          const wordId = Date.now().toString() + Math.random();
          const wordLevel = vocabWord.level || 'B2';
          const newWord: Word = {
            id: wordId,
            word: vocabWord.word,
            meaning: vocabWord.meaning,
            example: vocabWord.example,
            exampleZh: vocabWord.exampleZh || '',
            level: wordLevel,
            isMastered: false,
            createdAt: Date.now(),
          };
          existingWords.push(newWord);
          addWord(newWord);

          const newSource: Source = {
            id: Date.now().toString() + Math.random(),
            wordId: wordId,
            songTitle: songTitle,
            artist: '',
            lyricSentence: vocabWord.sentence || '',
            lyricSentenceEn: vocabWord.sentenceEn || '',
            lyricTranslated: vocabWord.meaning,
            replaceWord: vocabWord.replaceWord || '',
          };
          existingSources.push(newSource);
          addSource(newSource);
        }
      }

      setProgressPercent(95);

      await StorageService.saveWords(existingWords);
      await StorageService.saveSources(existingSources);
      await StorageService.saveSongs([...songs, newSong]);

      setProgressPercent(100);
      setProgress('Done!');

      setTimeout(() => {
        Alert.alert('Success', `Extracted ${allWords.length} words!`);
        setSongTitle('');
        setLyrics('');
        setProgress('');
        setProgressPercent(0);
        navigation.navigate('Treasury');
      }, 500);
    } catch (error) {
      console.error('Processing error:', error);
      Alert.alert('Error', 'Failed to process lyrics');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>The Factory</Text>
          <Text style={styles.subtitle}>Import your favorite song</Text>
        </View>
        <TouchableOpacity 
          style={styles.historyButton}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.historyButtonText}>📜 History</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Song Title</Text>
          <TextInput
            style={styles.input}
            value={songTitle}
            onChangeText={setSongTitle}
            placeholder="Enter song title"
            placeholderTextColor={COLORS.textMuted}
            editable={Boolean(!isProcessing)}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lyrics</Text>
          <TextInput
            style={[styles.input, styles.lyricsInput]}
            value={lyrics}
            onChangeText={setLyrics}
            placeholder="Paste lyrics here..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            editable={Boolean(!isProcessing)}
          />
        </View>

        {isProcessing && (
          <View style={styles.progressContainer}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={styles.progressText}>{progress}</Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, isProcessing && styles.buttonDisabled]}
          onPress={handleProcess}
          disabled={isProcessing}
        >
          <Text style={styles.buttonText}>
            {isProcessing ? 'Processing...' : '✨ Extract Vocabulary'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 60,
  },
  historyButton: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 0,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lyricsInput: {
    height: 200,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  progressText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  progressPercent: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
});

import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ListRenderItem,
} from 'react-native';
import { COLORS } from '../constants';
import { useAppStore } from '../store';
import { StorageService } from '../services/storage';
import { Word, Source } from '../types';
import { generatePracticeSentence, evaluateAnswer, generateTranslateQuestion, evaluateTranslation } from '../services/gemini';

type SortMode = 'order' | 'song' | 'created';
type FilterMode = 'all' | 'learning' | 'mastered';
type TreasuryStep = 'list' | 'practice';

interface TreasuryScreenProps {
  navigation: any;
}

export const TreasuryScreen: React.FC<TreasuryScreenProps> = ({ navigation }) => {
  const { words, sources, getSourcesForWord, updateWord, settings, addWrongAnswer } = useAppStore();
  const flatListRef = useRef<FlatList<Word>>(null);
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('order');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [treasuryStep, setTreasuryStep] = useState<TreasuryStep>('list');
  const [practiceMode, setPracticeMode] = useState<'4choice' | 'fill' | 'translate'>('fill');
  const [practiceWords, setPracticeWords] = useState<Word[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceSentence, setPracticeSentence] = useState<{sentence: string; sentenceZh: string; options: string[]} | null>(null);
  const [translateQuestion, setTranslateQuestion] = useState<{word: string; sentenceZh: string} | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [practiceResult, setPracticeResult] = useState<{isCorrect: boolean; score: number; feedback: string} | null>(null);
  const [practiceScore, setPracticeScore] = useState(0);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  
  const getWordIndex = (letter: string) => {
    const index = sortedWords.findIndex(word => 
      word.word.toUpperCase().startsWith(letter)
    );
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    }
  };

  const toggleSelectWord = (wordId: string) => {
    if (selectedWords.includes(wordId)) {
      setSelectedWords(selectedWords.filter(id => id !== wordId));
    } else {
      setSelectedWords([...selectedWords, wordId]);
    }
  };

  const sortedWords = useMemo(() => {
    let sorted = [...words];
    
    if (filterMode === 'mastered') {
      sorted = sorted.filter(w => w.isMastered);
    } else if (filterMode === 'learning') {
      sorted = sorted.filter(w => !w.isMastered);
    }
    
    if (sortMode === 'order') {
      sorted = sorted.sort((a, b) => a.word.localeCompare(b.word));
    } else if (sortMode === 'created') {
      sorted = sorted.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortMode === 'song') {
      sorted = sorted.sort((a, b) => {
        const sourcesA = sources.filter(s => s.wordId === a.id);
        const sourcesB = sources.filter(s => s.wordId === b.id);
        const songA = sourcesA[0]?.songTitle || '';
        const songB = sourcesB[0]?.songTitle || '';
        return songA.localeCompare(songB);
      });
    }
    return sorted;
  }, [words, sources, sortMode, filterMode]);

  const startPractice = (mode: '4choice' | 'fill' | 'translate') => {
    let availableWords = [...words];
    
    if (filterMode === 'mastered') {
      availableWords = availableWords.filter(w => w.isMastered);
    } else if (filterMode === 'learning') {
      availableWords = availableWords.filter(w => !w.isMastered);
    }
    
    if (availableWords.length < 4) {
      Alert.alert('Not enough words', 'Need at least 4 words to practice');
      return;
    }
    setPracticeMode(mode);
    const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
    setPracticeWords(shuffled);
    setPracticeIndex(0);
    setPracticeScore(0);
    setPracticeResult(null);
    setTreasuryStep('practice');
    
    if (mode === 'translate') {
      loadTranslateQuestion(shuffled[0]);
    } else {
      loadPracticeSentence(shuffled[0], shuffled);
    }
  };

  const loadTranslateQuestion = async (word: Word) => {
    setTranslateQuestion(null);
    setUserAnswer('');
    setPracticeResult(null);
    
    const result = await generateTranslateQuestion(word.word, word.meaning, settings);
    setTranslateQuestion(result);
  };

  const loadPracticeSentence = async (word: Word, allWords: Word[]) => {
    setPracticeSentence(null);
    setUserAnswer('');
    setPracticeResult(null);
    
    const otherWords = allWords.filter(w => w.id !== word.id).map(w => w.word);
    const result = await generatePracticeSentence(word.word, word.meaning, otherWords, settings);
    setPracticeSentence(result);
  };

  const submitPracticeAnswer = async () => {
    if ((!practiceSentence && practiceMode !== 'translate') || !userAnswer.trim()) return;
    
    const currentWord = practiceWords[practiceIndex];
    setIsEvaluating(true);
    
    try {
      let result: { isCorrect: boolean; score: number; feedback: string };
      
      if (practiceMode === 'translate' && translateQuestion) {
        result = await evaluateTranslation(
          userAnswer.trim(),
          translateQuestion.word,
          translateQuestion.sentenceZh,
          settings
        );
        setPracticeResult(result);
        if (result.isCorrect || result.score >= 70) {
          setPracticeScore(practiceScore + 1);
        } else {
          addWrongAnswer({
            id: Date.now().toString() + Math.random(),
            wordId: currentWord.id,
            word: currentWord.word,
            meaning: currentWord.meaning,
            userAnswer: userAnswer.trim(),
            correctAnswer: translateQuestion.word,
            sentence: translateQuestion.sentenceZh,
            sentenceEn: '',
            score: result.score,
            feedback: result.feedback,
            songTitle: '',
            createdAt: Date.now(),
            errorType: 'translate',
          });
        }
      } else if (practiceMode === 'fill') {
        result = await evaluateAnswer(
          userAnswer.trim(),
          currentWord.word,
          practiceSentence.sentence,
          practiceSentence.sentenceZh,
          currentWord.meaning,
          settings
        );
        setPracticeResult(result);
        if (result.isCorrect || result.score >= 70) {
          setPracticeScore(practiceScore + 1);
        } else {
          addWrongAnswer({
            id: Date.now().toString() + Math.random(),
            wordId: currentWord.id,
            word: currentWord.word,
            meaning: currentWord.meaning,
            userAnswer: userAnswer.trim(),
            correctAnswer: currentWord.word,
            sentence: practiceSentence.sentence,
            sentenceEn: practiceSentence.sentenceZh,
            score: result.score,
            feedback: result.feedback,
            songTitle: '',
            createdAt: Date.now(),
            errorType: 'fill',
          });
        }
      } else {
        const isCorrect = userAnswer.trim().toLowerCase() === currentWord.word.toLowerCase();
        result = {
          isCorrect,
          score: isCorrect ? 100 : 0,
          feedback: isCorrect ? 'Correct!' : `The answer is "${currentWord.word}"`
        };
        setPracticeResult(result);
        if (isCorrect) {
          setPracticeScore(practiceScore + 1);
        } else {
          addWrongAnswer({
            id: Date.now().toString() + Math.random(),
            wordId: currentWord.id,
            word: currentWord.word,
            meaning: currentWord.meaning,
            userAnswer: userAnswer.trim(),
            correctAnswer: currentWord.word,
            sentence: practiceSentence?.sentence || '',
            sentenceEn: practiceSentence?.sentenceZh || '',
            score: 0,
            feedback: 'Wrong answer',
            songTitle: '',
            createdAt: Date.now(),
            errorType: '4choice',
          });
        }
      }
    } catch (error) {
      const isCorrect = userAnswer.trim().toLowerCase() === currentWord.word.toLowerCase();
      setPracticeResult({
        isCorrect,
        score: isCorrect ? 100 : 0,
        feedback: isCorrect ? 'Correct!' : 'Wrong'
      });
      if (isCorrect) setPracticeScore(practiceScore + 1);
    } finally {
      setIsEvaluating(false);
    }
  };

  const nextPractice = () => {
    if (practiceIndex < practiceWords.length - 1) {
      const nextIdx = practiceIndex + 1;
      setPracticeIndex(nextIdx);
      if (practiceMode === 'translate') {
        loadTranslateQuestion(practiceWords[nextIdx]);
      } else {
        loadPracticeSentence(practiceWords[nextIdx], practiceWords);
      }
    } else {
      Alert.alert(
        'Practice Complete!',
        `You got ${practiceScore + (practiceResult && (practiceResult.isCorrect || practiceResult.score >= 70) ? 1 : 0)}/${practiceWords.length} correct!`,
        [{ text: 'OK', onPress: () => setTreasuryStep('list') }]
      );
    }
  };

  const handleBatchDelete = () => {
    if (selectedWords.length === 0) return;

    Alert.alert(
      'Delete Words',
      `Are you sure you want to delete ${selectedWords.length} words?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedWords = words.filter((w) => !selectedWords.includes(w.id));
            await StorageService.saveWords(updatedWords);
            
            const updatedSources = sources.filter((s) => !selectedWords.includes(s.wordId));
            await StorageService.saveSources(updatedSources);

            useAppStore.setState({ words: updatedWords, sources: updatedSources });
            setSelectedWords([]);
            setBatchMode(false);
          },
        },
      ]
    );
  };

  const handleWordPress = (word: Word) => {
    if (batchMode) {
      toggleSelectWord(word.id);
    } else {
      setSelectedWord(word);
      setModalVisible(true);
    }
  };

  const handleLongPress = (word: Word) => {
    if (!batchMode) {
      setBatchMode(true);
      toggleSelectWord(word.id);
    }
  };

  const toggleMastered = () => {
    if (selectedWord) {
      updateWord(selectedWord.id, { isMastered: !selectedWord.isMastered });
      setSelectedWord({ ...selectedWord, isMastered: !selectedWord.isMastered });
    }
  };

  const toggleMasteredForWord = (wordId: string) => {
    const word = words.find(w => w.id === wordId);
    if (word) {
      updateWord(wordId, { isMastered: !word.isMastered });
    }
  };

  const confirmDeleteWord = (wordId: string) => {
    const word = words.find(w => w.id === wordId);
    if (!word) return;

    Alert.alert(
      'Delete Word',
      `Are you sure you want to delete "${word.word}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedWords = words.filter((w) => w.id !== wordId);
            deleteWord(wordId);
            const updatedSources = sources.filter((s) => s.wordId !== wordId);
            setSources(updatedSources);
          },
        },
      ]
    );
  };

  const handleDeleteWord = () => {
    if (!selectedWord) return;

    Alert.alert(
      'Delete Word',
      `Are you sure you want to delete "${selectedWord.word}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedWords = words.filter((w) => w.id !== selectedWord.id);
            await StorageService.saveWords(updatedWords);
            
            const updatedSources = sources.filter((s) => s.wordId !== selectedWord.id);
            await StorageService.saveSources(updatedSources);

            useAppStore.setState({ words: updatedWords, sources: updatedSources });
            setModalVisible(false);
          },
        },
      ]
    );
  };

  const renderWordItem = ({ item }: { item: Word }) => (
    <TouchableOpacity 
      style={[
        styles.wordCard, 
        batchMode && selectedWords.includes(item.id) && styles.wordCardSelected
      ]} 
      onPress={() => handleWordPress(item)}
      onLongPress={() => handleLongPress(item)}
    >
      {batchMode && (
        <View style={styles.checkbox}>
          <Text style={styles.checkboxText}>
            {selectedWords.includes(item.id) ? '✓' : ''}
          </Text>
        </View>
      )}
      <View style={styles.wordHeader}>
        <Text style={styles.wordText}>{item.word}</Text>
        <View style={[styles.levelBadge, item.isMastered && styles.masteredBadge]}>
          <Text style={styles.levelText}>
            {item.isMastered ? '✓ Mastered' : item.level}
          </Text>
        </View>
      </View>
      <Text style={styles.meaningText}>{item.meaning}</Text>
      <Text style={styles.sourcesCount}>
        📚 {getSourcesForWord(item.id).length} sources
      </Text>
    </TouchableOpacity>
  );

  const renderSourceItem = (source: Source, index: number) => (
    <View key={source.id} style={[styles.sourceCard, index > 0 && styles.sourceCardMargin]}>
      <Text style={styles.sourceLyric}>"{source.lyricSentence}"</Text>
      <Text style={styles.sourceTranslation}>{source.lyricSentenceEn}</Text>
      <Text style={styles.sourceMeta}>— {source.songTitle}</Text>
    </View>
  );

  if (treasuryStep === 'practice' && practiceWords.length > 0) {
    const currentWord = practiceWords[practiceIndex];
    
    return (
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setTreasuryStep('list')} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Exit</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.practiceContainer} contentContainerStyle={styles.practiceContent} keyboardShouldPersistTaps="handled">
          <View style={styles.practiceProgress}>
            <Text style={styles.practiceProgressText}>
              {practiceIndex + 1} / {practiceWords.length} | Score: {practiceScore}
            </Text>
          </View>
          
          <View style={styles.practiceCard}>
            <Text style={styles.practiceMeaning}>{currentWord.meaning}</Text>
            
            <View style={styles.sentenceContainer}>
              <Text style={styles.sentenceLabel}>Fill in the blank:</Text>
              <Text style={styles.sentenceText}>
                "{practiceSentence?.sentence.replace(new RegExp(currentWord.word, 'gi'), '____') || 'Loading...'}"
              </Text>
              <Text style={styles.sentenceZhText}>
                {practiceSentence?.sentenceZh || ''}
              </Text>
            </View>

            {practiceMode === '4choice' && practiceSentence && (
              <View style={styles.optionsContainer}>
                {practiceSentence.options.map((option: string, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.optionButton,
                      practiceResult && option === currentWord.word && styles.optionCorrect,
                      practiceResult && !practiceResult.isCorrect && option === userAnswer && styles.optionWrong,
                    ]}
                    onPress={() => {
                      if (!practiceResult) {
                        setUserAnswer(option);
                        setPracticeWords([...practiceWords]);
                        const isCorrect = option.toLowerCase() === currentWord.word.toLowerCase();
                        setPracticeResult({
                          isCorrect,
                          score: isCorrect ? 100 : 0,
                          feedback: isCorrect ? 'Correct!' : `The answer is "${currentWord.word}"`
                        });
                        if (isCorrect) {
                          setPracticeScore(practiceScore + 1);
                        }
                      }
                    }}
                    disabled={!!practiceResult}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {practiceMode === 'fill' && (
              <>
                <TextInput
                  style={styles.fillInput}
                  value={userAnswer}
                  onChangeText={setUserAnswer}
                  placeholder="Type your answer..."
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!practiceResult}
                />
              </>
            )}

            {practiceMode === 'translate' && translateQuestion && (
              <>
                <View style={styles.sentenceContainer}>
                  <Text style={styles.sentenceLabel}>Translate to English:</Text>
                  <Text style={styles.sentenceText}>
                    "{translateQuestion.sentenceZh}"
                  </Text>
                  <Text style={styles.sentenceZhText}>
                    Hint: The word is "{translateQuestion.word}"
                  </Text>
                </View>

                <TextInput
                  style={styles.fillInput}
                  value={userAnswer}
                  onChangeText={setUserAnswer}
                  placeholder="Type English translation..."
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!practiceResult}
                />
              </>
            )}

            {practiceResult ? (
              <View style={[styles.resultBox, practiceResult.isCorrect || practiceResult.score >= 70 ? styles.resultCorrect : styles.resultWrong]}>
                <Text style={styles.resultScore}>Score: {practiceResult.score}/100</Text>
                <Text style={styles.resultFeedback}>{practiceResult.feedback}</Text>
                <TouchableOpacity style={styles.nextButton} onPress={nextPractice}>
                  <Text style={styles.nextButtonText}>
                    {practiceIndex < practiceWords.length - 1 ? 'Next →' : 'Finish'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (practiceMode === 'fill' || practiceMode === 'translate') ? (
              <TouchableOpacity
                style={[styles.submitButton, (!userAnswer.trim() || isEvaluating) && styles.submitButtonDisabled]}
                onPress={submitPracticeAnswer}
                disabled={!userAnswer.trim() || isEvaluating}
              >
                <Text style={styles.submitButtonText}>
                  {isEvaluating ? 'Checking...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>The Treasury</Text>
          <Text style={styles.subtitle}>{words.length} words in your library</Text>
        </View>
        <View style={styles.headerButtons}>
          {batchMode && (
            <TouchableOpacity 
              style={styles.batchDeleteButton}
              onPress={handleBatchDelete}
            >
              <Text style={styles.batchDeleteText}>🗑️ ({selectedWords.length})</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.batchButton, batchMode && styles.batchButtonActive]}
            onPress={() => setBatchMode(!batchMode)}
          >
            <Text style={styles.batchButtonText}>{batchMode ? 'Done' : 'Select'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {batchMode && (
        <View style={styles.batchToolbar}>
          <TouchableOpacity onPress={() => { setBatchMode(false); setSelectedWords([]); }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedWords(words.map(w => w.id))}>
            <Text style={styles.selectAllText}>Select All</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.sortContainer}>
        <TouchableOpacity 
          style={[styles.sortButton, filterMode === 'all' && styles.sortButtonActive]}
          onPress={() => setFilterMode('all')}
        >
          <Text style={[styles.sortButtonText, filterMode === 'all' && styles.sortButtonTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sortButton, filterMode === 'learning' && styles.sortButtonActive]}
          onPress={() => setFilterMode('learning')}
        >
          <Text style={[styles.sortButtonText, filterMode === 'learning' && styles.sortButtonTextActive]}>Studying</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sortButton, filterMode === 'mastered' && styles.sortButtonActive]}
          onPress={() => setFilterMode('mastered')}
        >
          <Text style={[styles.sortButtonText, filterMode === 'mastered' && styles.sortButtonTextActive]}>Mastered</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sortContainer}>
        <TouchableOpacity 
          style={[styles.sortButton, sortMode === 'order' && styles.sortButtonActive]}
          onPress={() => setSortMode('order')}
        >
          <Text style={[styles.sortButtonText, sortMode === 'order' && styles.sortButtonTextActive]}>A-Z</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sortButton, sortMode === 'song' && styles.sortButtonActive]}
          onPress={() => setSortMode('song')}
        >
          <Text style={[styles.sortButtonText, sortMode === 'song' && styles.sortButtonTextActive]}>According to Song</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sortButton, sortMode === 'created' && styles.sortButtonActive]}
          onPress={() => setSortMode('created')}
        >
          <Text style={[styles.sortButtonText, sortMode === 'created' && styles.sortButtonTextActive]}>Latest</Text>
        </TouchableOpacity>
      </View>

      {words.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No words yet</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('Factory')}
          >
            <Text style={styles.addButtonText}>Add songs in Factory</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.wordListContainer}>
          <FlatList
            ref={flatListRef}
            data={sortedWords}
            keyExtractor={(item) => item.id}
            renderItem={renderWordItem}
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
              }, 100);
            }}
          />
          
          <View style={styles.indexBar}>
            {alphabet.map((letter) => (
              <TouchableOpacity
                key={letter}
                style={styles.indexItem}
                onPress={() => getWordIndex(letter)}
              >
                <Text style={styles.indexText}>{letter}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedWord && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalWord}>{selectedWord.word}</Text>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <ScrollView showsVerticalScrollIndicator={true}>
                    <Text style={styles.modalMeaning}>{selectedWord.meaning}</Text>
                    
                    <View style={styles.exampleSection}>
                      <Text style={styles.sectionLabel}>Example:</Text>
                      <Text style={styles.exampleText}>"{selectedWord.example}"</Text>
                      {(selectedWord as any).exampleZh && (
                        <Text style={styles.exampleZhText}>{(selectedWord as any).exampleZh}</Text>
                      )}
                    </View>

                    <View style={styles.sourcesSection}>
                      <Text style={styles.sectionLabel}>
                        Sources ({getSourcesForWord(selectedWord.id).length}):
                      </Text>
                      <FlatList
                      data={getSourcesForWord(selectedWord.id)}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item, index }) => renderSourceItem(item, index)}
                      contentContainerStyle={styles.sourcesList}
                    />
                  </View>
                  </ScrollView>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[
                      styles.masteredButton,
                      selectedWord.isMastered && styles.masteredButtonActive,
                    ]}
                    onPress={() => toggleMasteredForWord(selectedWord.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.masteredButtonText,
                      selectedWord.isMastered && styles.masteredButtonTextActive
                    ]}>
                      {selectedWord.isMastered ? '✓ Mastered' : 'Mark as Mastered'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 10,
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
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  batchButton: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  batchButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  batchButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  batchDeleteButton: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  batchDeleteText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  wordListContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  wordList: {
    flex: 1,
  },
  indexBar: {
    width: 30,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 15,
    marginRight: 4,
    justifyContent: 'center',
  },
  indexItem: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  indexText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  wordCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  wordCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  wordCardButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  masterButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  masterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  masterButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 10,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  deleteButtonText: {
    color: '#F44336',
    fontWeight: '600',
    fontSize: 14,
  },
  checkbox: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  batchToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  selectAllText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  wordText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  levelBadge: {
    backgroundColor: COLORS.primary + '30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  masteredBadge: {
    backgroundColor: COLORS.success + '30',
  },
  levelText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  meaningText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  sourcesCount: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addButtonText: {
    color: COLORS.text,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    flex: 1,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalWord: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  modalBody: {
    flex: 1,
    marginBottom: 20,
  },
  modalMeaning: {
    fontSize: 20,
    color: COLORS.primary,
    marginBottom: 20,
  },
  exampleSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 16,
    color: COLORS.text,
    fontStyle: 'italic',
  },
  exampleZhText: {
    fontSize: 14,
    color: COLORS.secondary,
    marginTop: 6,
  },
  sourcesSection: {
    marginBottom: 20,
  },
  sourcesList: {
    paddingRight: 20,
  },
  sourceCard: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 14,
    width: 280,
  },
  sourceCardMargin: {
    marginLeft: 12,
  },
  sourceLyric: {
    fontSize: 14,
    color: COLORS.text,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  sourceTranslation: {
    fontSize: 13,
    color: COLORS.secondary,
    marginBottom: 6,
  },
  sourceMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  masteredButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  masteredButtonActive: {
    backgroundColor: COLORS.success,
  },
  masteredButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  masteredButtonTextActive: {
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  practiceButtonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 10,
  },
  practiceButton4Choice: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  practiceButtonFill: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  practiceButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 10,
  },
  sortButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortButtonActive: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
  },
  sortButtonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  sortButtonTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  practiceContainer: {
    flex: 1,
  },
  practiceContent: {
    padding: 20,
  },
  practiceProgress: {
    alignItems: 'center',
    marginBottom: 20,
  },
  practiceProgressText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  practiceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
  },
  practiceMeaning: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  sentenceContainer: {
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  sentenceLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  sentenceText: {
    fontSize: 18,
    color: COLORS.text,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  sentenceZhText: {
    fontSize: 14,
    color: COLORS.secondary,
  },
  optionsContainer: {
    gap: 10,
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  optionCorrect: {
    backgroundColor: COLORS.success + '30',
    borderColor: COLORS.success,
  },
  optionWrong: {
    backgroundColor: COLORS.error + '30',
    borderColor: COLORS.error,
  },
  optionText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  fillInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    color: COLORS.text,
    borderWidth: 2,
    borderColor: COLORS.border,
    textAlign: 'center',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultBox: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  resultCorrect: {
    backgroundColor: COLORS.success,
  },
  resultWrong: {
    backgroundColor: COLORS.error,
  },
  resultScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  resultFeedback: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 12,
  },
  nextButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

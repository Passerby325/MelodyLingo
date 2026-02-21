import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { COLORS } from '../constants';
import { useAppStore } from '../store';
import { Word, Source, Song } from '../types';
import { evaluateAnswer, AnswerEvaluation } from '../services/gemini';

interface ArenaScreenProps {
  navigation: any;
}

type ChallengeMode = '4choice' | 'fill';
type ArenaStep = 'settings' | 'songSelect' | 'challenge';

interface Challenge {
  word: Word;
  sentence: string;
  sentenceEn: string;
  sentenceEnWithBlank: string;
  sentenceOriginal: string;
  correctAnswer: string;
  options: string[];
  selectedAnswer?: string;
  songTitle: string;
  replaceWord: string;
}

export const ArenaScreen: React.FC<ArenaScreenProps> = ({ navigation }) => {
  const { words, sources, songs, settings, addWrongAnswer } = useAppStore();
  
  const [arenaStep, setArenaStep] = useState<ArenaStep>('settings');
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<'single' | 'all'>('all');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [wordCount, setWordCount] = useState(5);
  const [challengeMode, setChallengeMode] = useState<ChallengeMode>('fill');
  
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [hintLevel, setHintLevel] = useState(0);
  const [score, setScore] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<AnswerEvaluation | null>(null);

  const sortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => b.createdAt - a.createdAt);
  }, [songs]);

  const availableSongs = useMemo(() => {
    let filtered = sortedSongs;
    if (searchQuery) {
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [sortedSongs, searchQuery]);

  const availableWords = useMemo(() => {
    let filtered = words.filter(w => !w.isMastered);
    if (mode === 'single' && selectedSong) {
      const songSources = sources.filter(s => s.songTitle === selectedSong.title);
      const wordIds = [...new Set(songSources.map(s => s.wordId))];
      filtered = filtered.filter(w => wordIds.includes(w.id));
    }
    return filtered;
  }, [mode, selectedSong, words, sources]);

  const goToSongSelect = () => {
    if (mode === 'all') {
      startChallenge();
    } else {
      setArenaStep('songSelect');
    }
  };

  const startChallenge = () => {
    if (availableWords.length < 4) {
      Alert.alert('Not enough words', 'Need at least 4 words to start');
      return;
    }

    const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
    const selectedWords = shuffled.slice(0, Math.min(wordCount, shuffled.length));
    
    const newChallenges: Challenge[] = selectedWords.map(word => {
      const wordSources = sources.filter(s => s.wordId === word.id);
      const source = wordSources[Math.floor(Math.random() * wordSources.length)];
      
      const otherWords = words.filter(w => w.id !== word.id);
      const shuffledOthers = [...otherWords].sort(() => Math.random() - 0.5).slice(0, 3);
      
      const options = [word, ...shuffledOthers].map(w => w.word).sort(() => Math.random() - 0.5);
      
      const sentenceRaw = source?.lyricSentence || word.example || '';
      const sentenceEnRaw = source?.lyricSentenceEn || word.example || '';
      
      const replaceWordStr = source?.replaceWord || word.meaning || word.word;
      const regex = new RegExp(replaceWordStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const sentenceWithBlank = sentenceRaw.replace(regex, '____');
      
      const wordRegex = new RegExp(word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const sentenceEnWithBlank = sentenceEnRaw.replace(wordRegex, '____');
      
      return {
        word,
        sentence: sentenceWithBlank,
        sentenceEn: sentenceEnWithBlank,
        sentenceEnWithBlank: sentenceEnWithBlank,
        sentenceOriginal: sentenceRaw,
        correctAnswer: word.word,
        options,
        songTitle: source?.songTitle || '',
        replaceWord: replaceWordStr,
      };
    });

    setChallenges(newChallenges);
    setCurrentIndex(0);
    setScore(0);
    setHintLevel(0);
    setSelectedAnswer(null);
    setUserInput('');
    setArenaStep('challenge');
  };

  const handleSubmit = async () => {
    if (challengeMode === 'fill' && userInput.trim()) {
      const currentChallenge = challenges[currentIndex];
      setIsEvaluating(true);
      
      try {
        const result = await evaluateAnswer(
          userInput.trim(),
          currentChallenge.correctAnswer,
          currentChallenge.sentence,
          currentChallenge.sentenceEn,
          currentChallenge.word.meaning,
          settings
        );
        
        setEvaluationResult(result);
        
        if (result.isCorrect || result.score >= 70) {
          setSelectedAnswer('correct');
          setScore(score + 1);
        } else {
          setSelectedAnswer('wrong');
          addWrongAnswer({
            id: Date.now().toString() + Math.random(),
            wordId: currentChallenge.word.id,
            word: currentChallenge.word.word,
            meaning: currentChallenge.word.meaning,
            userAnswer: userInput.trim(),
            correctAnswer: currentChallenge.correctAnswer,
            sentence: currentChallenge.sentence,
            sentenceEn: currentChallenge.sentenceEn,
            score: result.score,
            feedback: result.feedback,
            songTitle: currentChallenge.songTitle,
            createdAt: Date.now(),
            errorType: 'fill',
          });
        }
      } catch (error: any) {
        console.error('Evaluation error:', error);
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        Alert.alert('API请求失败', `评估出错: ${errorMessage}`);
        const isCorrect = userInput.trim().toLowerCase() === currentChallenge.correctAnswer.toLowerCase();
        setSelectedAnswer(isCorrect ? 'correct' : 'wrong');
        if (isCorrect) {
          setScore(score + 1);
        } else {
          addWrongAnswer({
            id: Date.now().toString() + Math.random(),
            wordId: currentChallenge.word.id,
            word: currentChallenge.word.word,
            meaning: currentChallenge.word.meaning,
            userAnswer: userInput.trim(),
            correctAnswer: currentChallenge.correctAnswer,
            sentence: currentChallenge.sentence,
            sentenceEn: currentChallenge.sentenceEn,
            score: 0,
            feedback: 'Evaluation failed',
            songTitle: currentChallenge.songTitle,
            createdAt: Date.now(),
            errorType: 'fill',
          });
        }
      } finally {
        setIsEvaluating(false);
      }
    }
  };

  const handleSelectOption = (answer: string) => {
    const currentChallenge = challenges[currentIndex];
    const isCorrect = answer === currentChallenge.word.word;
    
    setChallenges(prev => {
      const updated = [...prev];
      updated[currentIndex] = { ...updated[currentIndex], selectedAnswer: answer };
      return updated;
    });
    setSelectedAnswer(isCorrect ? 'correct' : 'wrong');
    
    if (isCorrect) {
      setScore(score + 1);
    } else {
      addWrongAnswer({
        id: Date.now().toString() + Math.random(),
        wordId: currentChallenge.word.id,
        word: currentChallenge.word.word,
        meaning: currentChallenge.word.meaning,
        userAnswer: answer,
        correctAnswer: currentChallenge.correctAnswer,
        sentence: currentChallenge.sentence,
        sentenceEn: currentChallenge.sentenceEn,
        score: 0,
        feedback: 'Wrong answer selected',
        songTitle: currentChallenge.songTitle,
        createdAt: Date.now(),
        errorType: '4choice',
      });
    }
  };

  const nextChallenge = () => {
    if (currentIndex < challenges.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setUserInput('');
      setHintLevel(0);
    } else {
      Alert.alert(
        'Challenge Complete!',
        `You got ${score}/${challenges.length} correct!`,
        [{ text: 'OK', onPress: () => setArenaStep('settings') }]
      );
    }
  };

  const showHint = () => {
    if (hintLevel >= 2) return;
    setHintLevel(hintLevel + 1);
  };

  const getHint = () => {
    if (!challenges[currentIndex]) return '';
    const word = challenges[currentIndex].word;
    switch (hintLevel) {
      case 0:
        return '';
      case 1:
        return challenges[currentIndex].replaceWord;
      case 2:
        return word.word.charAt(0).toUpperCase() + '...';
      default:
        return '';
    }
  };

  const getFullHint = () => {
    if (hintLevel >= 2 && challenges[currentIndex]) {
      return challenges[currentIndex].sentence;
    }
    return '';
  };

  if (arenaStep === 'settings') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>The Arena</Text>
            <Text style={styles.subtitle}>Configure your challenge</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Challenge Mode</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeButton, challengeMode === '4choice' && styles.modeButtonActive]}
              onPress={() => setChallengeMode('4choice')}
            >
              <Text style={[styles.modeButtonText, challengeMode === '4choice' && styles.modeButtonTextActive]}>
                MCQ
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, challengeMode === 'fill' && styles.modeButtonActive]}
              onPress={() => setChallengeMode('fill')}
            >
              <Text style={[styles.modeButtonText, challengeMode === 'fill' && styles.modeButtonTextActive]}>
                Fill in
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Word Count: {wordCount}</Text>
          <View style={styles.countRow}>
            {[5, 10, 15, 20].map(count => (
              <TouchableOpacity
                key={count}
                style={[styles.countButton, wordCount === count && styles.countButtonActive]}
                onPress={() => setWordCount(count)}
              >
                <Text style={[styles.countButtonText, wordCount === count && styles.countButtonTextActive]}>
                  {count}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Mode</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'single' && styles.modeButtonActive]}
              onPress={() => setMode('single')}
            >
              <Text style={[styles.modeButtonText, mode === 'single' && styles.modeButtonTextActive]}>
                Single Song
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'all' && styles.modeButtonActive]}
              onPress={() => { setMode('all'); setSelectedSong(null); }}
            >
              <Text style={[styles.modeButtonText, mode === 'all' && styles.modeButtonTextActive]}>
                All Songs
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            Available: {availableWords.length} words
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.nextButton, availableWords.length < 4 && styles.nextButtonDisabled]}
          onPress={goToSongSelect}
          disabled={availableWords.length < 4}
        >
          <Text style={styles.nextButtonText}>{mode === 'single' ? 'Next →' : 'Start →'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (arenaStep === 'songSelect') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setArenaStep('settings')}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Select Song</Text>
        <Text style={styles.subtitle}>Choose a song to practice</Text>

        {mode === 'single' && (
          <View style={styles.section}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by song title..."
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        )}

        <View style={styles.songGrid}>
          {availableSongs.map(song => {
            const songSources = sources.filter(src => src.songTitle === song.title);
            const wordCount = [...new Set(songSources.map(s => s.wordId))].length;
            
            return (
              <TouchableOpacity
                key={song.id}
                style={[styles.songCard, selectedSong?.id === song.id && styles.songCardSelected]}
                onPress={() => {
                  if (mode === 'single') {
                    setSelectedSong(song);
                  }
                }}
              >
                <Text style={styles.songCardTitle}>{song.title}</Text>
                <Text style={styles.songCardCount}>{wordCount} words</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {availableSongs.length === 0 && (
          <Text style={styles.emptyText}>No songs found</Text>
        )}

        <TouchableOpacity
          style={[
            styles.startButton,
            mode === 'single' && !selectedSong && styles.startButtonDisabled
          ]}
          onPress={() => {
            if (mode === 'single' && !selectedSong) {
              Alert.alert('Please select a song first');
              return;
            }
            startChallenge();
          }}
        >
          <Text style={styles.startButtonText}>🚀 Start Challenge</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const currentChallenge = challenges[currentIndex];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setArenaStep('settings')}>
          <Text style={styles.exitText}>Exit</Text>
        </TouchableOpacity>
        <Text style={styles.progress}>
          {currentIndex + 1} / {challenges.length}
        </Text>
        <Text style={styles.score}>Score: {score}</Text>
      </View>

      <ScrollView style={styles.challengeScrollView} contentContainerStyle={styles.challengeScrollContent}>
        <View style={styles.songSourceContainer}>
          <Text style={styles.songSourceText}>🎵 {currentChallenge.songTitle}</Text>
        </View>
        <View style={styles.challengeContainer}>
          <Text style={styles.sentenceText}>
            "{currentChallenge.sentence}"
          </Text>
          
          {currentChallenge.sentenceEn && (
            <Text style={styles.sentenceEnText}>
              "{currentChallenge.sentenceEn}"
            </Text>
          )}
        </View>

      {challengeMode === '4choice' ? (
        <View style={styles.optionsContainer}>
          {currentChallenge.options.map((option, index) => {
            const isCorrect = option === currentChallenge.word.word;
            const isSelected = selectedAnswer !== null && option === currentChallenge.selectedAnswer;
            const showAsCorrect = selectedAnswer !== null && isCorrect;
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  isSelected && selectedAnswer === 'wrong' && styles.optionWrong,
                  showAsCorrect && styles.optionCorrect,
                ]}
                onPress={() => !selectedAnswer && handleSelectOption(option)}
                disabled={!!selectedAnswer}
              >
                <Text style={styles.optionText}>{option}</Text>
                {showAsCorrect && <Text style={styles.correctBadge}>✓</Text>}
                {isSelected && selectedAnswer === 'wrong' && <Text style={styles.wrongBadge}>✗</Text>}
              </TouchableOpacity>
            );
          })}
          {selectedAnswer === 'wrong' && (
            <View style={styles.correctAnswerContainer}>
              <Text style={styles.correctAnswerText}>
                Correct answer: {currentChallenge.correctAnswer}
              </Text>
              <Text style={styles.correctAnswerText}>
                正确答案: {currentChallenge.correctAnswer}
              </Text>
              <Text style={styles.fullHintText}>
                原文: {currentChallenge.sentenceOriginal}
              </Text>
            </View>
          )}
          {selectedAnswer === 'correct' && (
            <View style={styles.correctAnswerContainer}>
              <Text style={[styles.correctAnswerText, { color: COLORS.success }]}>
                Correct! ✓
              </Text>
              <Text style={styles.correctAnswerText}>
                正确答案: {currentChallenge.correctAnswer}
              </Text>
              <Text style={styles.fullHintText}>
                原文: {currentChallenge.sentenceOriginal}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.fillContainer}>
          <Text style={styles.fillLabel}>Fill in the blank (AI evaluated):</Text>
          
          {!selectedAnswer && (
            <>
              <TextInput
                style={styles.fillInput}
                value={userInput}
                onChangeText={setUserInput}
                placeholder="Type your answer..."
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isEvaluating}
              />
              <TouchableOpacity 
                style={[styles.submitButton, isEvaluating && styles.submitButtonDisabled]} 
                onPress={handleSubmit}
                disabled={isEvaluating || !userInput.trim()}
              >
                <Text style={styles.submitButtonText}>
                  {isEvaluating ? '⏳ AI Evaluating...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </>
          )}
          
          {selectedAnswer && evaluationResult && (
            <>
              <View style={[styles.evaluationResult, selectedAnswer === 'correct' ? styles.fillCorrect : styles.fillWrong]}>
                <Text style={styles.evaluationScore}>Score: {evaluationResult.score}/100</Text>
                <Text style={styles.evaluationFeedback}>{evaluationResult.feedback}</Text>
              </View>
              <Text style={styles.correctAnswerText}>
                正确答案: {currentChallenge.correctAnswer}
              </Text>
              <Text style={styles.fullHintText}>
                原文: {currentChallenge.sentenceOriginal}
              </Text>
            </>
          )}
        </View>
      )}

      {hintLevel > 0 && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>{getHint()}</Text>
          {hintLevel >= 2 && (
            <Text style={styles.fullHintText}>"{getFullHint()}"</Text>
          )}
        </View>
      )}

      <View style={styles.hintActions}>
        {hintLevel < 2 && !selectedAnswer && (
          <TouchableOpacity style={styles.hintButton} onPress={showHint}>
            <Text style={styles.hintButtonText}>
              💡 {hintLevel === 0 ? 'Hint 1' : hintLevel === 1 ? 'Hint 2' : 'Hint 3'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actionRow}>
        {selectedAnswer ? (
          <TouchableOpacity style={styles.nextButtonLarge} onPress={nextChallenge}>
            <Text style={styles.nextButtonLargeText}>
              {currentIndex < challenges.length - 1 ? 'Next →' : 'Finish'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
      </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  headerRow: {
    marginBottom: 16,
  },
  backText: {
    color: COLORS.primary,
    fontSize: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
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
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 30,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  modeButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '20',
  },
  modeButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: COLORS.primary,
  },
  countRow: {
    flexDirection: 'row',
    gap: 12,
  },
  countButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  countButtonActive: {
    backgroundColor: COLORS.primary,
  },
  countButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  countButtonTextActive: {
    color: COLORS.text,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRow: {
    marginBottom: 20,
  },
  infoText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  songGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  songCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
  },
  songCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  songCardTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  songCardCount: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginVertical: 20,
  },
  startButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  exitText: {
    color: COLORS.error,
    fontSize: 16,
  },
  progress: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  score: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: '600',
  },
  challengeScrollView: {
    flex: 1,
  },
  challengeScrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  songSourceContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  songSourceText: {
    fontSize: 14,
    color: COLORS.secondary,
    textAlign: 'center',
  },
  challengeContainer: {
    backgroundColor: COLORS.surface,
    margin: 20,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
  },
  sentenceText: {
    fontSize: 20,
    color: COLORS.text,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 30,
  },
  sentenceEnText: {
    fontSize: 14,
    color: COLORS.secondary,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  optionsContainer: {
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  optionButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
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
    textAlign: 'center',
  },
  correctBadge: {
    position: 'absolute',
    right: 12,
    color: COLORS.success,
    fontSize: 16,
    fontWeight: 'bold',
  },
  wrongBadge: {
    position: 'absolute',
    right: 12,
    color: COLORS.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
  correctAnswerContainer: {
    backgroundColor: COLORS.success + '20',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  correctAnswerText: {
    color: COLORS.success,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  fillContainer: {
    padding: 20,
    paddingTop: 0,
  },
  fillInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    color: COLORS.text,
    borderWidth: 2,
    borderColor: COLORS.border,
    textAlign: 'center',
    marginBottom: 12,
  },
  fillLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  fillResult: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '600',
  },
  fillCorrect: {
    color: '#fff',
    backgroundColor: COLORS.success,
    padding: 16,
    borderRadius: 12,
  },
  fillWrong: {
    color: '#fff',
    backgroundColor: COLORS.error,
    padding: 16,
    borderRadius: 12,
  },
  evaluationResult: {
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  evaluationScore: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  evaluationFeedback: {
    fontSize: 14,
    textAlign: 'center',
  },
  hintContainer: {
    padding: 20,
    paddingTop: 0,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 18,
    color: COLORS.warning,
    fontWeight: '600',
    marginBottom: 8,
  },
  fullHintText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  hintActions: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  hintButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  hintButtonText: {
    color: COLORS.warning,
    fontSize: 16,
  },
  actionRow: {
    padding: 20,
  },
  nextButtonLarge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  nextButtonLargeText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { COLORS } from '../constants';
import { useAppStore } from '../store';
import { WrongAnswer } from '../types';
import { evaluateAnswer } from '../services/gemini';

interface ReviewScreenProps {
  navigation: any;
}

export const ReviewScreen: React.FC<ReviewScreenProps> = ({ navigation }) => {
  const { wrongAnswers, removeWrongAnswer, clearWrongAnswers } = useAppStore();
  const [mode, setMode] = useState<'list' | 'practice'>('list');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; score: number; feedback: string } | null>(null);
  const [practiceAnswers, setPracticeAnswers] = useState<WrongAnswer[]>([]);
  const [score, setScore] = useState(0);

  const handleClearAll = () => {
    clearWrongAnswers();
  };

  const startPractice = () => {
    if (wrongAnswers.length === 0) return;
    setPracticeAnswers([...wrongAnswers]);
    setCurrentIndex(0);
    setScore(0);
    setUserAnswer('');
    setResult(null);
    setMode('practice');
  };

  const handleSubmitAnswer = async () => {
    if (!practiceAnswers[currentIndex] || !userAnswer.trim()) return;
    
    const currentItem = practiceAnswers[currentIndex];
    setIsEvaluating(true);
    
    try {
      const evalResult = await evaluateAnswer(
        userAnswer.trim(),
        currentItem.correctAnswer,
        currentItem.sentence,
        currentItem.sentenceEn,
        currentItem.meaning,
        useAppStore.getState().settings
      );
      setResult(evalResult);
      
      if (evalResult.isCorrect || evalResult.score >= 70) {
        setScore(score + 1);
        removeWrongAnswer(currentItem.id);
      }
    } catch (error) {
      const isCorrect = userAnswer.trim().toLowerCase() === currentItem.correctAnswer.toLowerCase();
      setResult({
        isCorrect,
        score: isCorrect ? 100 : 0,
        feedback: isCorrect ? 'Correct!' : 'Wrong answer',
      });
      if (isCorrect) {
        setScore(score + 1);
        removeWrongAnswer(currentItem.id);
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < practiceAnswers.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer('');
      setResult(null);
    } else {
      setMode('list');
    }
  };

  const renderListItem = ({ item }: { item: WrongAnswer }) => (
    <TouchableOpacity style={styles.card} onPress={() => {
      setPracticeAnswers([item]);
      setCurrentIndex(0);
      setUserAnswer('');
      setResult(null);
      setMode('practice');
    }}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.wordText}>{item.word}</Text>
          {item.songTitle && (
            <Text style={styles.songText}>🎵 {item.songTitle}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => removeWrongAnswer(item.id)}>
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.meaningText}>{item.meaning}</Text>
      
      <View style={styles.answerRow}>
        <View style={styles.answerBox}>
          <Text style={styles.answerLabel}>Your answer:</Text>
          <Text style={styles.userAnswer}>{item.userAnswer}</Text>
        </View>
        <View style={styles.answerBox}>
          <Text style={styles.answerLabel}>Correct:</Text>
          <Text style={styles.correctAnswer}>{item.correctAnswer}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (mode === 'practice' && practiceAnswers.length > 0) {
    const currentItem = practiceAnswers[currentIndex];
    
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('list')} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Exit Practice</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Practice</Text>
          <Text style={styles.subtitle}>
            {currentIndex + 1} / {practiceAnswers.length} | Score: {score}
          </Text>
        </View>

        <ScrollView style={styles.practiceContainer} contentContainerStyle={styles.practiceContent}>
          <View style={styles.practiceCard}>
            <Text style={styles.practiceWord}>{currentItem.word}</Text>
            <Text style={styles.practiceMeaning}>{currentItem.meaning}</Text>
            
            <View style={styles.sentenceContainer}>
              <Text style={styles.sentenceLabel}>Sentence:</Text>
              <Text style={styles.sentenceText}>"{currentItem.sentence}"</Text>
              <Text style={styles.sentenceEnText}>{currentItem.sentenceEn}</Text>
            </View>

            {!result ? (
              <>
                <TextInput
                  style={styles.input}
                  value={userAnswer}
                  onChangeText={setUserAnswer}
                  placeholder="Type your answer..."
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity 
                  style={[styles.submitButton, isEvaluating && styles.submitButtonDisabled]}
                  onPress={handleSubmitAnswer}
                  disabled={isEvaluating || !userAnswer.trim()}
                >
                  <Text style={styles.submitButtonText}>
                    {isEvaluating ? 'Checking...' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={[styles.resultBox, result.isCorrect || result.score >= 70 ? styles.resultCorrect : styles.resultWrong]}>
                <Text style={styles.resultScore}>Score: {result.score}/100</Text>
                <Text style={styles.resultFeedback}>{result.feedback}</Text>
                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                  <Text style={styles.nextButtonText}>
                    {currentIndex < practiceAnswers.length - 1 ? 'Next →' : 'Finish'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  const sortedWrongAnswers = [...wrongAnswers].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Review Wrong Answers</Text>
        <Text style={styles.subtitle}>{wrongAnswers.length} items to review</Text>
      </View>

      {wrongAnswers.length > 0 && (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.practiceAllButton} onPress={startPractice}>
            <Text style={styles.practiceAllButtonText}>🎯 Practice All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}

      {sortedWrongAnswers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No wrong answers yet!</Text>
          <Text style={styles.emptySubtext}>Keep practicing to improve</Text>
        </View>
      ) : (
        <FlatList
          data={sortedWrongAnswers}
          keyExtractor={(item) => item.id}
          renderItem={renderListItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 10,
  },
  practiceAllButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  practiceAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: COLORS.error,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  wordText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  songText: {
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 2,
  },
  deleteText: {
    color: COLORS.textMuted,
    fontSize: 18,
    padding: 4,
  },
  meaningText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  answerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  answerBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 10,
    borderRadius: 8,
  },
  answerLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  userAnswer: {
    fontSize: 14,
    color: COLORS.error,
    fontWeight: '600',
  },
  correctAnswer: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '600',
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
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  practiceContainer: {
    flex: 1,
  },
  practiceContent: {
    padding: 20,
    paddingTop: 0,
  },
  practiceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
  },
  practiceWord: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  practiceMeaning: {
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  sentenceContainer: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  sentenceLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  sentenceText: {
    fontSize: 16,
    color: COLORS.text,
    fontStyle: 'italic',
  },
  sentenceEnText: {
    fontSize: 14,
    color: COLORS.secondary,
    marginTop: 4,
  },
  input: {
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
    fontSize: 20,
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

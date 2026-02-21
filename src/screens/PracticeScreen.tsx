import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS } from '../constants';
import { useAppStore } from '../store';
import { Word } from '../types';
import { generatePracticeSentence, evaluateAnswer, generateTranslateQuestion, evaluateTranslation } from '../services/gemini';

type WordRange = 'all' | 'learning' | 'mastered';
type PracticeMode = '4choice' | 'fill' | 'translate';
type PracticeStep = 'select' | 'practice';

interface PracticeSentence {
  sentence: string;
  sentenceZh: string;
  replaceWord: string;
}

interface TranslateQuestion {
  word: string;
  sentenceZh: string;
}

interface PracticeScreenProps {
  navigation: any;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({ navigation }) => {
  const { words, settings, addWrongAnswer } = useAppStore();
  
  const [wordRange, setWordRange] = useState<WordRange>('all');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('fill');
  const [practiceStep, setPracticeStep] = useState<PracticeStep>('select');
  const [questionCount, setQuestionCount] = useState(10);
  
  const [practiceWords, setPracticeWords] = useState<Word[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceScore, setPracticeScore] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [practiceSentence, setPracticeSentence] = useState<PracticeSentence | null>(null);
  const [translateQuestion, setTranslateQuestion] = useState<TranslateQuestion | null>(null);
  const [practiceResult, setPracticeResult] = useState<{ isCorrect: boolean; score: number; feedback: string; userAnswer?: string; correctAnswer?: string } | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);

  const wordRangeOptions: { value: WordRange; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'learning', label: 'Studying' },
    { value: 'mastered', label: 'Mastered' },
  ];

  const practiceModeOptions: { value: PracticeMode; label: string }[] = [
    { value: '4choice', label: 'MCQ' },
    { value: 'fill', label: 'Fill in' },
    { value: 'translate', label: 'Translation' },
  ];

  const getAvailableWords = (): Word[] => {
    let available = [...words];
    if (wordRange === 'mastered') {
      available = available.filter(w => w.isMastered);
    } else if (wordRange === 'learning') {
      available = available.filter(w => !w.isMastered);
    }
    return available;
  };

  const generateOptions = (correctWord: Word, allWords: Word[]): string[] => {
    const otherWords = allWords
      .filter(w => w.id !== correctWord.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(w => w.word);
    
    const options = [correctWord.word, ...otherWords];
    return options.sort(() => Math.random() - 0.5);
  };

  const startPractice = () => {
    const availableWords = getAvailableWords();
    const maxQuestions = Math.min(questionCount, availableWords.length);
    
    if (availableWords.length < 4) {
      Alert.alert('Not enough words', 'Need at least 4 words to practice');
      return;
    }

    if (questionCount > availableWords.length) {
      Alert.alert('Too many questions', `Only ${availableWords.length} words available`);
      return;
    }

    const shuffled = [...availableWords].sort(() => Math.random() - 0.5).slice(0, maxQuestions);
    setPracticeWords(shuffled);
    setPracticeIndex(0);
    setPracticeScore(0);
    setUserAnswer('');
    setPracticeResult(null);
    setPracticeStep('practice');
    setSelectedAnswer(null);

    if (practiceMode === '4choice') {
      const currentOptions = generateOptions(shuffled[0], shuffled);
      setOptions(currentOptions);
      loadPracticeSentence(shuffled[0], shuffled);
    } else if (practiceMode === 'translate') {
      loadTranslateQuestion(shuffled[0]);
    } else {
      loadPracticeSentence(shuffled[0], shuffled);
    }
  };

  const loadTranslateQuestion = async (word: Word) => {
    setTranslateQuestion(null);
    setUserAnswer('');
    setPracticeResult(null);
    setSelectedAnswer(null);
    
    const result = await generateTranslateQuestion(word.word, word.meaning, settings);
    if (result.error) {
      Alert.alert('API Request Failed', result.error);
      return;
    }
    setTranslateQuestion(result);
  };

  const loadPracticeSentence = async (word: Word, allWords: Word[]) => {
    setPracticeSentence(null);
    setUserAnswer('');
    setPracticeResult(null);
    setSelectedAnswer(null);
    
    const otherWords = allWords.filter(w => w.id !== word.id).map(w => w.word);
    const replaceWord = word.meaning.split('：')[0] || word.meaning.split(':')[0] || '';
    const result = await generatePracticeSentence(word.word, word.meaning, otherWords, settings, replaceWord);
    if (result.error) {
      Alert.alert('API Request Failed', result.error);
      return;
    }
    setPracticeSentence(result);
  };

  const handleSelectOption = (answer: string) => {
    const currentWord = practiceWords[practiceIndex];
    const isCorrect = answer.toLowerCase() === currentWord.word.toLowerCase();
    
    setSelectedAnswer(answer);
    
    const result = {
      isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect ? 'Correct!' : `The answer is "${currentWord.word}"`
    };
    setPracticeResult(result);
    
    if (isCorrect) {
      setPracticeScore(prev => prev + 1);
    } else {
      addWrongAnswer({
        id: Date.now().toString() + Math.random(),
        wordId: currentWord.id,
        word: currentWord.word,
        meaning: currentWord.meaning,
        userAnswer: answer,
        correctAnswer: currentWord.word,
        sentence: practiceSentence?.sentence || '',
        sentenceEn: practiceSentence?.sentenceZh || '',
        score: 0,
        feedback: 'Wrong answer selected',
        songTitle: '',
        createdAt: Date.now(),
        errorType: '4choice',
      });
    }
  };

  const submitAnswer = async () => {
    if ((!practiceSentence && practiceMode !== 'translate') || !userAnswer.trim()) return;
    
    const currentWord = practiceWords[practiceIndex];
    setIsEvaluating(true);
    
    try {
      let result: { isCorrect: boolean; score: number; feedback: string; userAnswer?: string; correctAnswer?: string };
      
      if (practiceMode === 'translate' && translateQuestion) {
        const evalResult = await evaluateTranslation(
          userAnswer.trim(),
          translateQuestion.sentenceZh,
          settings
        );
        if (evalResult.error) {
          Alert.alert('API Request Failed', evalResult.error);
          setIsEvaluating(false);
          return;
        }
        result = evalResult;
        setPracticeResult(result);
        if (result.isCorrect || result.score >= 70) {
          setPracticeScore(prev => prev + 1);
        } else {
          addWrongAnswer({
            id: Date.now().toString() + Math.random(),
            wordId: currentWord.id,
            word: currentWord.word,
            meaning: currentWord.meaning,
            userAnswer: userAnswer.trim(),
            correctAnswer: result.correctAnswer,
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
        const evalResult = await evaluateAnswer(
          userAnswer.trim(),
          currentWord.word,
          practiceSentence!.sentence,
          practiceSentence!.sentenceZh,
          currentWord.meaning,
          settings
        );
        if (evalResult.error) {
          Alert.alert('API Request Failed', evalResult.error);
          setIsEvaluating(false);
          return;
        }
        result = evalResult;
        setPracticeResult(result);
        if (result.isCorrect || result.score >= 70) {
          setPracticeScore(prev => prev + 1);
        } else {
          addWrongAnswer({
            id: Date.now().toString() + Math.random(),
            wordId: currentWord.id,
            word: currentWord.word,
            meaning: currentWord.meaning,
            userAnswer: userAnswer.trim(),
            correctAnswer: currentWord.word,
            sentence: practiceSentence!.sentence,
            sentenceEn: practiceSentence!.sentenceZh,
            score: result.score,
            feedback: result.feedback,
            songTitle: '',
            createdAt: Date.now(),
            errorType: 'fill',
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
      if (isCorrect) setPracticeScore(prev => prev + 1);
    } finally {
      setIsEvaluating(false);
    }
  };

  const nextQuestion = () => {
    if (practiceIndex < practiceWords.length - 1) {
      const nextIdx = practiceIndex + 1;
      
      setPracticeIndex(nextIdx);
      setSelectedAnswer(null);
      setUserAnswer('');
      setPracticeResult(null);
      
      if (practiceMode === '4choice') {
        const currentOptions = generateOptions(practiceWords[nextIdx], practiceWords);
        setOptions(currentOptions);
        loadPracticeSentence(practiceWords[nextIdx], practiceWords);
      } else if (practiceMode === 'translate') {
        loadTranslateQuestion(practiceWords[nextIdx]);
      } else {
        loadPracticeSentence(practiceWords[nextIdx], practiceWords);
      }
    } else {
      Alert.alert(
        'Practice Complete!',
        `You got ${practiceScore}/${practiceWords.length} correct!`,
        [{ text: 'OK', onPress: () => setPracticeStep('select') }]
      );
    }
  };

  if (practiceStep === 'practice' && practiceWords.length > 0) {
    const currentWord = practiceWords[practiceIndex];
    
    return (
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setPracticeStep('select')} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Exit</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Practice</Text>
          <Text style={styles.subtitle}>
            {practiceIndex + 1} / {practiceWords.length} | Score: {practiceScore}
          </Text>
        </View>

        <ScrollView style={styles.practiceContainer} contentContainerStyle={styles.practiceContent} keyboardShouldPersistTaps="handled">
          <View style={styles.practiceCard}>
            {practiceMode === 'translate' ? (
              <>
                <Text style={styles.practiceWord}>{currentWord.word}</Text>
                <View style={styles.sentenceContainer}>
                  <Text style={styles.sentenceLabel}>Translate to English:</Text>
                  <Text style={styles.sentenceText}>"{translateQuestion?.sentenceZh}"</Text>
                </View>
              </>
            ) : practiceMode === '4choice' ? (
              <>
                <View style={styles.sentenceContainer}>
                  <Text style={styles.sentenceText}>"{practiceSentence?.sentence?.replace(new RegExp(currentWord.word, 'gi'), '____')}"</Text>
                  <Text style={styles.sentenceEnText}>"{practiceSentence?.sentenceZh}"</Text>
                </View>
                <View style={styles.optionsGrid}>
                  {options.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.optionButton,
                        selectedAnswer === option && (option === currentWord.word ? styles.optionCorrect : styles.optionWrong)
                      ]}
                      onPress={() => !practiceResult && handleSelectOption(option)}
                      disabled={!!practiceResult}
                    >
                      <Text style={[
                        styles.optionText,
                        selectedAnswer === option && styles.optionTextSelected
                      ]}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.practiceMeaning}>Fill in the blank:</Text>
                <View style={styles.sentenceContainer}>
                  <Text style={styles.sentenceText}>"{practiceSentence?.sentence?.replace(new RegExp(currentWord.word, 'gi'), '____')}"</Text>
                  <Text style={styles.sentenceEnText}>"{practiceSentence?.sentenceZh}"</Text>
                </View>
              </>
            )}

            {practiceMode !== '4choice' && !practiceResult ? (
              <>
                <TextInput
                  style={[styles.input, practiceMode === 'translate' && styles.inputMultiLine]}
                  value={userAnswer}
                  onChangeText={setUserAnswer}
                  placeholder="Type your answer..."
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline={practiceMode === 'translate'}
                  numberOfLines={practiceMode === 'translate' ? 4 : 1}
                />
                <TouchableOpacity 
                  style={[styles.submitButton, isEvaluating && styles.submitButtonDisabled]}
                  onPress={submitAnswer}
                  disabled={isEvaluating || !userAnswer.trim()}
                >
                  <Text style={styles.submitButtonText}>
                    {isEvaluating ? 'Checking...' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : practiceResult ? (
              <View style={[styles.resultBox, practiceResult.isCorrect || practiceResult.score >= 70 ? styles.resultCorrect : styles.resultWrong]}>
                {practiceMode === 'translate' ? (
                  <>
                    <Text style={styles.resultScore}>Score: {practiceResult.score}/100</Text>
                    <Text style={styles.resultDetail}>Your answer: "{userAnswer}"</Text>
                    {practiceResult.correctAnswer && (
                      <Text style={styles.resultDetail}>Correct: "{practiceResult.correctAnswer}"</Text>
                    )}
                    <Text style={styles.resultFeedback}>Reason: {practiceResult.feedback}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.resultScore}>Score: {practiceResult.score}/100</Text>
                    <Text style={styles.resultFeedback}>{practiceResult.feedback}</Text>
                  </>
                )}
                <TouchableOpacity style={styles.nextButton} onPress={nextQuestion}>
                  <Text style={styles.nextButtonText}>
                    {practiceIndex < practiceWords.length - 1 ? 'Next →' : 'Finish'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>✏️ Practice</Text>
      </View>

      <ScrollView style={styles.selectContainer} contentContainerStyle={styles.selectContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Word Range</Text>
          {wordRangeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionItem, wordRange === option.value && styles.optionItemActive]}
              onPress={() => setWordRange(option.value)}
            >
              <View style={[styles.radio, wordRange === option.value && styles.radioActive]}>
                {wordRange === option.value && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.optionText, wordRange === option.value && styles.optionTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Number of Questions</Text>
          <TextInput
            style={styles.input}
            value={questionCount.toString()}
            onChangeText={(text) => {
              const num = parseInt(text) || 0;
              setQuestionCount(num);
            }}
            keyboardType="number-pad"
            placeholder="Enter number of questions"
            placeholderTextColor={COLORS.textMuted}
          />
          <Text style={styles.hintText}>Current word range: {getAvailableWords().length} words</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Practice Mode</Text>
          {practiceModeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionItem, practiceMode === option.value && styles.optionItemActive]}
              onPress={() => setPracticeMode(option.value)}
            >
              <View style={[styles.radio, practiceMode === option.value && styles.radioActive]}>
                {practiceMode === option.value && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.optionText, practiceMode === option.value && styles.optionTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.startButton} onPress={startPractice}>
          <Text style={styles.startButtonText}>Start Practice</Text>
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
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  selectContainer: {
    flex: 1,
  },
  selectContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionItemActive: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: COLORS.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  optionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  optionTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  practiceContainer: {
    flex: 1,
  },
  practiceContent: {
    padding: 16,
  },
  practiceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
  },
  practiceWord: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  practiceMeaning: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  sentenceContainer: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  sentenceLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  sentenceText: {
    fontSize: 18,
    color: COLORS.text,
    fontStyle: 'italic',
  },
  sentenceEnText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  optionButton: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionCorrect: {
    backgroundColor: '#4CAF5040',
    borderColor: '#4CAF50',
  },
  optionWrong: {
    backgroundColor: '#F4433640',
    borderColor: '#F44336',
  },
  optionText: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
  },
  optionTextSelected: {
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
  },
  inputMultiLine: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resultBox: {
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  resultCorrect: {
    backgroundColor: '#4CAF5040',
  },
  resultWrong: {
    backgroundColor: '#F4433640',
  },
  resultScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  resultDetail: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 4,
  },
  resultFeedback: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 12,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

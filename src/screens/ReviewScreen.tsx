/**
 * ReviewScreen - 错题复习页面
 * 
 * 功能：
 * 1. 显示所有错题列表
 * 2. 支持按类型筛选（全部/翻译/其他）
 * 3. 支持选择特定错题进行练习
 * 4. 练习模式：用户输入答案，AI 评估对错
 * 5. 错题重做：答对后从错题库移除
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS } from '../constants';
import { useAppStore } from '../store';
import { WrongAnswer } from '../types';
import { evaluateAnswer, evaluateTranslation } from '../services/gemini';

/** 页面Props类型定义 */
interface ReviewScreenProps {
  navigation: any;
}

/**
 * ReviewScreen 主组件
 * 
 * 状态说明：
 * - mode: 'list' | 'practice' - 当前页面模式（列表/练习）
   * - filterType: 筛选类型 - 'translate' | 'other'
 * - currentIndex: 当前练习题目的索引
 * - userAnswer: 用户输入的答案
 * - isEvaluating: 是否正在评估中
 * - result: 评估结果
 * - practiceAnswers: 练习题列表
 * - score: 当前得分
 * - selectedIds: 选中的错题ID集合
 * - selectMode: 是否处于选择模式
 */
export const ReviewScreen: React.FC<ReviewScreenProps> = ({ navigation }) => {
  // 从 store 获取错题数据和操作方法
  const { wrongAnswers = [], removeWrongAnswer, clearWrongAnswers } = useAppStore();
  
  // 页面模式：'list' 显示错题列表，'practice' 显示练习界面
  const [mode, setMode] = useState<'list' | 'practice'>('list');
  
  // 筛选类型：'translate' 翻译题，'other' 其他题
  const [filterType, setFilterType] = useState<'translate' | 'other'>('translate');
  
  // 当前练习题目的索引
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 用户输入的答案
  const [userAnswer, setUserAnswer] = useState('');
  
  // 是否正在调用 AI 评估
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // AI 评估结果
  const [result, setResult] = useState<{ isCorrect: boolean; score: number; feedback: string } | null>(null);
  
  // 当前练习的错题列表
  const [practiceAnswers, setPracticeAnswers] = useState<WrongAnswer[]>([]);
  
  // 当前得分
  const [score, setScore] = useState(0);
  
  // 选中的错题ID集合（用于批量选择）
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // 是否处于选择模式
  const [selectMode, setSelectMode] = useState(false);

  /**
   * 根据筛选类型过滤错题
   */
  const filteredWrongAnswers = wrongAnswers.filter(item => {
    if (filterType === 'translate') return item.errorType === 'translate';
    return item.errorType !== 'translate';
  });

  /**
   * 切换单个错题的选择状态
   * @param id - 错题ID
   */
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  /**
   * 全选/取消全选
   */
  const selectAll = () => {
    if (selectedIds.size === filteredWrongAnswers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWrongAnswers.map(item => item.id)));
    }
  };

  /**
   * 开始练习选中的错题
   */
  const startPracticeSelected = () => {
    if (selectedIds.size === 0) return;
    const selectedItems = filteredWrongAnswers.filter(item => selectedIds.has(item.id));
    setPracticeAnswers(selectedItems);
    setCurrentIndex(0);
    setScore(0);
    setUserAnswer('');
    setResult(null);
    setSelectMode(false);
    setSelectedIds(new Set());
    setMode('practice');
  };

  /**
   * 清除所有错题
   */
  const handleClearAll = () => {
    clearWrongAnswers();
  };

  /**
   * 开始练习单个错题
   */
  const startPracticeSingle = (item: WrongAnswer) => {
    setPracticeAnswers([item]);
    setCurrentIndex(0);
    setScore(0);
    setUserAnswer('');
    setResult(null);
    setMode('practice');
  };

  /**
   * 开始练习所有错题
   */
  const startPractice = () => {
    if (filteredWrongAnswers.length === 0) return;
    setPracticeAnswers([...filteredWrongAnswers]);
    setCurrentIndex(0);
    setScore(0);
    setUserAnswer('');
    setResult(null);
    setMode('practice');
  };

  /**
   * 提交答案进行评估
   * 
   * 流程：
   * 1. 根据错题类型调用不同的评估函数
   * 2. 翻译题调用 evaluateTranslation
   * 3. 其他题调用 evaluateAnswer
   * 4. 分数 >= 70 或答对则得分并移除错题
   */
  const handleSubmitAnswer = async () => {
    if (!practiceAnswers[currentIndex] || !userAnswer.trim()) return;
    
    const currentItem = practiceAnswers[currentIndex];
    setIsEvaluating(true);
    
    try {
      let evalResult: { isCorrect: boolean; score: number; feedback: string };
      
      // 根据错题类型选择评估函数
      if (currentItem.errorType === 'translate') {
        // 翻译题：使用翻译评估函数
        evalResult = await evaluateTranslation(
          userAnswer.trim(),
          currentItem.sentence,
          useAppStore.getState().settings
        );
      } else {
        // 其他题：使用答案评估函数
        evalResult = await evaluateAnswer(
          userAnswer.trim(),
          currentItem.correctAnswer,
          currentItem.sentence,
          currentItem.sentenceEn,
          currentItem.meaning,
          useAppStore.getState().settings
        );
      }
      
      setResult(evalResult);
      
      // 分数 >= 70 视为正确，加分并移除错题
      if (evalResult.isCorrect || evalResult.score >= 70) {
        setScore(score + 1);
        removeWrongAnswer(currentItem.id);
      }
    } catch (error) {
      // 错误处理：简单比较答案
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

  /**
   * 进入下一题或结束练习
   */
  const handleNext = () => {
    if (currentIndex < practiceAnswers.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer('');
      setResult(null);
    } else {
      setMode('list');
    }
  };

  // 练习结束自动返回列表
  useEffect(() => {
    if (mode === 'practice' && practiceAnswers.length > 0 && currentIndex >= practiceAnswers.length) {
      setMode('list');
    }
  }, [currentIndex, practiceAnswers.length, mode]);

  /**
   * 渲染错题列表项
   */
  const renderListItem = ({ item }: { item: WrongAnswer }) => (
    <ReviewCard 
      item={item} 
      onDelete={removeWrongAnswer}
      selected={selectedIds.has(item.id)}
      selectMode={selectMode}
      onToggleSelect={() => toggleSelect(item.id)}
      onPractice={() => startPracticeSingle(item)}
    />
  );

  // ==================== 练习模式界面 ====================
  if (mode === 'practice' && practiceAnswers.length > 0) {
    const currentItem = practiceAnswers[currentIndex];
    
    return (
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        {/* 顶部标题栏 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('list')} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Exit Practice</Text>
          </TouchableOpacity>
          <Text style={styles.subtitle}>
            {currentIndex + 1} / {practiceAnswers.length} | Score: {score}
          </Text>
        </View>

        {/* 练习内容区域 */}
        <ScrollView style={styles.practiceContainer} contentContainerStyle={styles.practiceContent} keyboardShouldPersistTaps="handled">
          <View style={styles.practiceCard}>
            {/* 根据错题类型显示不同内容 */}
            {currentItem.errorType === 'translate' ? (
              // 翻译题：显示单词和中文句子
              <>
                <Text style={styles.practiceWord}>{currentItem.word}</Text>
                <Text style={styles.practiceMeaning}>{currentItem.meaning}</Text>
                <View style={styles.sentenceContainer}>
                  <Text style={styles.sentenceLabel}>Translate to English:</Text>
                  <Text style={styles.sentenceText}>"{currentItem.sentence}"</Text>
                </View>
              </>
            ) : (
              // 其他题：显示填空句子
              <>
                <Text style={styles.practiceMeaning}>{currentItem.meaning}</Text>
                
                <View style={styles.sentenceContainer}>
                  <Text style={styles.sentenceLabel}>Fill in the blank:</Text>
                  <Text style={styles.sentenceText}>"{currentItem.sentence?.replace(new RegExp(currentItem.word, 'gi'), '____')}"</Text>
                  <Text style={styles.sentenceEnText}>{currentItem.sentenceEn}</Text>
                </View>
              </>
            )}

            {/* 未提交答案时显示输入框和提交按钮 */}
            {!result ? (
              <>
                <TextInput
                  style={[styles.input, currentItem.errorType === 'translate' && styles.inputMultiLine]}
                  value={userAnswer}
                  onChangeText={setUserAnswer}
                  placeholder="Type your answer..."
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline={currentItem.errorType === 'translate'}
                  numberOfLines={currentItem.errorType === 'translate' ? 4 : 1}
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
              // 显示评估结果
              <View style={[styles.resultBox, result.isCorrect || result.score >= 70 ? styles.resultCorrect : styles.resultWrong]}>
                <Text style={styles.resultScore}>Score: {result.score}/100</Text>
                {result.correctAnswer && (
                  <>
                    <Text style={styles.resultText}>Your answer: "{userAnswer}"</Text>
                    <Text style={styles.resultText}>Correct: "{result.correctAnswer}"</Text>
                  </>
                )}
                <Text style={styles.resultFeedback}>Reason: {result.feedback}</Text>
                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                  <Text style={styles.nextButtonText}>
                    {currentIndex < practiceAnswers.length - 1 ? 'Next →' : 'Finish'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ==================== 列表模式界面 ====================
  
  // 按创建时间倒序排列
  const sortedWrongAnswers = [...filteredWrongAnswers].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <View style={styles.container}>
      {/* 顶部标题栏 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Review</Text>
          <Text style={styles.subtitle}>{filteredWrongAnswers.length} items to review</Text>
        </View>
        
        {/* Select 和 Practice Selected 按钮 */}
        {wrongAnswers.length > 0 && (
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.headerSelectButton, selectMode && styles.selectButtonActive]} 
              onPress={() => {
                setSelectMode(!selectMode);
                if (!selectMode) setSelectedIds(new Set());
              }}
            >
              <Text style={styles.headerSelectButtonText}>{selectMode ? '✕' : 'Select'}</Text>
            </TouchableOpacity>
            
            {selectMode && selectedIds.size > 0 && (
              <TouchableOpacity 
                style={styles.practiceSelectedButton} 
                onPress={startPracticeSelected}
              >
                <Text style={styles.practiceSelectedButtonText}>
                  ✅ {selectedIds.size}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* 筛选按钮行 */}
      {wrongAnswers.length > 0 && (
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.filterButton, filterType === 'translate' && styles.filterButtonActive]} 
            onPress={() => setFilterType('translate')}
          >
            <Text style={[styles.filterButtonText, filterType === 'translate' && styles.filterButtonTextActive]}>Translation</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, filterType === 'other' && styles.filterButtonActive]} 
            onPress={() => setFilterType('other')}
          >
            <Text style={[styles.filterButtonText, filterType === 'other' && styles.filterButtonTextActive]}>Other</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 练习按钮行 */}
      {wrongAnswers.length > 0 && !selectMode && (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.practiceAllButton} onPress={startPractice}>
            <Text style={styles.practiceAllButtonText}>🎯 Practice All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 批量选择时的操作按钮 */}
      {selectMode && selectedIds.size > 0 && (
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.practiceAllButton} 
            onPress={startPracticeSelected}
          >
            <Text style={styles.practiceAllButtonText}>✅ Practice Selected ({selectedIds.size})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 错题列表或空状态 */}
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

/**
 * ReviewCard - 错题卡片组件
 * 
 * 功能：
 * - 显示错题信息（单词、含义、用户答案、正确答案）
 * - 支持点击展开/收起单词
 * - 支持选择模式（批量选择）
 * - 支持删除错题
 */
const ReviewCard: React.FC<{
  item: WrongAnswer;           // 错题数据
  onDelete: (id: string) => void;  // 删除回调
  selected?: boolean;          // 是否被选中
  selectMode?: boolean;       // 是否处于选择模式
  onToggleSelect?: () => void;  // 切换选择回调
  onPractice?: () => void;    // 点击练习回调
}> = ({ item, onDelete, selected, selectMode, onToggleSelect, onPractice }) => {

  return (
    <TouchableOpacity style={styles.card} onPress={() => {
      // 选择模式下点击切换选择状态，否则开始练习
      if (selectMode && onToggleSelect) {
        onToggleSelect();
      } else if (onPractice) {
        onPractice();
      }
    }}>
      {/* 卡片头部：单词和操作按钮 */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          {/* 选择模式下的复选框 */}
          {selectMode && (
            <TouchableOpacity onPress={onToggleSelect} style={styles.checkbox}>
              <Text style={[styles.checkboxText, selected && styles.checkboxChecked]}>
                {selected ? '☑️' : '⬜'}
              </Text>
            </TouchableOpacity>
          )}
          <View>
            {/* 根据错题类型显示不同内容 */}
            {item.errorType === 'translate' ? (
              // 翻译模式：显示完整信息
              <>
                <Text style={styles.wordText}>{item.word}</Text>
              </>
            ) : (
              // 其他模式：只显示单词
              <Text style={styles.wordText}>{item.word}</Text>
            )}
          </View>
        </View>
        {/* 非选择模式下显示删除按钮 */}
        {!selectMode && (
          <TouchableOpacity onPress={() => onDelete(item.id)}>
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* 单词含义 */}
      {/* 根据错题类型显示不同内容 */}
      {item.errorType === 'translate' ? (
        // 翻译模式：显示完整信息
        <>
          <Text style={styles.meaningText}>{item.meaning}</Text>
          
          {/* 用户答案和正确答案对比 */}
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
        </>
      ) : (
        // 其他模式：不显示额外内容
        null
      )}
    </TouchableOpacity>
  );
};

/**
 * 样式定义
 */
const styles = StyleSheet.create({
  // 页面容器
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  // 顶部标题区域
  header: {
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  headerSelectButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerSelectButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  practiceSelectedButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  practiceSelectedButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  
  // 按钮行容器
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 10,
  },
  
  // 筛选按钮
  filterButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  
  // 练习全部按钮
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
  
  // 选择按钮
  selectButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectButtonActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  selectButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  
  // 清除按钮
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
  
  // 列表内容容器
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  
  // 错题卡片
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
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  // 复选框
  checkbox: {
    marginRight: 10,
    padding: 4,
  },
  checkboxText: {
    fontSize: 20,
  },
  checkboxChecked: {
    fontSize: 20,
  },
  
  // 单词文本
  wordText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  
  // 歌曲来源
  songText: {
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 2,
  },
  
  // 删除按钮
  deleteText: {
    color: COLORS.textMuted,
    fontSize: 18,
    padding: 4,
  },
  
  // 含义文本
  meaningText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  
  // 答案对比行
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
  
  // 空状态容器
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
  
  // 练习容器
  practiceContainer: {
    flex: 1,
  },
  practiceContent: {
    padding: 20,
    paddingTop: 0,
  },
  
  // 练习卡片
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
  
  // 句子容器
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
  
  // 输入框
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
  inputMultiLine: {
    minHeight: 100,
    textAlignVertical: 'top',
    textAlign: 'left',
  },
  
  // 提交按钮
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
  
  // 结果展示区域
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
  resultText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  resultFeedback: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 12,
  },
  
  // 下一题按钮
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

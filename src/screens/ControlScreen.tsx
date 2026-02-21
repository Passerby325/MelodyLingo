import React, { useState, useEffect } from 'react';
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
import { ApiProvider, GEMINI_MODELS, NVIDIA_MODELS } from '../types';

interface ControlScreenProps {
  navigation: any;
}

export const ControlScreen: React.FC<ControlScreenProps> = ({ navigation }) => {
  const { blacklist, addToBlacklist, removeFromBlacklist, stats, words, settings, updateSettings, clearAllData } = useAppStore();
  const [newBlacklistWord, setNewBlacklistWord] = useState('');
  const [tempGeminiKey, setTempGeminiKey] = useState(settings.geminiApiKey);
  const [tempNvidiaKey, setTempNvidiaKey] = useState(settings.nvidiaApiKey);
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider>(settings.apiProvider);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState(settings.geminiModel);
  const [selectedNvidiaModel, setSelectedNvidiaModel] = useState(settings.nvidiaModel);
  const [selectedStyle, setSelectedStyle] = useState(settings.aiStyle);
  const [quotaStatus, setQuotaStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [quotaError, setQuotaError] = useState('');

  useEffect(() => {
    setTempGeminiKey(settings.geminiApiKey);
    setTempNvidiaKey(settings.nvidiaApiKey);
    setSelectedProvider(settings.apiProvider);
    setSelectedGeminiModel(settings.geminiModel);
    setSelectedNvidiaModel(settings.nvidiaModel);
    setSelectedStyle(settings.aiStyle);
  }, [settings]);

  const checkQuota = async () => {
    setQuotaStatus('checking');
    setQuotaError('');
    
    try {
      if (selectedProvider === 'gemini') {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(tempGeminiKey);
        const model = genAI.getGenerativeModel({ model: selectedGeminiModel });
        
        const result = await model.generateContent('test');
        if (result.response) {
          setQuotaStatus('ok');
        } else {
          setQuotaStatus('error');
          setQuotaError('No response from API');
        }
      } else {
        const { default: OpenAI } = await import('openai');
        const client = new OpenAI({
          baseURL: 'https://integrate.api.nvidia.com/v1',
          apiKey: tempNvidiaKey,
        });
        
        const completion = await client.chat.completions.create({
          model: selectedNvidiaModel,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        });
        
        if (completion.choices[0]) {
          setQuotaStatus('ok');
        } else {
          setQuotaStatus('error');
          setQuotaError('No response from API');
        }
      }
    } catch (error: any) {
      setQuotaStatus('error');
      if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        setQuotaError('Quota exceeded or rate limited');
      } else if (error.message?.includes('API_KEY')) {
        setQuotaError('Invalid API key');
      } else {
        setQuotaError(error.message?.substring(0, 50) || 'Unknown error');
      }
    }
  };

  const handleAddBlacklist = async () => {
    if (!newBlacklistWord.trim()) {
      Alert.alert('Error', 'Please enter a word');
      return;
    }
    await addToBlacklist(newBlacklistWord.trim());
    setNewBlacklistWord('');
  };

  const handleRemoveBlacklist = async (id: string) => {
    Alert.alert(
      'Remove from blacklist',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFromBlacklist(id) },
      ]
    );
  };

  const handleSaveSettings = async () => {
    await updateSettings({
      apiProvider: selectedProvider,
      geminiApiKey: tempGeminiKey,
      nvidiaApiKey: tempNvidiaKey,
      geminiModel: selectedGeminiModel,
      nvidiaModel: selectedNvidiaModel,
      aiStyle: selectedStyle,
    });
    Alert.alert('Success', 'Settings saved!');
  };

  const masteredCount = words.filter((w) => w.isMastered).length;
  const totalCount = words.length;

  const currentModels = selectedProvider === 'gemini' ? GEMINI_MODELS : NVIDIA_MODELS;
  const currentModel = selectedProvider === 'gemini' ? selectedGeminiModel : selectedNvidiaModel;
  const setCurrentModel = selectedProvider === 'gemini' ? setSelectedGeminiModel : setSelectedNvidiaModel;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>The Control</Text>
      <Text style={styles.subtitle}>Your personal laboratory</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Learning Stats</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalCount}</Text>
            <Text style={styles.statLabel}>Total Words</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{masteredCount}</Text>
            <Text style={styles.statLabel}>Mastered</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0}%
            </Text>
            <Text style={styles.statLabel}>Progress</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🤖 AI Provider</Text>
        <View style={styles.providerContainer}>
          <TouchableOpacity
            style={[styles.providerButton, selectedProvider === 'gemini' && styles.providerButtonActive]}
            onPress={() => setSelectedProvider('gemini')}
          >
            <Text style={[styles.providerText, selectedProvider === 'gemini' && styles.providerTextActive]}>
              Google Gemini
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.providerButton, selectedProvider === 'nvidia' && styles.providerButtonActive]}
            onPress={() => setSelectedProvider('nvidia')}
          >
            <Text style={[styles.providerText, selectedProvider === 'nvidia' && styles.providerTextActive]}>
              NVIDIA API
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.currentInfo}>
          Current: {selectedProvider === 'gemini' ? selectedGeminiModel : selectedNvidiaModel}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔑 API Key</Text>
        {selectedProvider === 'gemini' ? (
          <View style={styles.settingCard}>
            <TextInput
              style={styles.apiInput}
              value={tempGeminiKey}
              onChangeText={setTempGeminiKey}
              placeholder="Enter Gemini API key..."
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
            />
            <Text style={styles.apiHint}>
              Default key pre-configured. Get your own from Google AI Studio
            </Text>
          </View>
        ) : (
          <View style={styles.settingCard}>
            <TextInput
              style={styles.apiInput}
              value={tempNvidiaKey}
              onChangeText={setTempNvidiaKey}
              placeholder="Enter NVIDIA API key..."
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
            />
            <Text style={styles.apiHint}>
              Get your API key from NVIDIA NGC
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Model</Text>
        <View style={styles.modelContainer}>
          {currentModels.map((model) => (
            <TouchableOpacity
              key={model}
              style={[styles.modelButton, currentModel === model && styles.modelButtonActive]}
              onPress={() => setCurrentModel(model)}
            >
              <Text style={[styles.modelText, currentModel === model && styles.modelTextActive]}>
                {model}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity 
          style={[styles.quotaButton, quotaStatus === 'checking' && styles.quotaButtonDisabled]} 
          onPress={checkQuota}
          disabled={quotaStatus === 'checking'}
        >
          <Text style={styles.quotaButtonText}>
            {quotaStatus === 'checking' ? '⏳ Checking...' : quotaStatus === 'ok' ? '✓ API OK' : quotaStatus === 'error' ? '✗ Check Failed' : '🔍 Test API'}
          </Text>
        </TouchableOpacity>
        {quotaError ? (
          <Text style={styles.quotaErrorText}>{quotaError}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎵 Translation Style</Text>
        <View style={styles.styleOptions}>
          <TouchableOpacity
            style={[styles.styleButton, selectedStyle === 'lyric' && styles.styleButtonActive]}
            onPress={() => setSelectedStyle('lyric')}
          >
            <Text style={[styles.styleButtonText, selectedStyle === 'lyric' && styles.styleButtonTextActive]}>🎵 Lyric</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.styleButton, selectedStyle === 'poetic' && styles.styleButtonActive]}
            onPress={() => setSelectedStyle('poetic')}
          >
            <Text style={[styles.styleButtonText, selectedStyle === 'poetic' && styles.styleButtonTextActive]}>🎭 Poetic</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.styleButton, selectedStyle === 'academic' && styles.styleButtonActive]}
            onPress={() => setSelectedStyle('academic')}
          >
            <Text style={[styles.styleButtonText, selectedStyle === 'academic' && styles.styleButtonTextActive]}>📚 Academic</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.styleButton, selectedStyle === 'casual' && styles.styleButtonActive]}
            onPress={() => setSelectedStyle('casual')}
          >
            <Text style={[styles.styleButtonText, selectedStyle === 'casual' && styles.styleButtonTextActive]}>💬 Casual</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings}>
        <Text style={styles.saveButtonText}>💾 Save Settings</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚫 Blacklist Manager</Text>
        <Text style={styles.sectionDescription}>
          Words in blacklist will be skipped during AI extraction
        </Text>
        
        <View style={styles.addBlacklistContainer}>
          <TextInput
            style={styles.blacklistInput}
            value={newBlacklistWord}
            onChangeText={setNewBlacklistWord}
            placeholder="Add word to blacklist..."
            placeholderTextColor={COLORS.textMuted}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddBlacklist}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {blacklist.length > 0 ? (
          <View style={styles.blacklistContainer}>
            {blacklist.map((item) => (
              <View key={item.id} style={styles.blacklistItem}>
                <Text style={styles.blacklistWord}>{item.word}</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveBlacklist(item.id)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No words in blacklist</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🗑️ Clear All Data</Text>
        <Text style={styles.sectionDescription}>
          This will delete all words, sources, songs, and wrong answers. This action cannot be undone.
        </Text>
        <TouchableOpacity 
          style={styles.dangerButton} 
          onPress={() => {
            Alert.alert(
              'Clear All Data',
              'Are you sure you want to delete all data? This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Delete All', 
                  style: 'destructive', 
                  onPress: async () => {
                    await clearAllData();
                    Alert.alert('Success', 'All data has been cleared');
                  }
                },
              ]
            );
          }}
        >
          <Text style={styles.dangerButtonText}>🗑️ Clear All Data</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ About</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.appName}>MelodyLingo</Text>
          <Text style={styles.appVersion}>Version 1.0.0 (MVP)</Text>
          <Text style={styles.appDescription}>
            Learn B2+ vocabulary through music
          </Text>
        </View>
      </View>
    </ScrollView>
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
    paddingBottom: 100,
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
    marginBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  providerContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  providerButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  providerButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '20',
  },
  providerText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  providerTextActive: {
    color: COLORS.primary,
  },
  currentInfo: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  settingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  apiInput: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  apiHint: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  modelContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modelButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modelButtonActive: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
  },
  modelText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  modelTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  quotaButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quotaButtonDisabled: {
    opacity: 0.6,
  },
  quotaButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  quotaErrorText: {
    color: COLORS.error,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  styleOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  styleButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  styleButtonActive: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
  },
  styleButtonText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  styleButtonTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  saveButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#F44336',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addBlacklistContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  blacklistInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  blacklistContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  blacklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error + '20',
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 6,
  },
  blacklistWord: {
    color: COLORS.error,
    fontSize: 14,
    marginRight: 8,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: COLORS.text,
    fontSize: 12,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  aboutCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  appDescription: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
});

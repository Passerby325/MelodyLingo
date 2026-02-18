import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  ScrollView,
  Clipboard,
} from 'react-native';
import { COLORS } from '../constants';
import { useAppStore } from '../store';
import { StorageService } from '../services/storage';
import { Song } from '../types';

interface HistoryScreenProps {
  navigation: any;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ navigation }) => {
  const { songs, words, sources } = useAppStore();
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const getWordCountForSong = (songId: string) => {
    const song = songs.find((s) => s.id === songId);
    if (!song) return 0;
    const songSources = sources.filter((s) => s.songTitle === song.title);
    const uniqueWords = new Set(songSources.map((s) => s.wordId));
    return uniqueWords.size;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSongPress = (song: Song) => {
    setSelectedSong(song);
    setModalVisible(true);
  };

  const handleDeleteSong = (song: Song) => {
    Alert.alert(
      'Delete Song',
      `Are you sure you want to delete "${song.title}"? This will also remove all associated words if they don't appear in other songs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const songSources = sources.filter((s) => s.songTitle === song.title);
            const songWordIds = new Set(songSources.map((s) => s.wordId));
            
            const remainingSources = sources.filter((s) => s.songTitle !== song.title);
            const otherWordIds = new Set(remainingSources.map((s) => s.wordId));
            
            const wordsToDelete = [...songWordIds].filter((id) => !otherWordIds.has(id));
            
            const updatedSongs = songs.filter((s) => s.id !== song.id);
            const updatedSources = sources.filter((s) => s.songTitle !== song.title);
            const updatedWords = words.filter((w) => !wordsToDelete.includes(w.id));
            
            await StorageService.saveSongs(updatedSongs);
            await StorageService.saveSources(updatedSources);
            await StorageService.saveWords(updatedWords);
            
            useAppStore.setState({ songs: updatedSongs, sources: updatedSources, words: updatedWords });
            
            if (selectedSong?.id === song.id) {
              setModalVisible(false);
              setSelectedSong(null);
            }
          },
        },
      ]
    );
  };

  const handleCopySongTitle = (title: string) => {
    Clipboard.setString(title);
    Alert.alert('Copied!', `"${title}" copied to clipboard`);
  };

  const renderSongItem = ({ item }: { item: Song }) => (
    <TouchableOpacity style={styles.songCard} onPress={() => handleSongPress(item)}>
      <View style={styles.songHeader}>
        <Text style={styles.songTitle}>{item.title}</Text>
        <View style={styles.songActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleCopySongTitle(item.title);
            }}
          >
            <Text style={styles.actionButtonText}>📋</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={(e) => {
              e.stopPropagation();
              handleDeleteSong(item);
            }}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.songDate}>{formatDate(item.createdAt)}</Text>
      <Text style={styles.wordCount}>📚 {getWordCountForSong(item.id)} words extracted</Text>
    </TouchableOpacity>
  );

  const sortedSongs = [...songs].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>{songs.length} songs imported</Text>
      </View>

      {sortedSongs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No songs imported yet</Text>
          <TouchableOpacity 
            style={styles.goBackButton}
            onPress={() => navigation.navigate('Factory')}
          >
            <Text style={styles.goBackButtonText}>Go to Factory</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sortedSongs}
          keyExtractor={(item) => item.id}
          renderItem={renderSongItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedSong && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedSong.title}</Text>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <Text style={styles.sectionLabel}>Lyrics:</Text>
                  <Text style={styles.lyricsText}>{selectedSong.lyrics}</Text>

                  <Text style={[styles.sectionLabel, styles.sectionMargin]}>Words ({getWordCountForSong(selectedSong.id)}):</Text>
                  {sources
                    .filter((s) => s.songTitle === selectedSong.title)
                    .reduce((unique: any[], source, index, arr) => {
                      if (!unique.find((u) => u.wordId === source.wordId)) {
                        const word = words.find((w) => w.id === source.wordId);
                        if (word) unique.push(word);
                      }
                      return unique;
                    }, [])
                    .map((word) => (
                      <View key={word.id} style={styles.wordItem}>
                        <Text style={styles.wordText}>{word.word}</Text>
                        <Text style={styles.wordMeaning}>{word.meaning}</Text>
                      </View>
                    ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.deleteSongButton}
                  onPress={() => {
                    setModalVisible(false);
                    handleDeleteSong(selectedSong);
                  }}
                >
                  <Text style={styles.deleteSongButtonText}>🗑️ Delete This Song</Text>
                </TouchableOpacity>
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
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  songCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  songHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  songTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  songActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  actionButtonText: {
    fontSize: 18,
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  songDate: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  wordCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
  goBackButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  goBackButtonText: {
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
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
    maxHeight: 400,
  },
  sectionLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  sectionMargin: {
    marginTop: 16,
  },
  lyricsText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
  },
  wordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  wordText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  wordMeaning: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  deleteSongButton: {
    backgroundColor: COLORS.error,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  deleteSongButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

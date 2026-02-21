Passerby325

# MelodyLingo 🎵

A mobile app for learning English vocabulary through songs, built with React Native + Expo.

## Features

### 🏭 Factory - Import & Extract
- Import Chinese song lyrics
- AI translates to English and extracts B2+ vocabulary that actually appears in the lyrics
- Choose from 4 translation styles: Lyric, Poetic, Academic, Casual

### ⚔️ Arena - Practice Mode
- **4-Choice Mode**: Select the correct word from 4 options
- **Fill-in-Blank Mode**: AI evaluates your answer based on spelling and context
- View scores after each challenge
- Wrong answers saved to review later

### 💎 Treasury - Word Bank
- Browse all learned vocabulary
- Sort by A-Z / Song / Recent
- Practice mode: AI generates new sentences to verify mastery
- Batch delete words

### 📝 Review - Mistakes
- Review wrong answers
- One-click retry all mistakes
- View answer analysis and scores

### ⚙️ Settings
- Configure API keys (Google Gemini / NVIDIA)
- Select AI models
- Manage blacklist
- View learning statistics

### 📜 History
- View imported songs
- Click to view lyrics and vocabulary
- Delete songs

## Tech Stack

- **Framework**: React Native 0.81.5 + Expo 54
- **State Management**: Zustand
- **Storage**: AsyncStorage + SQLite
- **AI**: Google Gemini API / NVIDIA API
- **Navigation**: React Navigation

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Android Studio (for Android development)
- Expo Go (for development on physical device)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd MelodyLingo

# Install dependencies
npm install

# Copy environment template and configure your API keys
cp .env.example .env
# Edit .env and add your API keys
```

### Configure API Keys

You need to obtain API keys from either:

1. **Google Gemini**: https://aistudio.google.com/app/apikey
2. **NVIDIA**: https://build.nvidia.com/

Edit `.env` file:
```
GEMINI_API_KEY=your_gemini_api_key_here
NVIDIA_API_KEY=your_nvidia_api_key_here
```

### Run Development Server

```bash
npx expo start
```

Then scan the QR code with Expo Go on your device.

### Build Android APK

```bash
# Generate native Android project
npx expo prebuild --platform android

# Build release APK
cd android
./gradlew assembleRelease
```

APK location: `android/app/build/outputs/apk/release/app-release.apk`

## AI Features

### Translation Styles
| Style | Description |
|-------|-------------|
| 🎵 Lyric | Song lyrics style - simple, natural, B1-C1 vocabulary |
| 🎭 Poetic | Poetic style - literary but accessible |
| 💬 Casual | Conversational - everyday language, B1-B2 vocabulary |
| 📚 Academic | Academic style - clear, precise |

### Vocabulary Extraction Rules
- Only extracts words that actually exist in the translated English lyrics
- Filters out common words (A1-B1 level)
- Uses base forms only (e.g., "consume" not "consumed")
- Grammar validation for translations and example sentences

## Project Structure

```
MelodyLingo/
├── src/
│   ├── screens/        # 6 main screens
│   ├── services/       # AI services (gemini.ts)
│   ├── store/          # Zustand state management
│   ├── navigation/     # Navigation configuration
│   ├── types/         # TypeScript type definitions
│   └── constants/     # Colors, config constants
├── android/            # Android native project
├── App.tsx             # Entry component
├── app.json           # Expo configuration
└── package.json      # Dependencies
```

## License

MIT License

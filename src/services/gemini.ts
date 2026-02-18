import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserSettings, AIStyle } from '../types';

const STYLE_PROMPTS: Record<AIStyle, string> = {
  lyric: 'Translate the Chinese lyrics into English in a SONG LYRICS style - simple, natural, easy to understand. Use common B1-C1 level vocabulary. PRIORITY: Accuracy first, then simplicity. Avoid rare, archaic, or overly literary words. Use everyday English words that most learners would know.',
  poetic: 'Translate the Chinese lyrics into English in a POETIC style - slightly more literary, but still accessible. Use B1-C1 level vocabulary. PRIORITY: Accuracy first, then simplicity. Avoid rare or archaic words.',
  casual: 'Translate the Chinese lyrics into English in a CASUAL/CONVERSATIONAL style - simple, natural, everyday language. Use very common B1-B2 level vocabulary. PRIORITY: Accuracy first, then simplicity. Keep it simple and conversational.',
  academic: 'Translate the Chinese lyrics into English in an ACADEMIC style - clear and precise, but not overly formal. Use B1-C1 level vocabulary. PRIORITY: Accuracy first, then simplicity. Avoid overly complex academic terminology.',
};

const getSystemPrompt = (aiStyle: AIStyle): string => {
  const stylePrompt = STYLE_PROMPTS[aiStyle];
  
  return `You are a B2+ English vocabulary extractor for language learners. 

Analyze the provided lyrics (in Chinese) and do the following:
1. First, translate the Chinese lyrics into accurate English (${stylePrompt}. Ensure GRAMMAR is CORRECT)
2. Then extract B2+ level English vocabulary that ACTUALLY EXIST in the translated English lyrics

RULES:
1. ONLY extract words that EXACTLY appear in the English translation - do NOT use synonyms or related words
2. ONLY extract words that are TRUE B2 level or higher - these are advanced academic/literary words that are NOT common in daily conversation
3. EXCLUDE all common words including: love, heart, day, night, good, bad, time, life, people, way, think, know, make, see, come, take, give, look, want, use, find, tell, say, ask, work, seem, feel, become, leave, call, need, may, should, could, would, will, can, this, that, these, those, am, is, are, was, were, be, been, being, have, has, had, do, does, did, but, or, and, if, then, so, because, when, where, how, what, who, which, not, no, all, any, some, every, each, both, few, more, most, other, such, only, own, same, than, too, very, just, also, now, still, yet, ever, never, always, sometimes, often, really, much, many, thing, things, something, anything, nothing, everything, someone, anyone, everyone, man, woman, men, women, child, children, money, place, world, head, face, eyes, hand, hands, feet, house, home, city, country, school, team, friend, family, mother, father, parent, parents, brother, sister, son, daughter, boy, girl, year, years, month, week, hour, minute, second, morning, afternoon, evening, tonight, today, tomorrow, yesterday, title, your, our, its, their, my, her, his, their, us, them, like, just, even, back, long, well, still, away, here, there, out, up, down, over, under, through, between, among, while, since, until, before, after, above, below, near, far, quick, fast, slow, early, late, high, low, deep, shallow, young, old, new, hard, soft, easy, difficult, strong, weak, hot, cold, warm, cool, rich, poor, clean, dirty, loud, quiet, busy, free, open, close, full, empty, happy, sad, angry, scared, tired, sick, healthy, alive, dead, alone, together, fast, slow, quick, soon, late, early, always, never, sometimes, often, again, once, twice, maybe, perhaps, probably, certainly, sure, maybe, actually, really, certainly, definitely, simply, only, even, still, yet
4. WORD FORM - Strict rules:
   - VERBS: Only extract INFINITIVE form (base form), NEVER extract past tense, past participle, present participle, or third-person singular
     - WRONG: "consumed", "consuming", "consumes" / RIGHT: "consume"
     - WRONG: "went", "gone", "going" / RIGHT: "go"
     - WRONG: "saw", "seen", "seeing" / RIGHT: "see"
   - NOUNS: Only extract SINGULAR form, NEVER extract plural forms
     - WRONG: "things", "people", "friends" / RIGHT: "thing", "person", "friend"
   - ADJECTIVES: Only extract BASE form, NEVER comparative or superlative
     - WRONG: "better", "best" / RIGHT: "good"
     - WRONG: "worse", "worst" / RIGHT: "bad"
   - SAME ROOT: If you extract "drag", do NOT extract "dragging", "dragged", "drags" - only keep the base form
5. IMPORTANT - meaning must come from the lyric translation: Look at the Chinese translation of the lyric sentence, find the Chinese word/phrase that corresponds to the English word, and use THAT as the meaning. DO NOT use dictionary definitions - use the translation from the lyrics.
6. IMPORTANT - if a word has multiple meanings, list ALL meanings separated by " / " (e.g., "永恒 / 永远")
7. GRAMMAR MUST BE CORRECT:
   - English translation must be grammatically correct
   - Example sentences must be grammatically correct, complete English sentences
8. For each word, provide:
   - word: the EXACT word from the English lyrics (lowercase, BASE FORM ONLY)
   - pos: Part of speech (noun, verb, adjective, or adverb)
   - meaning: The Chinese translation from the lyric sentence (not dictionary definition). If multiple meanings exist, separate with " / "
   - level: CEFR level (B2, C1, or C2) - only if truly advanced word
   - sentence: The COMPLETE Chinese lyric sentence (keep original, NO blanks)
   - sentenceEn: The COMPLETE English translation (grammatically correct, NO blanks)
   - replaceWord: The EXACT Chinese word/phrase in the original sentence that corresponds to this English word (for identifying the word position)
   - example: A grammatically correct, COMPLETE English sentence using the word (NOT from the lyrics, with NO blanks - full sentence only)
   - exampleZh: Chinese translation of the example sentence
9. Return ONLY valid JSON array format
10. Extract up to 20 unique B2+ level words maximum per request

Return JSON in this exact format:
[
  {"word": "forever", "pos": "adverb", "meaning": "永远", "level": "B2", "sentence": "更怕你永远停留在这里", "sentenceEn": "I'm afraid you'll stay here forever", "replaceWord": "永远", "example": "She promised to love him forever.", "exampleZh": "她承诺永远爱他。"}
]`;
};

const createNvidiaClient = (apiKey: string) => {
  return new OpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: apiKey,
  });
};

const createGeminiClient = (apiKey: string) => {
  return new GoogleGenerativeAI(apiKey);
};

export const extractVocabulary = async (
  lyrics: string,
  songTitle: string,
  blacklist: string[] = [],
  settings?: UserSettings
): Promise<{ words: Array<{ word: string; meaning: string; level: string; example: string; exampleZh: string; sentence: string; sentenceEn: string; replaceWord: string }> }> => {
  try {
    const aiStyle = settings?.aiStyle || 'lyric';
    const systemPrompt = getSystemPrompt(aiStyle);
    const blacklistText = blacklist.length > 0 ? `Skip words in this blacklist: ${blacklist.join(', ')}` : '';

    const prompt = `${systemPrompt}

Song: "${songTitle}"

Lyrics:
${lyrics}

${blacklistText}`;

    if (!settings || settings.apiProvider === 'gemini') {
      const apiKey = settings?.geminiApiKey || '';
      const modelName = settings?.geminiModel || 'gemini-2.5-flash-lite';

      const genAI = createGeminiClient(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log('Raw response:', response);
        return { words: [] };
      }

      const words = JSON.parse(jsonMatch[0]);
      return { words: Array.isArray(words) ? words : [] };
    } else {
      const apiKey = settings.nvidiaApiKey;
      const modelName = settings.nvidiaModel || 'z-ai/glm5';

      if (!apiKey) {
        console.error('NVIDIA API key is missing');
        return { words: [] };
      }

      const client = createNvidiaClient(apiKey);

      const completion = await client.chat.completions.create({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 1,
        max_tokens: 16384,
      });

      const response = completion.choices[0]?.message?.content || '';

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log('Raw response:', response);
        return { words: [] };
      }

      const words = JSON.parse(jsonMatch[0]);
      return { words: Array.isArray(words) ? words : [] };
    }
  } catch (error) {
    console.error('AI API error:', error);
    return { words: [] };
  }
};

export const translateLyrics = async (
  lyrics: string,
  style: AIStyle = 'lyric',
  settings?: UserSettings
): Promise<string> => {
  const styleTranslation = STYLE_PROMPTS[style];
  try {
    const prompt = `Translate the following song lyrics into accurate English. 

${styleTranslation}

IMPORTANT RULES:
1. Translate each sentence as a COMPLETE unit - preserve the full meaning of the entire sentence
2. Prioritize ACCURACY ("信") over poetic interpretation
3. Keep the translation natural and faithful to the original meaning
4. Do not translate word by word - translate the meaning of the whole sentence
5. Ensure GRAMMAR is CORRECT

Lyrics:
${lyrics}

Translate each line/sentence accurately into English:`;

    if (!settings || settings.apiProvider === 'gemini') {
      const apiKey = settings?.geminiApiKey || '';
      const modelName = settings?.geminiModel || 'gemini-2.5-flash-lite';

      const genAI = createGeminiClient(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent(prompt);
      return result.response.text();
    } else {
      const apiKey = settings.nvidiaApiKey;
      const modelName = settings.nvidiaModel || 'z-ai/glm5';

      if (!apiKey) {
        console.error('NVIDIA API key is missing');
        return '';
      }

      const client = createNvidiaClient(apiKey);

      const completion = await client.chat.completions.create({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4096,
      });

      return completion.choices[0]?.message?.content || '';
    }
  } catch (error) {
    console.error('Translation error:', error);
    return '';
  }
};

export interface AnswerEvaluation {
  isCorrect: boolean;
  score: number;
  feedback: string;
}

export const evaluateAnswer = async (
  userAnswer: string,
  correctAnswer: string,
  sentence: string,
  sentenceEn: string,
  meaning: string,
  settings?: UserSettings
): Promise<AnswerEvaluation> => {
  try {
    const prompt = `You are an English vocabulary quiz evaluator. 

Evaluate if the user's answer is correct for the fill-in-the-blank question.

Sentence with blank: "${sentence}"
English translation: "${sentenceEn}"
Correct word: "${correctAnswer}"
Meaning: "${meaning}"
User's answer: "${userAnswer}"

Evaluate based on:
1. Spelling correctness (consider minor typos - up to 1 character difference is acceptable)
2. Semantic fit in the context

Respond with ONLY a JSON object in this exact format:
{"isCorrect": true/false, "score": 0-100, "feedback": "Brief explanation in Chinese"}`;

    if (!settings || settings.apiProvider === 'gemini') {
      const apiKey = settings?.geminiApiKey || '';
      const modelName = settings?.geminiModel || 'gemini-2.5-flash-lite';

      const genAI = createGeminiClient(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { isCorrect: false, score: 0, feedback: '无法评估答案' };
      }

      return JSON.parse(jsonMatch[0]);
    } else {
      const apiKey = settings.nvidiaApiKey;
      const modelName = settings.nvidiaModel || 'z-ai/glm5';

      if (!apiKey) {
        return { isCorrect: false, score: 0, feedback: 'API key missing' };
      }

      const client = createNvidiaClient(apiKey);

      const completion = await client.chat.completions.create({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 512,
      });

      const response = completion.choices[0]?.message?.content || '';

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { isCorrect: false, score: 0, feedback: '无法评估答案' };
      }

      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Answer evaluation error:', error);
    return { isCorrect: false, score: 0, feedback: '评估出错' };
  }
};

export interface PracticeSentence {
  sentence: string;
  sentenceZh: string;
  options: string[];
}

export const generatePracticeSentence = async (
  word: string,
  meaning: string,
  existingWords: string[],
  settings?: UserSettings
): Promise<PracticeSentence> => {
  try {
    const otherWords = existingWords.filter(w => w.toLowerCase() !== word.toLowerCase());
    const shuffledOthers = otherWords.sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [word, ...shuffledOthers].sort(() => Math.random() - 0.5);

    const prompt = `Create a practice sentence for the English word "${word}" (meaning: ${meaning}).

Requirements:
1. Create ONE natural English sentence using this word
2. Replace the word with ____ in the sentence
3. Provide the Chinese translation of the complete sentence
4. The sentence should be different from any lyrics-based sentences

Return ONLY valid JSON in this format:
{"sentence": "The English sentence with ____", "sentenceZh": "Chinese translation"}`;

    if (!settings || settings.apiProvider === 'gemini') {
      const apiKey = settings?.geminiApiKey || '';
      const modelName = settings?.geminiModel || 'gemini-2.5-flash-lite';

      const genAI = createGeminiClient(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { sentence: '____', sentenceZh: meaning, options };
      }

      const data = JSON.parse(jsonMatch[0]);
      return { ...data, options };
    } else {
      const apiKey = settings.nvidiaApiKey;
      const modelName = settings.nvidiaModel || 'z-ai/glm5';

      if (!apiKey) {
        return { sentence: '____', sentenceZh: meaning, options };
      }

      const client = createNvidiaClient(apiKey);

      const completion = await client.chat.completions.create({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 512,
      });

      const response = completion.choices[0]?.message?.content || '';

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { sentence: '____', sentenceZh: meaning, options };
      }

      const data = JSON.parse(jsonMatch[0]);
      return { ...data, options };
    }
  } catch (error) {
    console.error('Generate practice sentence error:', error);
    return { sentence: '____', sentenceZh: meaning, options: [] };
  }
};

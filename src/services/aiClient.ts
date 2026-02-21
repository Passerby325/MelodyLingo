import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserSettings } from '../types';

const createNvidiaClient = (apiKey: string) => {
  return new OpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: apiKey,
  });
};

const createOpenCodeClient = (apiKey: string) => {
  return new OpenAI({
    baseURL: 'https://opencode.ai/zen/v1',
    apiKey: apiKey,
  });
};

const createGeminiClient = (apiKey: string) => {
  return new GoogleGenerativeAI(apiKey);
};

export interface AIResponse {
  text: string;
  error?: string;
}

export interface AIOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export const callAI = async (
  prompt: string,
  settings?: UserSettings,
  options: AIOptions = {}
): Promise<AIResponse> => {
  const { temperature = 0.3, maxTokens = 4096, systemPrompt } = options;
  const { apiProvider, geminiApiKey, nvidiaApiKey, opencodeApiKey, nvidiaModel, geminiModel, opencodeModel } = settings || {};

  try {
    if (!apiProvider || apiProvider === 'gemini') {
      const apiKey = geminiApiKey || '';
      const modelName = geminiModel || 'gemini-2.5-flash-lite';

      const genAI = createGeminiClient(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      return { text: response };
    } else if (apiProvider === 'nvidia') {
      const apiKey = nvidiaApiKey || '';
      const modelName = nvidiaModel || 'moonshotai/kimi-k2.5';

      if (!apiKey) {
        return { text: '', error: 'NVIDIA API key is missing' };
      }

      const client = createNvidiaClient(apiKey);

      const messages = systemPrompt
        ? [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: prompt },
          ]
        : [{ role: 'user' as const, content: prompt }];

      const completion = await client.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const response = completion.choices[0]?.message?.content || '';
      return { text: response };
    } else if (apiProvider === 'opencode') {
      const apiKey = opencodeApiKey || '';
      const modelName = opencodeModel || 'big-pickle';

      if (!apiKey) {
        return { text: '', error: 'OpenCode API key is missing' };
      }

      const client = createOpenCodeClient(apiKey);

      const messages = systemPrompt
        ? [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: prompt },
          ]
        : [{ role: 'user' as const, content: prompt }];

      const completion = await client.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const response = completion.choices[0]?.message?.content || '';
      return { text: response };
    }

    return { text: '', error: 'Unknown API provider' };
  } catch (error: any) {
    console.error('AI API error:', error);
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    return { text: '', error: `API请求失败: ${errorMessage}` };
  }
};

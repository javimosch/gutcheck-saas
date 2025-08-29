import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { IAnalysis } from '../models/ideaModel';

interface AnalysisResult {
  success: boolean;
  analysis?: IAnalysis;
  error?: string;
}

interface AnalysisOptions {
  userApiKey?: string;
  preferredModel?: string;
  voiceUrl?: string;
}

export class OpenAIService {
  private client: OpenAI | null = null;
  private promptTemplate: string;

  constructor() {
    this.promptTemplate = this.loadPromptTemplate();
  }

  private loadPromptTemplate(): string {
    try {
      const promptPath = join(__dirname, '../prompts/ideaPrompt.txt');
      return readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.error('Failed to load prompt template:', error);
      return 'Analyze this business idea and provide a JSON response with problem, audience, competitors, potential, score, and recommendation fields.';
    }
  }

  private initializeClient(apiKey?: string): void {
    const key = apiKey || process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_API_BASE_URL;
    
    if (!key) {
      throw new Error('OpenAI API key not provided');
    }

    this.client = new OpenAI({
      apiKey: key,
      baseURL: baseURL || 'https://api.openai.com/v1'
    });
  }

  async analyzeIdea(ideaText: string, options?: AnalysisOptions): Promise<AnalysisResult> {
    try {
      this.initializeClient(options?.userApiKey);
      
      if (!this.client) {
        return { success: false, error: 'OpenAI client not initialized' };
      }

      const prompt = this.promptTemplate.replace('{ideaText}', ideaText);
      // Use user's preferred model if available, otherwise use default
      const modelName = options?.userApiKey&&options?.preferredModel?options?.preferredModel: (process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo');

      // Prepare messages based on whether we have voice recording
      let messages: any[];

      if (options?.voiceUrl && options.voiceUrl.startsWith('data:audio/')) {
        // Extract base64 audio data from data URL
        const base64Data = options.voiceUrl.split(',')[1];
        
        messages = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please transcribe this audio recording and then analyze the business idea described in it.'
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: base64Data,
                  format: 'webm' // MediaRecorder produces webm format
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ];
      } else {
        // Text-only analysis
        messages = [
          {
            role: 'user',
            content: prompt
          }
        ];
      }

      const response = await this.client.chat.completions.create({
        model: modelName,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1500
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        return { success: false, error: 'No response from OpenAI' };
      }

      const analysis = this.parseAnalysisResponse(content, response);
      
      if (!analysis) {
        return { success: false, error: 'Failed to parse OpenAI response' };
      }

      return { success: true, analysis };
    } catch (error) {
      console.error('OpenAI service error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'OpenAI analysis failed' 
      };
    }
  }

  private parseAnalysisResponse(content: string, rawResponse: any): IAnalysis | null {
    try {
      // Clean the content to extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      
      const parsed = JSON.parse(jsonStr);
      
      // Validate required fields
      if (!this.isValidAnalysis(parsed)) {
        console.error('Invalid analysis structure:', parsed);
        return null;
      }

      return {
        problem: String(parsed.problem || '').trim(),
        audience: String(parsed.audience || '').trim(),
        competitors: Array.isArray(parsed.competitors) 
          ? parsed.competitors.map((c: any) => String(c).trim())
          : [],
        potential: String(parsed.potential || '').trim(),
        score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
        recommendation: this.validateRecommendation(parsed.recommendation),
        rawOpenAIResponse: rawResponse
      };
    } catch (error) {
      console.error('Failed to parse analysis response:', error);
      return null;
    }
  }

  private isValidAnalysis(obj: any): boolean {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      typeof obj.problem === 'string' &&
      typeof obj.audience === 'string' &&
      Array.isArray(obj.competitors) &&
      typeof obj.potential === 'string' &&
      typeof obj.score === 'number' &&
      typeof obj.recommendation === 'string'
    );
  }

  private validateRecommendation(rec: string): 'pursue' | 'maybe' | 'shelve' {
    const normalized = String(rec || '').toLowerCase().trim();
    
    if (['pursue', 'go', 'proceed'].includes(normalized)) {
      return 'pursue';
    } else if (['maybe', 'consider', 'potentially'].includes(normalized)) {
      return 'maybe';
    } else {
      return 'shelve';
    }
  }
}

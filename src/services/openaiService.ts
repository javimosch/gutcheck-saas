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
    this.promptTemplate = this.getEmbeddedPrompt();
  }

  private getEmbeddedPrompt(): string {
    // Embedded prompt template - no file dependency
    return `You are a seasoned business advisor and startup mentor with expertise in evaluating SaaS ideas. Your task is to analyze the following business idea and provide a comprehensive "gut-check" evaluation.

BUSINESS IDEA:
{ideaText}

Please analyze this idea and respond with a JSON object containing the following fields:

{
  "problem": "A clear, concise description of the problem this idea solves",
  "audience": "The target audience or customer segment for this idea",
  "competitors": ["List of 3-5 existing competitors or similar solutions"],
  "potential": "Assessment of the market potential and business viability",
  "score": 75, // Integer score from 0-100 based on overall potential
  "recommendation": "pursue" // One of: "pursue", "maybe", "shelve"
}

EVALUATION CRITERIA:
- Problem clarity and pain intensity (0-25 points)
- Market size and addressability (0-25 points) 
- Competitive landscape and differentiation (0-25 points)
- Feasibility and execution complexity (0-25 points)

RECOMMENDATIONS:
- "pursue": Score 70+, strong problem-solution fit, clear path to market
- "maybe": Score 40-69, has potential but needs refinement or validation
- "shelve": Score <40, weak problem-solution fit or oversaturated market

Be honest, direct, and constructive in your analysis. Focus on actionable insights that help the entrepreneur make informed decisions.

Respond ONLY with valid JSON - no additional text or formatting.`;
  }

  // Keep the old loadPromptTemplate method for backward compatibility if needed
  private loadPromptTemplate(): string {
    try {
      const promptPath = join(__dirname, '../prompts/ideaPrompt.txt');
      return readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.error('Failed to load prompt template:', error);
      return this.getEmbeddedPrompt(); // Fallback to embedded prompt
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
      console.log('Raw OpenAI response content:', content.substring(0, 500));

      let jsonStr = content.trim();

      // Try to extract JSON from various formats
      const jsonPatterns = [
        // Look for JSON object between curly braces (most common)
        /\{[\s\S]*\}/,
        // Look for JSON after markdown code blocks
        /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i,
        // Look for JSON after common prefixes
        /(?:json|response|analysis)[\s\S]*?(\{[\s\S]*\})/i,
        // Look for JSON at the end of the response
        /(\{[^{}]*\{[^{}]*\}[^{}]*\}|\{[^{}]*\})/
      ];

      for (const pattern of jsonPatterns) {
        const match = content.match(pattern);
        if (match) {
          jsonStr = match[1] || match[0];
          console.log('Found JSON pattern match:', jsonStr.substring(0, 200));
          break;
        }
      }

      // Clean up the JSON string
      jsonStr = jsonStr
        .replace(/^[^{]*/, '') // Remove anything before the first {
        .replace(/[^}]*$/, '') // Remove anything after the last }
        .replace(/```/g, '') // Remove markdown code blocks
        .replace(/^\s*json\s*/i, '') // Remove "json" prefix
        .trim();

      console.log('Cleaned JSON string:', jsonStr.substring(0, 200));

      // Try to parse the JSON
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Failed to parse:', jsonStr);

        // Try to fix common JSON issues
        jsonStr = jsonStr
          .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // Add quotes to unquoted keys
          .replace(/:\s*([^",\[\]{}\n]+)([,}])/g, ': "$1"$2') // Add quotes to unquoted string values
          .replace(/,\s*}/g, '}') // Remove trailing commas
          .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays

        console.log('Attempting to fix JSON:', jsonStr.substring(0, 200));
        parsed = JSON.parse(jsonStr);
      }

      console.log('Successfully parsed JSON:', parsed);

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
      console.error('Original content:', content.substring(0, 1000));
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

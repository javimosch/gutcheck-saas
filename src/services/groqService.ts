import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// Define the structure we expect from Groq's transcription response
interface GroqTranscriptionResponse {
    text: string;
    duration?: number;
    language?: string;
    [key: string]: any; // Allow for additional properties
}

export interface TranscriptionResult {
    text: string;
    duration?: number;
    language?: string;
}

export class GroqService {
    /**
     * Create Groq client instance with either user API key or system API key
     */
    private static createGroqClient(userApiKey?: string): Groq {
        const apiKey = userApiKey || process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('No Groq API key available');
        }
        return new Groq({ apiKey });
    }

    /**
     * Transcribe audio using Groq Whisper
     */
    static async transcribeAudio(audioBuffer: Buffer, filename: string = 'audio.webm', userApiKey?: string): Promise<TranscriptionResult> {
        try {
            // Create a temporary file from the buffer
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${filename}`);
            fs.writeFileSync(tempFilePath, audioBuffer);

            console.debug('🎤 Starting Groq Whisper transcription...');
            
            const groq = this.createGroqClient(userApiKey);
            const transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(tempFilePath),
                model: "whisper-large-v3",
                response_format: "verbose_json",
                language: "en", // Can be made dynamic if needed
            });

            // Clean up temp file
            fs.unlinkSync(tempFilePath);

            // Cast the transcription to our expected response type
            const response = transcription as unknown as GroqTranscriptionResponse;
            
            console.debug('✅ Transcription completed:', {
                text: response.text?.substring(0, 100) + '...',
                duration: response.duration,
                language: response.language
            });

            return {
                text: response.text || '',
                duration: response.duration,
                language: response.language
            };

        } catch (error) {
            console.error('❌ Groq transcription error:', error);
            throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Transcribe audio from base64 data URL
     */
    static async transcribeFromDataURL(dataURL: string, userApiKey?: string): Promise<TranscriptionResult> {
        try {
            // Extract base64 data and convert to buffer
            const base64Data = dataURL.split(',')[1];
            if (!base64Data) {
                throw new Error('Invalid data URL format');
            }

            const audioBuffer = Buffer.from(base64Data, 'base64');
            
            // Determine file extension from data URL
            const mimeType = dataURL.split(',')[0].split(':')[1].split(';')[0];
            const extension = mimeType.includes('webm') ? 'webm' : 
                            mimeType.includes('mp4') ? 'mp4' : 
                            mimeType.includes('wav') ? 'wav' : 'webm';

            return await this.transcribeAudio(audioBuffer, `audio.${extension}`, userApiKey);

        } catch (error) {
            console.error('❌ Error transcribing from data URL:', error);
            throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Check if Groq API is configured
     */
    static isConfigured(): boolean {
        return !!process.env.GROQ_API_KEY;
    }
}

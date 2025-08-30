import { Request, Response } from 'express';
import { IdeaService } from '../services/ideaService';
import { GroqService } from '../services/groqService';
import { AuthService } from '../services/authService';
import { validateIdeaText, validateTitle } from '../utils/validate';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export class IdeasController {
  private ideaService: IdeaService;
  private authService: AuthService;

  constructor() {
    this.ideaService = new IdeaService();
    this.authService = new AuthService();
  }

  createIdea = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { title, rawText, voiceUrl, userNotes } = req.body;
      const user = req.user;

      // Validate input
      const titleValidation = validateTitle(title);
      if (!titleValidation.valid) {
        res.status(400).json({ error: titleValidation.error });
        return;
      }

      // Text is optional if voice recording is provided
      const hasText = rawText && rawText.trim().length > 0;
      const hasVoice = voiceUrl && voiceUrl.trim().length > 0;

      if (!hasText && !hasVoice) {
        res.status(400).json({ error: 'Please provide either idea text or voice recording' });
        return;
      }

      let finalText = rawText;

      // If voice recording is provided, transcribe it first
      if (hasVoice) {
        try {
          console.debug('🎤 Voice recording detected, starting transcription...');
          
          // Check Groq usage limit
          const groqUsageCheck = await this.authService.checkGroqUsageLimit(user.email, req.ip || req.connection.remoteAddress || "unknown");
          
          if (!groqUsageCheck.allowed) {
            res.status(403).json({ 
              error: groqUsageCheck.error,
              groqUsageCount: groqUsageCheck.groqUsageCount,
              needsGroqKey: true
            });
            return;
          }
          
          // Get user's Groq API key if available
          const userGroqKey = await this.authService.getGroqKey(groqUsageCheck.user!);
          
          if (!GroqService.isConfigured() && !userGroqKey) {
            console.warn('⚠️ Groq API not configured, skipping transcription');
            finalText = hasText ? rawText : '[Voice recording provided - transcription unavailable]';
          } else {
            const transcription = await GroqService.transcribeFromDataURL(voiceUrl, userGroqKey || undefined);
            
            // Increment Groq usage only if using system API key
            if (!userGroqKey) {
              await this.authService.incrementGroqUsage(groqUsageCheck.user!._id);
            }
            
            if (transcription.text && transcription.text.trim()) {
              console.debug('✅ Transcription successful:', transcription.text.substring(0, 100) + '...');
              
              // If we have both text and voice, combine them
              if (hasText && rawText.trim() !== '[Voice recording provided - transcribed by AI]') {
                finalText = `${rawText}\n\n[Voice Recording Transcription]:\n${transcription.text}`;
              } else {
                // Use transcription as the main text
                finalText = transcription.text;
              }
            } else {
              console.warn('⚠️ Transcription returned empty text');
              finalText = hasText ? rawText : '[Voice recording provided - transcription failed]';
            }
          }
        } catch (error) {
          console.error('❌ Transcription error:', error);
          // Fall back to existing text or placeholder
          finalText = hasText ? rawText : '[Voice recording provided - transcription failed]';
        }
      }

      // Validate final text
      if (finalText && finalText.trim() && !finalText.includes('[Voice recording provided')) {
        const textValidation = validateIdeaText(finalText);
        if (!textValidation.valid) {
          res.status(400).json({ error: textValidation.error });
          return;
        }
      }

      const result = await this.ideaService.createIdea(
        { title, rawText: finalText, voiceUrl: '', userNotes }, // Clear voiceUrl since we've transcribed it
        user
      );

      if (!result.success) {
        res.status(500).json({ error: result.error });
        return;
      }

      res.status(201).json({ 
        success: true, 
        idea: result.idea 
      });
    } catch (error) {
      console.error('Create idea controller error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  analyzeIdea = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user;

      const result = await this.ideaService.analyzeIdea(id, user);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ 
        success: true, 
        idea: result.idea 
      });
    } catch (error) {
      console.error('Analyze idea controller error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  getUserIdeas = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { status } = req.query;
      const user = req.user;

      const result = await this.ideaService.getUserIdeas(user, status as string);

      if (!result.success) {
        res.status(500).json({ error: result.error });
        return;
      }

      res.json({ 
        success: true, 
        ideas: result.ideas 
      });
    } catch (error) {
      console.error('Get user ideas controller error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  getIdeaById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user;

      const result = await this.ideaService.getIdeaById(id, user);

      if (!result.success) {
        res.status(404).json({ error: result.error });
        return;
      }

      res.json({ 
        success: true, 
        idea: result.idea 
      });
    } catch (error) {
      console.error('Get idea by ID controller error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  updateIdeaNotes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userNotes } = req.body;
      const user = req.user;

      const result = await this.ideaService.updateIdeaNotes(id, user, userNotes);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ 
        success: true, 
        idea: result.idea 
      });
    } catch (error) {
      console.error('Update idea notes controller error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  archiveIdea = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user;

      const result = await this.ideaService.archiveIdea(id, user);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ 
        success: true, 
        idea: result.idea 
      });
    } catch (error) {
      console.error('Archive idea controller error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

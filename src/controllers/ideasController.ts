import { Request, Response } from 'express';
import { IdeaService } from '../services/ideaService';
import { validateIdeaText, validateTitle } from '../utils/validate';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export class IdeasController {
  private ideaService: IdeaService;

  constructor() {
    this.ideaService = new IdeaService();
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

      if (hasText) {
        const textValidation = validateIdeaText(rawText);
        if (!textValidation.valid) {
          res.status(400).json({ error: textValidation.error });
          return;
        }
      }

      // Use placeholder text if only voice recording provided
      const finalText = hasText ? rawText : '[Voice recording provided - transcribed by AI]';

      const result = await this.ideaService.createIdea(
        { title, rawText: finalText, voiceUrl, userNotes },
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

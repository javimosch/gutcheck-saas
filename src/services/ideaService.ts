import { Idea, IIdea } from '../models/ideaModel';
import { IUser } from '../models/userModel';
import { OpenAIService } from './openaiService';
import { AuthService } from './authService';

interface IdeaCreationData {
  title: string;
  rawText: string;
  voiceUrl?: string;
  userNotes?: string;
}

interface IdeaResult {
  success: boolean;
  idea?: IIdea;
  error?: string;
}

interface IdeaListResult {
  success: boolean;
  ideas?: IIdea[];
  error?: string;
}

export class IdeaService {
  private openaiService: OpenAIService;
  private authService: AuthService;

  constructor() {
    this.openaiService = new OpenAIService();
    this.authService = new AuthService();
  }

  async createIdea(data: IdeaCreationData, user: IUser): Promise<IdeaResult> {
    try {
      const idea = await Idea.create({
        title: data.title,
        rawText: data.rawText,
        voiceUrl: data.voiceUrl,
        userNotes: data.userNotes,
        user: user._id,
        status: 'pending'
      });

      return { success: true, idea };
    } catch (error) {
      console.error('Idea creation error:', error);
      return { success: false, error: 'Failed to create idea' };
    }
  }

  async analyzeIdea(ideaId: string, user: IUser): Promise<IdeaResult> {
    try {
      const idea = await Idea.findOne({ _id: ideaId, user: user._id });
      
      if (!idea) {
        return { success: false, error: 'Idea not found' };
      }

      // Get user's API key if they have one
      const userApiKey = await this.authService.getUserKey(user);
      
      // Perform OpenAI analysis
      const analysisResult = await this.openaiService.analyzeIdea(idea.rawText, userApiKey || undefined, idea.voiceUrl);
      
      if (!analysisResult.success || !analysisResult.analysis) {
        return { success: false, error: analysisResult.error || 'Analysis failed' };
      }

      // Update idea with analysis
      idea.analysis = analysisResult.analysis;
      idea.status = 'analyzed';
      await idea.save();

      // Increment user usage count (only if using server API key)
      if (!userApiKey) {
        await this.authService.incrementUsage(user._id);
      }

      return { success: true, idea };
    } catch (error) {
      console.error('Idea analysis error:', error);
      return { success: false, error: 'Failed to analyze idea' };
    }
  }

  async getUserIdeas(user: IUser, status?: string): Promise<IdeaListResult> {
    try {
      const query: any = { user: user._id };
      
      if (status && ['pending', 'analyzed', 'archived'].includes(status)) {
        query.status = status;
      }

      const ideas = await Idea.find(query)
        .sort({ createdAt: -1 })
        .limit(50);

      return { success: true, ideas };
    } catch (error) {
      console.error('Get user ideas error:', error);
      return { success: false, error: 'Failed to fetch ideas' };
    }
  }

  async getIdeaById(ideaId: string, user: IUser): Promise<IdeaResult> {
    try {
      const idea = await Idea.findOne({ _id: ideaId, user: user._id });
      
      if (!idea) {
        return { success: false, error: 'Idea not found' };
      }

      return { success: true, idea };
    } catch (error) {
      console.error('Get idea by ID error:', error);
      return { success: false, error: 'Failed to fetch idea' };
    }
  }

  async updateIdeaNotes(ideaId: string, user: IUser, notes: string): Promise<IdeaResult> {
    try {
      const idea = await Idea.findOneAndUpdate(
        { _id: ideaId, user: user._id },
        { userNotes: notes },
        { new: true }
      );
      
      if (!idea) {
        return { success: false, error: 'Idea not found' };
      }

      return { success: true, idea };
    } catch (error) {
      console.error('Update idea notes error:', error);
      return { success: false, error: 'Failed to update notes' };
    }
  }

  async archiveIdea(ideaId: string, user: IUser): Promise<IdeaResult> {
    try {
      const idea = await Idea.findOneAndUpdate(
        { _id: ideaId, user: user._id },
        { status: 'archived' },
        { new: true }
      );
      
      if (!idea) {
        return { success: false, error: 'Idea not found' };
      }

      return { success: true, idea };
    } catch (error) {
      console.error('Archive idea error:', error);
      return { success: false, error: 'Failed to archive idea' };
    }
  }
}

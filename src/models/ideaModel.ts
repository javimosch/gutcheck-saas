import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAnalysis {
  problem: string;
  audience: string;
  competitors: string[];
  potential: string;
  score: number;
  recommendation: 'pursue' | 'maybe' | 'shelve';
  rawOpenAIResponse: any;
}

export interface IIdea extends Document {
  title: string;
  rawText: string;
  voiceUrl?: string;
  status: 'pending' | 'analyzed' | 'archived';
  analysis?: IAnalysis;
  user: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  userNotes?: string;
}

const analysisSchema = new Schema<IAnalysis>({
  problem: { type: String, required: true },
  audience: { type: String, required: true },
  competitors: [{ type: String }],
  potential: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  recommendation: { 
    type: String, 
    required: true,
    enum: ['pursue', 'maybe', 'shelve']
  },
  rawOpenAIResponse: { type: Schema.Types.Mixed }
});

const ideaSchema = new Schema<IIdea>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  rawText: {
    type: String,
    required: true,
    maxlength: 5000
  },
  voiceUrl: {
    type: String,
    required: false
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'analyzed', 'archived'],
    default: 'pending'
  },
  analysis: {
    type: analysisSchema,
    required: false
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userNotes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Index for user queries
ideaSchema.index({ user: 1, createdAt: -1 });
ideaSchema.index({ status: 1 });

export const Idea = mongoose.model<IIdea>('Idea', ideaSchema);

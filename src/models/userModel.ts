import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  ip: string;
  usageCount: number;
  llmKeyEncrypted?: string;
  preferredModel?: string;
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  ip: {
    type: String,
    required: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  llmKeyEncrypted: {
    type: String,
    required: false
  },
  preferredModel: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for IP and email tracking
userSchema.index({ ip: 1, email: 1 });

export const User = mongoose.model<IUser>('User', userSchema);

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

interface DbConnection {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: () => boolean;
}

let isConnected = false;

export const useDb = (): DbConnection => {
  const connect = async (): Promise<void> => {
    try {
      if (isConnected) {
        console.debug('Database already connected');
        return;
      }

      const mongoUrl = process.env.MONGO_URL;
      if (!mongoUrl) {
        throw new Error('MONGO_URL environment variable is not set');
      }

      await mongoose.connect(mongoUrl);
      isConnected = true;
      console.debug('Connected to MongoDB successfully');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  };

  const disconnect = async (): Promise<void> => {
    try {
      if (!isConnected) {
        console.debug('Database already disconnected');
        return;
      }

      await mongoose.disconnect();
      isConnected = false;
      console.debug('Disconnected from MongoDB');
    } catch (error) {
      console.error('MongoDB disconnection error:', error);
      throw error;
    }
  };

  const getConnectionStatus = (): boolean => {
    return isConnected && mongoose.connection.readyState === 1;
  };

  return {
    connect,
    disconnect,
    isConnected: getConnectionStatus
  };
};

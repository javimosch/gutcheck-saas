import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import expressLayouts from 'express-ejs-layouts';

import { useDb } from './composables/useDb';
import ideasRoutes from './routes/ideas';
import authRoutes from './routes/auth';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database connection
const db = useDb();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for correct IP addresses
app.set('trust proxy', 1);

// Static files and view engine
app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Configure  layouts
app.use(expressLayouts);
app.set('layout', 'layout'); // This tells it to use views/layout.
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// API routes
app.use('/api/ideas', ideasRoutes);
app.use('/api/auth', authRoutes);

// Serve main pages
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'GutCheck - SaaS Idea Validator',
    page: 'home'
  });
});

app.get('/ideas', (req, res) => {
  res.render('idea_list', { 
    title: 'My Ideas - GutCheck',
    page: 'ideas'
  });
});

app.get('/ideas/:id', (req, res) => {
  res.render('idea_detail', { 
    title: 'Idea Details - GutCheck',
    page: 'idea-detail',
    ideaId: req.params.id
  });
});

app.get('/register', (req, res) => {
  res.render('register', { 
    title: 'Register - GutCheck',
    page: 'register'
  });
});

app.get('/settings', (req, res) => {
  res.render('settings', { 
    title: 'User Settings - GutCheck',
    page: 'settings'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: db.isConnected() ? 'connected' : 'disconnected'
  });
});

// PWA manifest
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/manifest.json'));
});

// Service worker
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../public/sw.js'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).render('404', { 
    title: 'Page Not Found - GutCheck',
    page: '404'
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Application error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.debug('Received SIGINT, shutting down gracefully...');
  await db.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.debug('Received SIGTERM, shutting down gracefully...');
  await db.disconnect();
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    await db.connect();
    
    app.listen(PORT, () => {
      console.debug(`🚀 GutCheck server running on port ${PORT}`);
      console.debug(`📱 PWA available at http://localhost:${PORT}`);
      console.debug(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

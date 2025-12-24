// Main Express application setup for ChatZone.ai backend
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from './config/passport';

/**
 * Create and configure Express application
 */
export const createApp = (): Application => {
  const app: Application = express();

  // Security middleware
  app.use(helmet()); // Set security headers

  // CORS configuration - Allow frontend and admin panel (Azure URLs)
  const allowedOrigins = [
    `https://${process.env.FRONTEND_URL}`,
    `https://${process.env.ADMIN_URL}`,
  ];

  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003');
  }

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true, // Allow cookies
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
  app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies
  app.use(cookieParser()); // Parse cookies

  // Session middleware for OAuth
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'fallback-secret-change-this',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Passport initialization for OAuth
  app.use(passport.initialize());
  app.use(passport.session());

  // Request logging
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev')); // Detailed logging in development
  } else {
    app.use(morgan('combined')); // Standard Apache-style logging in production
  }

  // Serve local files when using local storage fallback
  app.use('/local-files', express.static(require('path').join(process.cwd(), 'tmp', 'uploads')));

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });
  });

  // API routes
  const authRoutes = require('./routes/auth').default;
  const chatRoutes = require('./routes/chat').default;
  const stripeRoutes = require('./routes/stripe').default;
  const adminRoutes = require('./routes/admin').default;
  const documentsRoutes = require('./routes/documents').default;
  const projectsRoutes = require('./routes/projects').default;
  const filesRoutes = require('./routes/files').default;
  const artifactsRoutes = require('./routes/artifacts').default;
  const userRoutes = require('./routes/user').default;
  const designsRoutes = require('./routes/designs').default;
  const presentationsRoutes = require('./routes/presentations').default;
  
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/stripe', stripeRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/documents', documentsRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/files', filesRoutes);
  app.use('/api', artifactsRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/designs', designsRoutes);
  app.use('/api/presentations', presentationsRoutes);

  // 404 handler - must be after all routes
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      path: req.path,
    });
  });

  // Global error handler - must be last
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Error:', err);

    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  return app;
};


import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  findAnomaliesInBigQuery,
  getDashboardData,
  queryBigQueryDatabase,
} from './server/db.js';
import { classifyIntention, generateNaturalLanguage } from './server/gemini.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- RATE LIMITING & AUTH STATE ---
  const ADMIN_EMAIL = 'selene.jimenez.id@gmail.com';
  const DEFAULT_GUEST_LIMIT = 5;

  interface ServerUserSession {
    email: string | null;
    name: string | null;
    isAdmin: boolean;
    queriesRemaining: number;
    maxQueries: number;
    totalQueriesUsed: number;
  }

  const userSessions: Record<string, ServerUserSession> = {};

  const getOrCreateSession = (sessionId: string = 'default'): ServerUserSession => {
    if (!userSessions[sessionId]) {
      userSessions[sessionId] = {
        email: null,
        name: null,
        isAdmin: false,
        queriesRemaining: DEFAULT_GUEST_LIMIT,
        maxQueries: DEFAULT_GUEST_LIMIT,
        totalQueriesUsed: 0,
      };
    }
    return userSessions[sessionId];
  };

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'Rappi Operations Intelligence - Technical Test' });
  });

  // Get current user session & limit status
  app.get('/api/auth/session', (req, res) => {
    const sessionId = (req.headers['x-session-id'] as string) || (req.query.sessionId as string) || 'default';
    const session = getOrCreateSession(sessionId);
    res.json({ success: true, session });
  });

  // Login with Google (or admin verification)
  app.post('/api/auth/google-login', (req, res) => {
    const sessionId = (req.headers['x-session-id'] as string) || req.body.sessionId || 'default';
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email es requerido' });
    }

    const session = getOrCreateSession(sessionId);
    session.email = email;
    session.name = name || email.split('@')[0];

    const isSeleneAdmin = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

    if (isSeleneAdmin) {
      session.isAdmin = true;
      session.maxQueries = 999999;
      session.queriesRemaining = 999999;
    } else {
      session.isAdmin = false;
      session.maxQueries = 10;
      session.queriesRemaining = 10; // Extra queries for authenticated users
    }

    res.json({
      success: true,
      message: isSeleneAdmin
        ? 'Autenticado con éxito como Administradora de la Prueba Técnica (Selene Jiménez). Intentos ilimitados activados.'
        : `Sesión iniciada como ${email}. Se asignaron ${session.queriesRemaining} consultas.`,
      session,
    });
  });

  // Reset attempt limits
  app.post('/api/auth/reset-limits', (req, res) => {
    const sessionId = (req.headers['x-session-id'] as string) || req.body.sessionId || 'default';
    const session = getOrCreateSession(sessionId);

    if (session.isAdmin) {
      session.queriesRemaining = 999999;
    } else {
      session.queriesRemaining = DEFAULT_GUEST_LIMIT;
    }

    // Also reset all global sessions if requested by admin
    if (req.body.resetAll && session.isAdmin) {
      Object.keys(userSessions).forEach((sid) => {
        if (!userSessions[sid].isAdmin) {
          userSessions[sid].queriesRemaining = DEFAULT_GUEST_LIMIT;
        }
      });
    }

    res.json({
      success: true,
      message: 'Límite de consultas reiniciado con éxito.',
      session,
    });
  });

  // Main Chat Orchestrator endpoint with attempt rate limit
  app.post('/api/chat', async (req, res) => {
    try {
      const sessionId = (req.headers['x-session-id'] as string) || req.body.sessionId || 'default';
      const session = getOrCreateSession(sessionId);

      // Check query attempt limits
      if (!session.isAdmin && session.queriesRemaining <= 0) {
        return res.status(429).json({
          success: false,
          isLimitReached: true,
          message:
            '🔒 Has alcanzado el límite de consultas permitidas en esta sesión de Prueba Técnica. Inicia sesión con Google como Administradora (selene.jimenez.id@gmail.com) para reiniciar los intentos sin límite.',
          session,
        });
      }

      const { message, history = [] } = req.body;
      if (!message) {
        return res.status(400).json({ success: false, message: 'Message is required' });
      }

      // Decrement queries remaining for standard user
      if (!session.isAdmin) {
        session.queriesRemaining = Math.max(0, session.queriesRemaining - 1);
      }
      session.totalQueriesUsed += 1;

      // Step 1: Intention Classification using Gemini
      const analysis = await classifyIntention(message, history);
      let botResponse = '';

      if (analysis.type === 'anomaly_report') {
        const anomalyData = findAnomaliesInBigQuery();
        botResponse = await generateNaturalLanguage(
          message,
          JSON.stringify(anomalyData),
          history
        );
      } else if (analysis.type === 'data_query') {
        const rawData = queryBigQueryDatabase(analysis.filters);
        botResponse = await generateNaturalLanguage(
          message,
          typeof rawData === 'string' ? rawData : JSON.stringify(rawData),
          history
        );
      } else {
        botResponse = await generateNaturalLanguage(
          message,
          'No se requieren datos de la base de datos para responder a esto.',
          history
        );
      }

      res.json({
        success: true,
        message: botResponse,
        session,
      });
    } catch (error: any) {
      console.error('Error handling user chat input:', error);
      res.status(500).json({
        success: false,
        message: 'Hubo un error al procesar tu solicitud en la base de datos.',
        error: error?.message,
      });
    }
  });

  // Dashboard Metrics Data endpoint
  app.get('/api/dashboard', (req, res) => {
    try {
      const countriesParam = req.query.countries ? String(req.query.countries).split(',') : [];
      const zoneTypesParam = req.query.zoneTypes ? String(req.query.zoneTypes).split(',') : [];

      const data = getDashboardData({
        countries: countriesParam.filter(Boolean),
        zoneTypes: zoneTypesParam.filter(Boolean),
      });

      res.json(data);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ success: false, error: error?.message });
    }
  });

  // Anomalies endpoint
  app.get('/api/anomalies', (req, res) => {
    try {
      const anomalies = findAnomaliesInBigQuery();
      res.json({ success: true, anomalies });
    } catch (error: any) {
      console.error('Error fetching anomalies:', error);
      res.status(500).json({ success: false, error: error?.message });
    }
  });

  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rappi Operations Intelligence server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

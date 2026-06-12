import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Hostinger (Passenger) and most Node hosts inject the port via process.env.PORT.
const PORT = process.env.PORT || 3000;
const distDir = path.join(__dirname, 'dist');

app.use(express.json({ limit: '1mb' }));

/* ------------------------------------------------------------------ *
 * Gemini proxy
 * The API key lives ONLY on the server (process.env.GEMINI_API_KEY) and
 * is never shipped to the browser. The React app calls these endpoints
 * instead of talking to Gemini directly.
 * ------------------------------------------------------------------ */
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

if (!ai) {
  console.warn(
    '[Havenly] GEMINI_API_KEY is not set — AI endpoints will return 503 until it is configured.'
  );
}

function ensureAi(res) {
  if (!ai) {
    res.status(503).json({ error: 'AI is not configured on the server.' });
    return false;
  }
  return true;
}

// Location search with Google Maps grounding.
app.post('/api/ai/search-locations', async (req, res) => {
  if (!ensureAi(res)) return;
  const { query, latLng } = req.body ?? {};
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'A "query" string is required.' });
  }
  try {
    const config = { tools: [{ googleMaps: {} }] };
    if (latLng) {
      config.toolConfig = { retrievalConfig: { latLng } };
    }
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config,
    });
    const chunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    res.json({ text: response.text, chunks });
  } catch (err) {
    console.error('[api/ai/search-locations]', err);
    res.status(500).json({ error: 'Location search failed.' });
  }
});

// Full-conversation moderation analysis.
app.post('/api/ai/analyze-conversation', async (req, res) => {
  if (!ensureAi(res)) return;
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'A "messages" array is required.' });
  }
  try {
    const prompt = `
      You are an AI chat moderator for a rental property platform.
      Analyze the following conversation between a renter and a landlord.
      Look for:
      1. Requests to pay off-platform (e.g., wire transfer, cash outside the app, crypto).
      2. Abusive language, harassment, or threats.
      3. Spam or phishing attempts.
      4. Sharing of sensitive personal information inappropriately.

      Conversation:
      ${messages.map((m) => `${m.sender}: ${m.text}`).join('\n')}

      Return a JSON object with:
      - isFlagged (boolean): true if any of the above issues are found, false otherwise.
      - reason (string): A brief explanation of why it was flagged, or empty string if not flagged.
      - confidence (number): A score from 0 to 1 indicating your confidence in this assessment.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isFlagged: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
          },
          required: ['isFlagged', 'reason', 'confidence'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    res.json({
      isFlagged: result.isFlagged || false,
      reason: result.reason || '',
      confidence: result.confidence || 0,
    });
  } catch (err) {
    console.error('[api/ai/analyze-conversation]', err);
    res.status(500).json({ error: 'Conversation analysis failed.' });
  }
});

// Single-message moderation.
app.post('/api/ai/moderate-message', async (req, res) => {
  if (!ensureAi(res)) return;
  const { text } = req.body ?? {};
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'A "text" string is required.' });
  }
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following message sent between a renter and a landlord for inappropriate content, harassment, spam, or sharing of personal contact information outside the platform's rules.

Message: "${text}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isFlagged: {
              type: Type.BOOLEAN,
              description:
                'True if the message contains inappropriate content, harassment, spam, or attempts to bypass platform communication.',
            },
            reason: {
              type: Type.STRING,
              description:
                'A brief explanation of why the message was flagged. Empty string if not flagged.',
            },
          },
          required: ['isFlagged', 'reason'],
        },
      },
    });

    const result = JSON.parse(
      response.text || '{"isFlagged": false, "reason": ""}'
    );
    res.json({
      isFlagged: result.isFlagged || false,
      reason: result.reason || '',
    });
  } catch (err) {
    console.error('[api/ai/moderate-message]', err);
    // Fail open: moderation failures should not block messaging.
    res.json({ isFlagged: false, reason: '' });
  }
});

/* ------------------------------------------------------------------ *
 * Static single-page app
 * ------------------------------------------------------------------ */
const hasBuild = fs.existsSync(path.join(distDir, 'index.html'));

if (hasBuild) {
  // Vite emits content-hashed asset filenames, so they are safe to cache forever.
  app.use(express.static(distDir, { maxAge: '1y', index: false }));

  // SPA fallback: hand every other GET request to index.html so client-side
  // routing (react-router) can take over. index.html is never cached, so new
  // deploys are picked up immediately.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(distDir, 'index.html'), {
      headers: { 'Cache-Control': 'no-cache' },
    });
  });
} else {
  console.warn(
    '[Havenly] dist/ not found — running in API-only mode. Run "npm run build" to serve the app.'
  );
  app.get('/', (_req, res) =>
    res
      .status(503)
      .send('App not built yet. Run "npm run build", then restart.')
  );
}

app.listen(PORT, () => {
  console.log(`[Havenly] Listening on port ${PORT}`);
});

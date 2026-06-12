import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });

export interface ModerationResult {
  isFlagged: boolean;
  reason: string;
  confidence: number;
}

export const analyzeConversation = async (messages: { sender: string; text: string }[]): Promise<ModerationResult> => {
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
      ${messages.map(m => `${m.sender}: ${m.text}`).join('\n')}

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
            confidence: { type: Type.NUMBER }
          },
          required: ['isFlagged', 'reason', 'confidence']
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      isFlagged: result.isFlagged || false,
      reason: result.reason || '',
      confidence: result.confidence || 0
    };
  } catch (error) {
    console.error('Error analyzing conversation with Gemini:', error);
    throw error;
  }
};

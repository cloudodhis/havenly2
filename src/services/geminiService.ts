export interface ModerationResult {
  isFlagged: boolean;
  reason: string;
  confidence: number;
}

// Calls the server-side proxy (see server.js) so the Gemini API key never
// ships to the browser. Signature is unchanged for existing callers.
export const analyzeConversation = async (
  messages: { sender: string; text: string }[]
): Promise<ModerationResult> => {
  const res = await fetch('/api/ai/analyze-conversation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    throw new Error(`Conversation analysis failed (${res.status})`);
  }

  return (await res.json()) as ModerationResult;
};

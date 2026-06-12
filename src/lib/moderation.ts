// Calls the server-side proxy (see server.js) so the Gemini API key never
// ships to the browser. Signature is unchanged for existing callers and it
// still fails open (never blocks messaging) if the request errors.
export async function moderateMessage(
  text: string
): Promise<{ isFlagged: boolean; reason: string }> {
  try {
    const res = await fetch('/api/ai/moderate-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) throw new Error(`Moderation failed (${res.status})`);

    const result = await res.json();
    return {
      isFlagged: result.isFlagged || false,
      reason: result.reason || '',
    };
  } catch (error) {
    console.error('Error moderating message:', error);
    return { isFlagged: false, reason: '' };
  }
}

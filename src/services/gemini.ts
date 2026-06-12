// Calls the server-side proxy (see server.js) so the Gemini API key never
// ships to the browser. Signature is unchanged for existing callers.
export async function searchLocationsWithAI(
  query: string,
  latLng?: { latitude: number; longitude: number }
) {
  const res = await fetch('/api/ai/search-locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, latLng }),
  });

  if (!res.ok) {
    throw new Error(`Location search failed (${res.status})`);
  }

  return (await res.json()) as {
    text?: string;
    chunks: any[];
  };
}

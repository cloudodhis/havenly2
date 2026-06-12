import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function searchLocationsWithAI(query: string, latLng?: { latitude: number, longitude: number }) {
  const config: any = {
    tools: [{ googleMaps: {} }],
  };

  if (latLng) {
    config.toolConfig = {
      retrievalConfig: {
        latLng: {
          latitude: latLng.latitude,
          longitude: latLng.longitude
        }
      }
    };
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: query,
    config,
  });

  const text = response.text;
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  return { text, chunks };
}

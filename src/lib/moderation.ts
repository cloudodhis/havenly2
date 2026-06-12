import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function moderateMessage(text: string): Promise<{ isFlagged: boolean; reason: string }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following message sent between a renter and a landlord for inappropriate content, harassment, spam, or sharing of personal contact information outside the platform's rules.
      
Message: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isFlagged: {
              type: Type.BOOLEAN,
              description: "True if the message contains inappropriate content, harassment, spam, or attempts to bypass platform communication.",
            },
            reason: {
              type: Type.STRING,
              description: "A brief explanation of why the message was flagged. Empty string if not flagged.",
            },
          },
          required: ["isFlagged", "reason"],
        },
      },
    });

    const result = JSON.parse(response.text || '{"isFlagged": false, "reason": ""}');
    return {
      isFlagged: result.isFlagged || false,
      reason: result.reason || "",
    };
  } catch (error) {
    console.error("Error moderating message:", error);
    return { isFlagged: false, reason: "" };
  }
}

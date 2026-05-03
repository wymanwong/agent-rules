import { GoogleGenAI, Type } from "@google/genai";

// Always initialize the client using the apiKey named parameter from process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  async analyzeTicket(subject: string, description: string) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this IT support ticket. 
        Subject: ${subject}
        Description: ${description}
        
        Provide:
        1. Suggested Category (one of: Hardware, Software, Network, Account/Access, Security)
        2. Suggested Priority (Low, Medium, High, Emergency)
        3. A brief summary
        4. Quick troubleshooting steps for the agent`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              priority: { type: Type.STRING },
              summary: { type: Type.STRING },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['category', 'priority', 'summary', 'steps']
          }
        }
      });
      // Use the .text property directly to access generated content.
      const text = response.text;
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.error("AI Analysis failed:", error);
      return null;
    }
  },

  async suggestResolution(ticketContent: string) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Given this ticket details: "${ticketContent}", suggest a professional resolution response to the user.`,
      });
      // Use the .text property directly to access generated content.
      return response.text || "Unable to generate suggestion at this time.";
    } catch (error) {
      console.error("AI Resolution suggestion failed:", error);
      return "Unable to generate suggestion at this time.";
    }
  }
};
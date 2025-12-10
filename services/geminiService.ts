import { GoogleGenAI, Type } from "@google/genai";
import { Product } from "../types";

// Note: In a real environment, never expose API keys on the client.
// This is used here based on the instructions to use process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface ExtractedData {
  productName: string;
  weight: string;
  foundSku?: string;
}

export const extractDataFromText = async (text: string, availableProducts: Product[]): Promise<ExtractedData | null> => {
  try {
    const productListString = availableProducts.map(p => `${p.name} (SKU: ${p.sku})`).join(", ");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
        Extract product information from this text: "${text}".
        
        Available Products List: [${productListString}]
        
        Rules:
        1. Match the input text to the closest available product name.
        2. Extract the weight if mentioned (convert to simple number string, e.g., "2.5").
        3. If no specific product matches, use the input text as the product name.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: { type: Type.STRING },
            weight: { type: Type.STRING },
            foundSku: { type: Type.STRING, description: "The SKU of the matched product from the list, or empty if not found" }
          },
          required: ["productName", "weight"]
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text) as ExtractedData;
    }
    return null;
  } catch (error) {
    console.error("Gemini extraction failed:", error);
    return null;
  }
};
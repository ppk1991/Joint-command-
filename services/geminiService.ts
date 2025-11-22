import { GoogleGenAI } from "@google/genai";
import { SimulationStats, Vehicle, BCP } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateSituationReport = async (
  bcp: BCP,
  stats: SimulationStats,
  highRiskVehicles: Vehicle[]
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key is missing. Please check your configuration to enable AI reports.";
  }

  const prompt = `
    You are a Senior Operational Analyst for Border Control. 
    Analyze the current situational data for ${bcp.name} (${bcp.countryA} <-> ${bcp.countryB}).

    Current Metrics:
    - Vehicles Waiting: ${stats.waiting.length}
    - Vehicles Under Control: ${stats.inControl.length}
    - Cleared Recently: ${stats.cleared.length}
    - Average Waiting Time: ${stats.avgWaitSec.toFixed(1)} seconds
    - Risk Profile: Low: ${stats.riskCounts.Low}, Medium: ${stats.riskCounts.Medium}, High: ${stats.riskCounts.High}

    High Risk Vehicles Detected (Sample):
    ${highRiskVehicles.map(v => `- [${v.plate}] Type: ${v.vehicleType}, Goods: ${v.goodsType}`).join('\n')}

    Please provide a concise, professional Situation Report (SITREP) in markdown format. 
    1. Summarize traffic flow efficiency.
    2. Highlight specific security concerns based on the risk profile.
    3. Recommend operational adjustments (e.g., open more lanes, intensify checks).
    Keep it brief and actionable.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate AI report due to a service error.";
  }
};
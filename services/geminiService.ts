import { GoogleGenAI, Chat } from "@google/genai";
import type { ProcessedData, Inconsistency, AiReport } from "../lib/data-service";

type DataRow = Record<string, any>;
export type SourceData = {
    legacy: DataRow[];
    spreadsheet: DataRow[];
    supplier: DataRow[];
    reverseLogistics: DataRow[];
    historicalBackup?: DataRow[];
};

// Initialize the Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const generateChatPrompt = (data: ProcessedData): string => {
    const summary = {
        inconsistenciesFound: data.inconsistencies.length,
        inventoryItems: data.consolidatedInventory.length,
        orderRecords: data.consolidatedOrders.length,
        returnsRecords: data.consolidatedReturns.length,
        disruption: data.disruptionAnalysis ? {
            missingInventoryPercentage: data.disruptionAnalysis.missingInventoryData.percentage,
            missingOrdersPercentage: data.disruptionAnalysis.missingOrderData.percentage,
            inTransitShipments: data.disruptionAnalysis.inTransitOrders.length
        } : 'Not available'
    };

    return `You are a world-class supply chain analyst AI assistant integrated into a data reconciliation dashboard. The user has just uploaded and processed several data sources. Here is a summary of the reconciled data:
${JSON.stringify(summary, null, 2)}

Your role is to answer the user's questions about this data. Provide insights, identify potential risks, and help them understand their supply chain's current state. Be conversational, concise, and clear in your responses. You can use markdown for formatting if it helps clarity. Start by introducing yourself and stating that you're ready to answer questions about the reconciled data.
`;
}


export const startChat = (data: ProcessedData): Chat => {
    const systemInstruction = generateChatPrompt(data);
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash-preview-04-17',
        config: {
            systemInstruction: systemInstruction,
        },
    });
    return chat;
};

const generatePrompt = (sourceData: SourceData, inconsistencies: Inconsistency[]): string => {
    const hasReverseLogistics = sourceData.reverseLogistics && sourceData.reverseLogistics.length > 0;
    const hasHistorical = sourceData.historicalBackup && sourceData.historicalBackup.length > 0;

    let prompt = `
You are a supply chain crisis management expert AI, acting as the core of a 'Data Reconciliation Supply Chain Visibility Engine (DRACVE)'. Our primary ERP/SCM system has failed. The provided datasets are fragmented exports and manual spreadsheets we are using to restore visibility. Your task is to perform a comprehensive audit, consolidate the data into a single source of truth, and provide a clear, actionable report.

**Input Datasets:**

*   **Legacy Data:** ${JSON.stringify(sourceData.legacy, null, 2)}
*   **Spreadsheet Data:** ${JSON.stringify(sourceData.spreadsheet, null, 2)}
*   **Supplier Data:** ${JSON.stringify(sourceData.supplier, null, 2)}
*   **Reverse Logistics Data:** ${hasReverseLogistics ? JSON.stringify(sourceData.reverseLogistics, null, 2) : "Not provided."}
*   **Historical Backup Data:** ${hasHistorical ? JSON.stringify(sourceData.historicalBackup, null, 2) : "Not provided. If available, use this to cross-reference and validate data."}

**Potential Inconsistencies Detected (This list may be incomplete; conduct a full audit regardless):**
${inconsistencies.length > 0 ? JSON.stringify(inconsistencies, null, 2) : "None automatically detected. A full audit is still required."}

**Your Required Tasks:**

1.  **Audit, Clean, and Consolidate Data:** Create authoritative 'consolidatedInventory', 'consolidatedOrders', and 'consolidatedReturns' lists by applying these rules universally to all data. This is not just about fixing the detected inconsistencies, but creating a complete, reliable dataset from the fragments provided.
    *   **Standardize Dates:** Convert all date-like fields ('last_updated', 'shipment_date', 'return_date') to a consistent 'YYYY-MM-DD' format.
    *   **Resolve Gaps & Conflicts:** For missing values ('inventory_qty', 'order_qty') or conflicting records, create the most logical and authoritative version. Prioritize data sources in this order for accuracy: Supplier > Spreadsheet > Legacy > Historical.
    *   **Use Recency:** When records conflict, the one with the most recent 'last_updated' or equivalent date field should be considered the source of truth, unless the source priority logic dictates otherwise.
    *   **Handle Returns:** If reverse logistics data exists, correctly subtract 'returned_qty' from the corresponding 'inventory_qty'. Flag any return quantity that exceeds inventory as a critical issue in your report and set inventory to a negative value to highlight the problem.
    *   **Add Source Tracking:** For each consolidated record, add a '_source' field indicating its final origin ('Legacy', 'Spreadsheet', 'Supplier', 'AI-Corrected', 'Historical'). If you merge or calculate a value, use 'AI-Corrected'.
    *   **Add AI Explanation:** For any record in \`consolidatedInventory\` where you made a significant correction (like resolving a major discrepancy, handling a negative inventory scenario, or inferring a missing value), add a concise explanation for your action in a new \`_ai_explanation\` field. For example: "Corrected from 500 to -15 after applying a return of 515 units." or "Inferred quantity based on most recent supplier data."

2.  **Generate a Detailed Executive Report:** Create a structured report object. This is critical. The report must contain the following three sections based on your comprehensive analysis:
    *   **fixesApplied**: A string array detailing every single modification made. Be specific. (e.g., ["Standardized date for item 'A002' from '2025/06/20' to '2025-06-20'.", "Filled missing inventory_qty for item 'A003' with 150 units based on supplier data.", "Consolidated two records for item 'B112' using the most recent update."]).
    *   **rootCauseAnalysis**: A string array explaining the likely systemic reasons for data issues, based on patterns found across all data (not just the pre-identified list). (e.g., ["Inconsistent date formats suggest lack of a standardized data entry template during the outage.", "Negative inventory levels for multiple items indicate a severe lag in processing returns data.", "Missing quantities in legacy data may be due to data migration errors or incomplete manual exports."]).
    *   **recommendations**: A string array of actionable, strategic advice to manage the current situation and prevent future issues. (e.g., ["Implement data validation rules or dropdowns in spreadsheets for date fields.", "Prioritize a full physical stock count for all items with AI-corrected or negative inventory.", "Establish a weekly data audit process between supplier records and internal systems."]).

**Output Format:**

You MUST return a single, valid JSON object. Do not include any other text or markdown fences. The JSON must strictly adhere to this structure:

{
  "consolidatedInventory": [
    { "item_id": "string", "item_name": "string", "inventory_qty": "number", "last_updated": "string (YYYY-MM-DD)", "_source": "string", "_ai_explanation": "string (optional)" }
  ],
  "consolidatedOrders": [
    { "order_id": "string", "order_qty": "number", "last_updated": "string (YYYY-MM-DD)", "_source": "string" }
  ],
  "consolidatedReturns": [
    { "return_id": "string", "item_id": "string", "returned_qty": "number", "return_date": "string (YYYY-MM-DD)", "_source": "string" }
  ],
  "report": {
    "fixesApplied": ["string"],
    "rootCauseAnalysis": ["string"],
    "recommendations": ["string"]
  }
}
`;
    return prompt;
};


export const getAiFixSuggestions = async (sourceData: SourceData, inconsistencies: Inconsistency[]): Promise<Partial<ProcessedData>> => {
    const prompt = generatePrompt(sourceData, inconsistencies);

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            },
        });

        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
            jsonStr = match[2].trim();
        }

        try {
            const parsedData = JSON.parse(jsonStr);
            // Ensure report is an object, not a string
            if (typeof parsedData.report === 'string') {
                 // Basic fallback if AI returns string instead of object
                parsedData.report = { fixesApplied: [parsedData.report], rootCauseAnalysis: [], recommendations: [] };
            }
            return parsedData as Partial<ProcessedData>;
        } catch (e) {
            console.error("Failed to parse JSON response from AI:", jsonStr);
            throw new Error("AI returned an invalid data format. Please try again.");
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("The AI service failed to process the request. Please check your connection or API key.");
    }
};
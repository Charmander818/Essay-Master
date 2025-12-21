
import { GoogleGenAI, Type } from "@google/genai";
import { Question, ClozeBlank, ClozeFeedback, ChapterAnalysis } from "../types";

/**
 * MANDATORY SYMBOL & FORMATTING PROTOCOL
 */
const FORMATTING_PROTOCOL = `
**STRICT FORMATTING RULES (CRITICAL):**
1. **NO CODE BLOCKS:** Do NOT wrap your response in backticks (\`\`\`).
2. **NO INDENTATION:** Never start a line with spaces or tabs.
3. **SYMBOL SUBSTITUTES:** Use "->" for logic chains, "Increase" or "Decrease" instead of arrows.
4. **VERTICAL SPACING:** Use DOUBLE line breaks between major sections.
`;

const CIE_LOGIC_TRUTH = `
**STRICT CIE ECONOMIC LOGIC:**
1. Supply-side: AS/LRAS shifts RIGHT to reduce inflation.
2. AD Shifts: AD LEFT -> Price Level FALLS. AD RIGHT -> Price Level RISES.
3. Exchange Rates: Appreciation -> AD shifts LEFT.
`;

// CRITICAL FIX: Use the 'flash' model which is free and extremely fast.
const SAFE_MODEL = 'gemini-3-flash-preview';

/**
 * Initializes the GoogleGenAI client using the API key from environment variables.
 */
const getAIClient = () => {
  // Always use direct access to process.env.API_KEY for the constructor.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateModelAnswer = async (question: Question): Promise<string> => {
  try {
    const ai = getAIClient();
    const prompt = `
      You are a CIE Economics Examiner. Write a full-mark essay for: "${question.questionText}".
      Structure: Intro (AO1) -> Policy Analysis (AO2) -> Evaluation (AO3) -> Conclusion.
      ${CIE_LOGIC_TRUTH}
      ${FORMATTING_PROTOCOL}
    `;
    const response = await ai.models.generateContent({ 
      model: SAFE_MODEL, 
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Explicitly disable to avoid latency/billing issues where appropriate
      }
    });
    // Use .text property to get the generated text
    return response.text || "No response.";
  } catch (error: any) { 
    console.error("Gemini Error:", error);
    return `⚠️ 错误: ${error.message?.includes("billing") ? "检测到您的 API Key 尚未开启付费，请确保在 Google AI Studio 中使用的是免费层级，并确保本项目已切换到 Flash 模型（已在代码中为您切换）。" : error.message}`;
  }
};

export const generateQuestionDeconstruction = async (questionText: string): Promise<string> => {
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({ 
            model: SAFE_MODEL, 
            contents: `Deconstruct this CIE Econ question: "${questionText}" into AO1/AO2/AO3 requirements.`,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        // Use .text property to get the generated text
        return response.text || "Error.";
    } catch (error) { return "Error analyzing."; }
};

export const gradeEssay = async (question: Question, studentEssay: string, imagesBase64?: string[]): Promise<string> => {
  try {
    const ai = getAIClient();
    const parts: any[] = [];
    if (imagesBase64 && imagesBase64.length > 0) {
       imagesBase64.forEach((img) => {
         const cleanBase64 = img.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
         parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } });
       });
    }

    const prompt = `
      Grade this CIE Econ Essay:
      Question: ${question.questionText}
      Mark Scheme: ${question.markScheme}
      Work: ${studentEssay}
      ${CIE_LOGIC_TRUTH}
      ${FORMATTING_PROTOCOL}
    `;

    parts.push({ text: prompt });
    const response = await ai.models.generateContent({
      model: SAFE_MODEL,
      contents: { parts: parts },
      config: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } }
    });
    // Use .text property to get the generated text
    return response.text || "Error grading.";
  } catch (error) { return "Error during grading."; }
};

export const getRealTimeCoaching = async (question: Question, currentText: string): Promise<{ao1: number, ao2: number, ao3: number, total: number, advice: string}> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: SAFE_MODEL,
      contents: `Evaluate this draft for Question: ${question.questionText}. Draft: "${currentText}". JSON output.`,
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ao1: { type: Type.NUMBER },
            ao2: { type: Type.NUMBER },
            ao3: { type: Type.NUMBER },
            total: { type: Type.NUMBER },
            advice: { type: Type.STRING }
          },
          required: ["ao1", "ao2", "ao3", "total", "advice"]
        }
      }
    });
    // Use .text property to get the generated text
    return JSON.parse(response.text || "{}");
  } catch (error) { return { ao1: 0, ao2: 0, ao3: 0, total: 0, advice: "Connection failed." }; }
};

export const generateClozeExercise = async (modelEssay: string): Promise<{ textWithBlanks: string, blanks: ClozeBlank[] } | null> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: SAFE_MODEL,
      contents: `Generate cloze exercise JSON from: ${modelEssay}`,
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            textWithBlanks: { type: Type.STRING },
            blanks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  original: { type: Type.STRING },
                  hint: { type: Type.STRING }
                },
                required: ["id", "original", "hint"]
              }
            }
          },
          required: ["textWithBlanks", "blanks"]
        }
      }
    });
    // Use .text property to get the generated text
    return JSON.parse(response.text || "{}");
  } catch (error) { return null; }
};

export const evaluateClozeAnswers = async (blanks: ClozeBlank[], userAnswers: Record<number, string>): Promise<Record<number, ClozeFeedback> | null> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: SAFE_MODEL,
      contents: `Grade logic answers JSON: ${JSON.stringify(userAnswers)} against ${JSON.stringify(blanks)}.`,
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    // Use .text property to get the generated text
    const json = JSON.parse(response.text || "{}");
    const map: Record<number, ClozeFeedback> = {};
    json.feedback?.forEach((f: any) => map[f.id] = f);
    return map;
  } catch (error) { return null; }
};

export const analyzeTopicMarkSchemes = async (chapterTitle: string, questions: Question[]): Promise<ChapterAnalysis | null> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: SAFE_MODEL,
      contents: `Analyze chapter trends for: ${chapterTitle}. JSON format. Questions Data: ${JSON.stringify(questions)}`,
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    // Use .text property to get the generated text
    return JSON.parse(response.text || "{}");
  } catch (error) { return null; }
};

export const improveSnippet = async (snippet: string, context?: string): Promise<{ improved: string, explanation: string, aoFocus: string }> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: SAFE_MODEL,
      contents: `Improve this economics snippet: ${snippet}. Context: ${context || "None"}. JSON format.`,
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    // Use .text property to get the generated text
    return JSON.parse(response.text || "{}");
  } catch (error) { return { improved: "Error.", explanation: "Error.", aoFocus: "" }; }
};

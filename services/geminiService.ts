
import { GoogleGenAI, Type } from "@google/genai";
import { Question, ClozeBlank, ClozeFeedback, ChapterAnalysis } from "../types";

/**
 * MANDATORY SYMBOL & FORMATTING PROTOCOL
 */
const FORMATTING_PROTOCOL = `
**STRICT FORMATTING RULES (CRITICAL):**
1. **NO CODE BLOCKS:** Do NOT wrap your response or any section in backticks (\` \` \`). Output standard text.
2. **NO INDENTATION:** Never start a line with spaces or tabs.
3. **NO LATEX:** Never use "$" or LaTeX symbols.
4. **SYMBOL SUBSTITUTES:** 
   - Use "Increase" or "Rising" instead of Up-arrow.
   - Use "Decrease" or "Falling" instead of Down-arrow.
   - Use "->" for logic chains.
   - Use "P1", "P2", "Y1", "Y2" for diagram labels.
5. **VERTICAL SPACING:** 
   - Use DOUBLE line breaks between major sections.
`;

const CIE_OFFICIAL_RUBRIC = `
**CIE OFFICIAL LEVEL DESCRIPTORS:**
- AO1+AO2: Level 3 (6-8m: Detailed/Full).
- AO3: Level 2 (3-4m: Justified).
`;

const CIE_LOGIC_TRUTH = `
**STRICT CIE ECONOMIC LOGIC:**
1. Supply-side: AS/LRAS shifts RIGHT to reduce inflation. (Shifting LEFT is a FATAL ERROR).
2. AD Shifts: AD LEFT -> Price Level FALLS. AD RIGHT -> Price Level RISES.
3. Exchange Rates: Appreciation -> Export prices rise, Import prices fall -> AD shifts LEFT.
`;

// Model selection: Using Flash for basic tasks, Pro for complex reasoning
const FLASH_MODEL = 'gemini-3-flash-preview';
const PRO_MODEL = 'gemini-3-pro-preview';

// Initialize the GoogleGenAI instance inside a helper to ensure process.env.API_KEY is accessible
const getAIClient = () => {
  const key = process.env.API_KEY;
  if (!key || key === "undefined" || key.length < 5) {
    throw new Error("INVALID_API_KEY");
  }
  return new GoogleGenAI({ apiKey: key });
};

// Generate a high-quality model answer using the Pro model
export const generateModelAnswer = async (question: Question): Promise<string> => {
  try {
    const ai = getAIClient();
    const prompt = `
      You are a world-class CIE Economics Examiner. Write a full-mark essay for the following question:
      Question: ${question.questionText}
      
      Required Structure:
      1. Intro (Concentrated AO1 Definitions)
      2. Policy A Analysis (AO2) + Immediate Limitations
      3. Policy B Analysis (AO2) + Immediate Limitations
      4. Detailed Evaluation (AO3): Discuss scenarios (SR vs LR, Demand vs Cost-push causes)
      5. Conclusion
      
      ${CIE_OFFICIAL_RUBRIC}
      ${CIE_LOGIC_TRUTH}
      ${FORMATTING_PROTOCOL}
    `;
    const response = await ai.models.generateContent({ 
      model: PRO_MODEL, 
      contents: prompt 
    });
    return response.text || "No response generated.";
  } catch (error: any) { 
    console.error("Gemini Generation Error:", error);
    if (error.message === "INVALID_API_KEY") {
        return "❌ API Key Error: The API Key is missing. Check Vercel Settings and Redeploy.";
    }
    if (error.message?.includes("billing") || error.message?.includes("403")) {
        return "❌ Permission Error: Your API key might not have access to this model or requires billing. Try using a different API Key from Google AI Studio.";
    }
    return `⚠️ Error: ${error.message || "Failed to connect to AI."}`; 
  }
};

// Analyze question requirements using the Flash model
export const generateQuestionDeconstruction = async (questionText: string): Promise<string> => {
    try {
        const ai = getAIClient();
        const prompt = `Deconstruct this CIE Econ question into AO1/AO2/AO3 requirements: "${questionText}". No code blocks.`;
        const response = await ai.models.generateContent({ model: FLASH_MODEL, contents: prompt });
        return response.text || "Error.";
    } catch (error) { return "Error analyzing question."; }
};

// Grade student essays multimodally using the Pro model for accuracy
export const gradeEssay = async (question: Question, studentEssay: string, imagesBase64?: string[]): Promise<string> => {
  try {
    const ai = getAIClient();
    const parts: any[] = [];
    let essayContent = studentEssay;

    if (imagesBase64 && imagesBase64.length > 0) {
       imagesBase64.forEach((img) => {
         const cleanBase64 = img.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
         parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } });
       });
       essayContent += `\n\n[Images provided]`;
    }

    const prompt = `
      You are a strict CIE Economics Examiner. Grade this student essay:
      Question: ${question.questionText}
      Mark Scheme: ${question.markScheme}
      Student Work: ${essayContent}

      Output Required:
      # Section 1: Fatal Logic Check
      # Section 2: Level-Based Marking Summary
      # Section 3: Paragraph Commentary
      # Section 4: Corrective Logic Chains

      ${CIE_OFFICIAL_RUBRIC}
      ${CIE_LOGIC_TRUTH}
      ${FORMATTING_PROTOCOL}
    `;

    parts.push({ text: prompt });
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: { parts: parts },
      config: { temperature: 0 }
    });
    return response.text || "Error grading.";
  } catch (error) { return "Error during grading."; }
};

// Provide real-time coaching with specific scoring breakdown using JSON response schema
export const getRealTimeCoaching = async (question: Question, currentText: string): Promise<{ao1: number, ao2: number, ao3: number, total: number, advice: string}> => {
  try {
    const ai = getAIClient();
    const prompt = `Analyze current draft for CIE requirements. Question: ${question.questionText}. Draft: "${currentText}". Return JSON.`;
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
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
    return JSON.parse(response.text || "{}");
  } catch (error) { return { ao1: 0, ao2: 0, ao3: 0, total: 0, advice: "Connection failed." }; }
};

// Generate cloze exercises using the Flash model
export const generateClozeExercise = async (modelEssay: string): Promise<{ textWithBlanks: string, blanks: ClozeBlank[] } | null> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: `Create logic exercise from: ${modelEssay}. JSON format.`,
      config: { 
        responseMimeType: "application/json",
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
    return JSON.parse(response.text || "{}");
  } catch (error) { return null; }
};

// Evaluate user answers in cloze exercises using the Flash model
export const evaluateClozeAnswers = async (blanks: ClozeBlank[], userAnswers: Record<number, string>): Promise<Record<number, ClozeFeedback> | null> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: `Grade logic answers: ${JSON.stringify(userAnswers)} against ${JSON.stringify(blanks)}. JSON.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            feedback: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  score: { type: Type.NUMBER },
                  comment: { type: Type.STRING }
                },
                required: ["id", "score", "comment"]
              }
            }
          },
          required: ["feedback"]
        }
      }
    });
    const json = JSON.parse(response.text || "{}");
    const map: Record<number, ClozeFeedback> = {};
    json.feedback?.forEach((f: any) => map[f.id] = f);
    return map;
  } catch (error) { return null; }
};

// Analyze syllabus trends for a chapter using the Pro model
export const analyzeTopicMarkSchemes = async (chapterTitle: string, questions: Question[]): Promise<ChapterAnalysis | null> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: `Analyze chapter trends for: ${chapterTitle}. Context Questions: ${JSON.stringify(questions)}. JSON format.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chapter: { type: Type.STRING },
            lastUpdated: { type: Type.STRING },
            questionCount: { type: Type.NUMBER },
            ao1: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { point: { type: Type.STRING }, sourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["point", "sourceRefs"] } },
            ao2: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { point: { type: Type.STRING }, sourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["point", "sourceRefs"] } },
            ao3: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { point: { type: Type.STRING }, sourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["point", "sourceRefs"] } },
            debates: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { topic: { type: Type.STRING }, pros: { type: Type.ARRAY, items: { type: Type.STRING } }, cons: { type: Type.ARRAY, items: { type: Type.STRING } }, dependencies: { type: Type.ARRAY, items: { type: Type.STRING } }, sourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["topic", "pros", "cons", "dependencies", "sourceRefs"] } }
          },
          required: ["chapter", "lastUpdated", "questionCount", "ao1", "ao2", "ao3", "debates"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { return null; }
};

// Improve economics snippets using the Pro model for high-level reasoning
export const improveSnippet = async (snippet: string, context?: string): Promise<{ improved: string, explanation: string, aoFocus: string }> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: `Improve this economics snippet to CIE Level 3 Analysis: ${snippet}. Context: ${context}`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            improved: { type: Type.STRING },
            explanation: { type: Type.STRING },
            aoFocus: { type: Type.STRING }
          },
          required: ["improved", "explanation", "aoFocus"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { return { improved: "Error.", explanation: "Error.", aoFocus: "" }; }
};


import { GoogleGenAI, Type } from "@google/genai";
import { Question, ClozeBlank, ClozeFeedback, ChapterAnalysis } from "../types";

/**
 * MANDATORY SYMBOL & FORMATTING PROTOCOL
 */
const FORMATTING_PROTOCOL = `
**STRICT FORMATTING RULES (CRITICAL):**
1. **NO CODE BLOCKS:** Do NOT wrap your response or any section in backticks (\`\`\`). Output standard text.
2. **NO INDENTATION:** Never start a line with spaces or tabs. This triggers code-block rendering. Every line must start at the very left.
3. **NO LATEX:** Never use "$" or LaTeX symbols like \\uparrow, \\downarrow, \\rightarrow, \\beta, P_1.
4. **SYMBOL SUBSTITUTES:** 
   - Use "Increase" or "Rising" instead of Up-arrow.
   - Use "Decrease" or "Falling" instead of Down-arrow.
   - Use "->" for logic chains.
   - Use "P1", "P2", "Y1", "Y2" for diagram labels.
5. **VERTICAL SPACING:** 
   - In Section 2 (Scoring Summary), use DOUBLE line breaks between every single line. 
   - In Section 4 (Commentary), use horizontal separators "---" between different paragraphs.
`;

const CIE_OFFICIAL_RUBRIC = `
**CIE OFFICIAL LEVEL DESCRIPTORS:**
- AO1+AO2: Level 3 (6-8m: Detailed/Full), Level 2 (3-5m: Limited), Level 1 (1-2m: Descriptive).
- AO3: Level 2 (3-4m: Justified), Level 1 (1-2m: Vague).
- NO LEVEL 4.
`;

const CIE_LOGIC_TRUTH = `
**STRICT CIE ECONOMIC LOGIC:**
1. Supply-side: AS/LRAS shifts RIGHT to reduce inflation. (Shifting LEFT is a FATAL ERROR).
2. AD Shifts: AD LEFT -> Price Level FALLS. AD RIGHT -> Price Level RISES.
3. Exchange Rates: Appreciation -> Export prices rise, Import prices fall -> AD shifts LEFT.
`;

// Helper to get fresh client
const getAIClient = () => {
  const key = process.env.API_KEY;
  if (!key) throw new Error("API_KEY environment variable is missing.");
  return new GoogleGenAI({ apiKey: key });
};

export const generateModelAnswer = async (question: Question): Promise<string> => {
  try {
    const ai = getAIClient();
    const prompt = `
      You are a world-class CIE Economics Examiner. Write a full-mark essay following this EXACT structure:

      # SECTION 1: ESSAY RESPONSE

      **Introduction (Concentrated AO1):** 
      Define ALL key terms and concepts first. For example, define inflation, define Monetary policy, and define Supply-side policy clearly here.

      **Body Paragraph 1 (Monetary Policy AO2 + AO2 Limitations):** 
      1. Explain the transmission mechanism (e.g., Interest Rates -> C/I -> AD shift -> Price Level).
      2. IMMEDIATELY follow with the specific limitations of monetary policy (e.g., time lags, impact on growth/unemployment).

      **Body Paragraph 2 (Supply-side Policy AO2 + AO2 Limitations):** 
      1. Explain the mechanism (e.g., Productivity/Capacity -> LRAS shift right -> Price Level falls + Output rises).
      2. IMMEDIATELY follow with the specific limitations of supply-side policy (e.g., extreme time lags, high cost, uncertainty).

      **Evaluation (Detailed AO3 - The "Depends On" discussion):** 
      Discuss specific scenarios:
      1. Time Horizon: Why Monetary is preferred for Short Run (speed/central bank independence) vs why Supply-side is essential for Long Run (sustainable capacity).
      2. Cause of Inflation: If it is Demand-pull, why Monetary is more direct. If it is Cost-push (Stagflation), why Supply-side is the only real solution that doesn't worsen unemployment.

      **Conclusion:** Final justified judgement.

      Question: ${question.questionText}
      
      ${CIE_OFFICIAL_RUBRIC}
      ${CIE_LOGIC_TRUTH}
      ${FORMATTING_PROTOCOL}
    `;
    const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
    return response.text || "Error.";
  } catch (error) { 
    console.error("Gemini Error:", error);
    return "Failed to generate. Please check if API_KEY is set in Vercel settings."; 
  }
};

export const generateQuestionDeconstruction = async (questionText: string): Promise<string> => {
    try {
        const ai = getAIClient();
        const prompt = `Analyze CIE requirements for: "${questionText}". Use clear vertical lists. No LaTeX. No code blocks.`;
        const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
        return response.text || "Error.";
    } catch (error) { 
      console.error(error);
      return "Error."; 
    }
};

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
       essayContent += `\n\n[Note: Evaluate the sequence of handwritten images provided.]`;
    }

    const prompt = `
      You are a strict CIE Economics Examiner. Grade the work below.
      Question: ${question.questionText}
      Mark Scheme: ${question.markScheme}
      Student Work: ${essayContent}

      ${CIE_OFFICIAL_RUBRIC}
      ${CIE_LOGIC_TRUTH}
      ${FORMATTING_PROTOCOL}

      **REQUIRED OUTPUT SECTIONS (STRICT VERTICAL LAYOUT):**

      # 🚨 Section 1: Fatal Logic Check
      [Check logic. If AS shifts left to reduce inflation, label it "FATAL ERROR". Start line at very left.]

      # 📊 Section 2: Level-Based Marking Summary
      [MANDATORY: NO CODE BLOCKS. Start every line at the very left. Use double line breaks.]

      - **AO1 + AO2 Score:** X / 8 (Level X)

      - **AO3 Score:** X / 4 (Level Y)

      - **Total Score:** X / 12

      - **Overall Verdict:** [1 sentence summary]

      # 🎯 Section 3: Mark Scheme Alignment
      - Hits: [Points covered]
      - Misses: [Critical missing links]

      # 📝 Section 4: Paragraph-by-Paragraph Commentary
      [Provide a deep-dive analysis for EVERY paragraph. Start line at very left. Use "---" between paragraph feedbacks.]
      - **Paragraph 1:** ...
      ---
      - **Paragraph 2:** ...

      # 📉 Section 5: Corrective Logic Chains
      **Student Fault:** [Identify a specific broken chain]
      **Standard Logic Chain:** [Provide the EXACT A -> B -> C -> D chain in text]
    `;

    parts.push({ text: prompt });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: parts },
      config: { temperature: 0 }
    });
    return response.text || "Error.";
  } catch (error) { 
    console.error(error);
    return "Error grading."; 
  }
};

export const getRealTimeCoaching = async (question: Question, currentText: string): Promise<{ao1: number, ao2: number, ao3: number, total: number, advice: string}> => {
  try {
    const ai = getAIClient();
    const prompt = `
      You are a CIE Coach. Analyze current draft: "${currentText}"
      Question: ${question.questionText}
      
      ${CIE_OFFICIAL_RUBRIC}
      ${CIE_LOGIC_TRUTH}
      ${FORMATTING_PROTOCOL}

      **TASK:**
      1. Map progress to CIE Levels.
      2. If reversed logic found, advice MUST start with "⚠️ FATAL LOGIC ERROR".
      3. Return JSON. Advice must not have leading spaces in strings.
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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
  } catch (error) { 
    console.error(error);
    return { ao1: 0, ao2: 0, ao3: 0, total: 0, advice: "Error connecting to AI." }; 
  }
};

export const generateClozeExercise = async (modelEssay: string): Promise<{ textWithBlanks: string, blanks: ClozeBlank[] } | null> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Create a logic chain exercise from: ${modelEssay}. NO LaTeX. NO code blocks.`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { 
    console.error(error);
    return null; 
  }
};

export const evaluateClozeAnswers = async (blanks: ClozeBlank[], userAnswers: Record<number, string>): Promise<Record<number, ClozeFeedback> | null> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Grade these: ${JSON.stringify(userAnswers)} against ${JSON.stringify(blanks)}. No leading spaces.`,
      config: { responseMimeType: "application/json" }
    });
    const json = JSON.parse(response.text || "{}");
    const map: Record<number, ClozeFeedback> = {};
    json.feedback?.forEach((f: any) => map[f.id] = f);
    return map;
  } catch (error) { 
    console.error(error);
    return null; 
  }
};

export const analyzeTopicMarkSchemes = async (chapterTitle: string, questions: Question[]): Promise<ChapterAnalysis | null> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze trends for ${chapterTitle}. Qs: ${JSON.stringify(questions)}. NO code blocks.`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { 
    console.error(error);
    return null; 
  }
};

export const improveSnippet = async (snippet: string, context?: string): Promise<{ improved: string, explanation: string, aoFocus: string }> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Improve to CIE Level 3 Analysis: ${snippet}. Context: ${context}\n\n${CIE_LOGIC_TRUTH}\n${FORMATTING_PROTOCOL}`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { 
    console.error(error);
    return { improved: "", explanation: "Error", aoFocus: "" }; 
  }
};

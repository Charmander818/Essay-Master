// Updated to follow @google/genai best practices and fix API key sourcing.
import { GoogleGenAI, Type } from "@google/genai";
import { Question, ClozeBlank, ClozeFeedback, ChapterAnalysis } from "../types";

/**
 * MANDATORY SYMBOL & FORMATTING PROTOCOL
 */
const FORMATTING_PROTOCOL = `
**STRICT FORMATTING RULES (CRITICAL):**
1. **NO CODE BLOCKS:** Do NOT wrap your response or any section in backticks (\`\`\`). Output standard text.
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

// Helper to get fresh client. API key must be obtained exclusively from process.env.API_KEY as per guidelines.
const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Generate high-quality model answers using gemini-3-pro-preview
export const generateModelAnswer = async (question: Question): Promise<string> => {
  try {
    const ai = getAIClient();
    const prompt = `
      You are a world-class CIE Economics Examiner. Write a full-mark essay for the following question, strictly following this structure:

      # SECTION 1: ESSAY RESPONSE

      **1. Introduction (Concentrated AO1):** 
      Start by defining ALL key terms immediately. Define inflation. Define Monetary Policy (Demand-side). Define Supply-side Policy. Ensure definitions are precise and clear.

      **2. Monetary Policy Analysis (AO2) & Its Limitations:** 
      Explain the transmission mechanism (Interest rates -> Cost of borrowing -> C and I -> AD shift left -> P falls). Mention the exchange rate effect (Hot money -> Appreciation -> Import prices fall). 
      IMMEDIATELY following this analysis, discuss the limitations of monetary policy (Time lags of 18-24 months, conflict with growth and unemployment, effectiveness if interest rates are already low).

      **3. Supply-side Policy Analysis (AO2) & Its Limitations:** 
      Explain how it increases productive potential (Investment in education/infrastructure -> Productivity -> LRAS shifts right -> Lower unit costs -> P falls while Y rises). 
      IMMEDIATELY following this, discuss the limitations of supply-side policy (Very long time lags, high opportunity cost for government budget, uncertain outcomes).

      **4. Evaluation (Expanded AO3 - The "Depends On" discussion):** 
      Discuss in detail:
      - Scenario A (Time Horizon): Why Monetary is more successful in the Short Run due to its speed and implementation by independent central banks, vs why Supply-side is the only sustainable solution for the Long Run.
      - Scenario B (Cause of Inflation): If inflation is Demand-pull, why Monetary is the direct tool. If inflation is Cost-push (Stagflation), explain why Monetary policy would be damaging (deep recession) and why Supply-side is the "most successful" as it tackles the root cause without reducing output.

      **5. Conclusion:** Final justified judgement on which is "more successful" based on the specific context of the economy.

      Question: ${question.questionText}
      
      ${CIE_OFFICIAL_RUBRIC}
      ${CIE_LOGIC_TRUTH}
      ${FORMATTING_PROTOCOL}
    `;
    const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
    return response.text || "Error generating content.";
  } catch (error: any) { 
    console.error("Gemini Error:", error);
    return "Failed to generate. Ensure your API key is correctly configured and has appropriate billing status."; 
  }
};

// Deconstruct questions for better understanding of requirements
export const generateQuestionDeconstruction = async (questionText: string): Promise<string> => {
    try {
        const ai = getAIClient();
        const prompt = `Analyze CIE requirements for: "${questionText}". Use clear vertical lists. No LaTeX. No code blocks.`;
        const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
        return response.text || "Error.";
    } catch (error) { return "Error."; }
};

// Strict grading using gemini-3-pro-preview with image support for OCR
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
      [Check logic. If AS shifts left to reduce inflation, label it "FATAL ERROR".]

      # 📊 Section 2: Level-Based Marking Summary
      - **AO1 + AO2 Score:** X / 8 (Level X)
      - **AO3 Score:** X / 4 (Level Y)
      - **Total Score:** X / 12
      - **Overall Verdict:** [1 sentence summary]

      # 🎯 Section 3: Mark Scheme Alignment
      - Hits: [Points covered]
      - Misses: [Critical missing links]

      # 📝 Section 4: Paragraph-by-Paragraph Commentary
      [Deep analysis for each paragraph. Use "---" between paragraphs.]

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
    return response.text || "Error grading essay.";
  } catch (error) { return "Error grading."; }
};

// Real-time coaching feedback using responseSchema for consistent JSON
export const getRealTimeCoaching = async (question: Question, currentText: string): Promise<{ao1: number, ao2: number, ao3: number, total: number, advice: string}> => {
  try {
    const ai = getAIClient();
    const prompt = `
      You are a CIE Coach. Analyze current draft: "${currentText}"
      Question: ${question.questionText}
      ${CIE_LOGIC_TRUTH}
      ${FORMATTING_PROTOCOL}
      Return scores and advice.
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
  } catch (error) { return { ao1: 0, ao2: 0, ao3: 0, total: 0, advice: "Error fetching feedback." }; }
};

// Create logic training exercises with structured schema
export const generateClozeExercise = async (modelEssay: string): Promise<{ textWithBlanks: string, blanks: ClozeBlank[] } | null> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Create a logic chain exercise from: ${modelEssay}. NO LaTeX. NO code blocks.`,
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

// Evaluate student answers in the logic trainer
export const evaluateClozeAnswers = async (blanks: ClozeBlank[], userAnswers: Record<number, string>): Promise<Record<number, ClozeFeedback> | null> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Grade these: ${JSON.stringify(userAnswers)} against ${JSON.stringify(blanks)}.`,
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

// Analyze chapter-wide trends and common mark scheme points
export const analyzeTopicMarkSchemes = async (chapterTitle: string, questions: Question[]): Promise<ChapterAnalysis | null> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze trends for ${chapterTitle}. Qs: ${JSON.stringify(questions)}.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chapter: { type: Type.STRING },
            lastUpdated: { type: Type.STRING },
            questionCount: { type: Type.NUMBER },
            ao1: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  point: { type: Type.STRING },
                  sourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["point", "sourceRefs"]
              }
            },
            ao2: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  point: { type: Type.STRING },
                  sourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["point", "sourceRefs"]
              }
            },
            ao3: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  point: { type: Type.STRING },
                  sourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["point", "sourceRefs"]
              }
            },
            debates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                  cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                  dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                  sourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["topic", "pros", "cons", "dependencies", "sourceRefs"]
              }
            }
          },
          required: ["chapter", "lastUpdated", "questionCount", "ao1", "ao2", "ao3", "debates"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { return null; }
};

// Improve specific essay snippets to Level 3 analysis quality
export const improveSnippet = async (snippet: string, context?: string): Promise<{ improved: string, explanation: string, aoFocus: string }> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Improve to CIE Level 3 Analysis: ${snippet}. Context: ${context}\n\n${CIE_LOGIC_TRUTH}\n${FORMATTING_PROTOCOL}`,
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
  } catch (error) { return { improved: "Error during snippet improvement.", explanation: "Check your API configuration.", aoFocus: "" }; }
};

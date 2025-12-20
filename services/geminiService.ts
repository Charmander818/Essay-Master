
import { GoogleGenAI, Type } from "@google/genai";
import { Question, ClozeBlank, ClozeFeedback, ChapterAnalysis } from "../types";

// Basic check for API key existence
const apiKey = process.env.API_KEY;

let ai: GoogleGenAI;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey: apiKey });
} else {
    console.warn("API_KEY is missing. AI features will not work until configured.");
}

const checkForApiKey = () => {
    if (!apiKey) {
        throw new Error("API Key is missing. Please add API_KEY to environment variables.");
    }
};

/**
 * MANDATORY CIE ECONOMIC LOGIC - SHARED BY ALL TOOLS
 * This ensures the model answer, coach, and grader all use the same "Truth".
 */
const CIE_LOGIC_TRUTH = `
  **STRICT CIE ECONOMIC LOGIC (DIRECTIONAL ACCURACY IS MANDATORY):**
  
  1. **Supply-side Policies**: 
     - Correct: Policy -> Quality/Quantity of FOP increases -> Productivity increases -> AS or LRAS shifts RIGHT -> Price Level falls (Reduction in inflation) -> Real GDP increases.
     - INCORRECT (FATAL): Shifting AS/LRAS left to reduce inflation.

  2. **Monetary/Fiscal Policy (AD Shifts)**:
     - Correct: Contractionary Policy (e.g. Interest rates rise) -> C, I, (X-M) fall -> AD shifts LEFT -> Price Level FALLS.
     - Correct: Expansionary Policy (e.g. Taxes fall) -> C, I rise -> AD shifts RIGHT -> Price Level RISES.
     - INCORRECT (FATAL): AD shifting left leading to a price level increase.

  3. **Exchange Rates**:
     - Appreciation: Domestic currency value rises -> Export prices (in foreign currency) rise -> Import prices (in domestic currency) fall -> (X-M) falls -> AD shifts LEFT.
     - Depreciation: Domestic currency value falls -> Export prices fall -> Import prices rise -> (X-M) rises -> AD shifts RIGHT.
  
  4. **Formatting Rules**:
     - DO NOT use LaTeX like $\rightarrow$ or $P_1$.
     - Use simple text arrows: "->"
     - Use simple text labels: "P1", "P2", "AD1", "AS1".
`;

export const generateModelAnswer = async (question: Question): Promise<string> => {
  try {
    checkForApiKey();
    
    const prompt = `
      You are a world-class CIE Economics Examiner. Write a perfect, full-mark essay.
      
      **Question:** ${question.questionText}
      **Max Marks:** ${question.maxMarks}
      **Mark Scheme Guidance:** ${question.markScheme}
      
      ${CIE_LOGIC_TRUTH}

      **Required Essay Structure:**
      - **Introduction**: Precise textbook definitions.
      - **Analysis (AO2)**: Two to three distinct points (depending on marks). Use "Logic Chains": A -> B -> C -> Result.
      - **Evaluation (AO3)**: Clear judgment, "it depends on" factors, and a justified conclusion.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text || "Error generating response.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return "Failed to generate essay. Check API key.";
  }
};

export const generateQuestionDeconstruction = async (questionText: string): Promise<string> => {
    try {
        checkForApiKey();
        const prompt = `Analyze this CIE Economics question: "${questionText}". Identify Command Word, AO1 terms, AO2 logic, and AO3 context.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
        });
        return response.text || "Error analyzing question.";
    } catch (error) {
        return "Failed to analyze question.";
    }
};

export const gradeEssay = async (question: Question, studentEssay: string, imagesBase64?: string[]): Promise<string> => {
  try {
    checkForApiKey();
    const parts: any[] = [];
    let essayContent = studentEssay;

    if (imagesBase64 && imagesBase64.length > 0) {
       imagesBase64.forEach((img) => {
         const cleanBase64 = img.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
         parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } });
       });
       essayContent += `\n\n[Note: Evaluate the attached handwritten essay images as a sequence.]`;
    }

    const prompt = `
      You are a strict CIE Economics Examiner. Grade the following student work.
      
      **Question:** ${question.questionText}
      **Max Marks:** ${question.maxMarks}
      **Official Mark Scheme Reference:** ${question.markScheme}
      **Student Work:** ${essayContent}

      ${CIE_LOGIC_TRUTH}

      **GRADING INSTRUCTIONS (STRICT FORMAT REQUIRED):**

      # 🚨 Section 1: Fatal Logic Check
      [Verify the direction of all curve shifts. If the student shifted AS the wrong way or had an AD logic reversal, label it clearly here. If logic is perfect, state: "LOGIC: No fundamental direction errors detected."]

      # 📊 Section 2: Scoring Summary
      **Total Score: X / ${question.maxMarks}**
      [Brief high-level summary of the essay's quality]

      # 🎯 Section 3: Mark Scheme Alignment
      - **Points Hit:** [Specific points from the official MS found in the essay]
      - **Points Missed:** [Critical points from the official MS that are missing]

      # 📝 Section 4: Paragraph-by-Paragraph Commentary
      [Provide a deep-dive analysis for every paragraph/section of the student's work.]
      **Paragraph 1 (Intro):** ...
      **Paragraph 2 (Analysis Chain 1):** [Check if the steps A -> B -> C are complete and in the right direction.]
      **Paragraph 3 (Analysis Chain 2):** ...
      **Paragraph 4+ (Evaluation/Conclusion):** ...

      # 📉 Section 5: AO Breakdown & Rewrite Suggestions
      ### AO1: Knowledge (X/Max)
      **Strengths/Weaknesses:** ...
      ### AO2: Analysis (X/Max)
      **Critical Flaws:** [Mention any logic jumps or reversals]
      **Standard Logic Chain Rewrite:** [Provide the EXACT A -> B -> C logic the student should have used to get full marks]
      ### AO3: Evaluation (X/Max)
      **Suggestions:** ...
    `;

    parts.push({ text: prompt });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: parts },
      config: { temperature: 0 }
    });
    return response.text || "Error grading essay.";
  } catch (error) {
    return "Failed to grade essay. Check API key.";
  }
};

export const getRealTimeCoaching = async (question: Question, currentText: string): Promise<{ao1: number, ao2: number, ao3: number, total: number, advice: string}> => {
  try {
    checkForApiKey();
    const prompt = `
      You are a strict CIE Economics Coach. Analyze the draft: "${currentText}"
      Question: ${question.questionText}
      
      ${CIE_LOGIC_TRUTH}

      **COACHING TASK:**
      1. Check for directional errors (AS/AD moving wrong way).
      2. Check for missing logic steps.
      3. Return ONLY a JSON object.

      {
        "ao1": score, 
        "ao2": score, 
        "ao3": score, 
        "total": total,
        "advice": "Start with '⚠️ LOGIC ERROR' if a reversal is found. Otherwise, list missing Mark Scheme points."
      }
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    return { ao1: 0, ao2: 0, ao3: 0, total: 0, advice: "Coaching unavailable." };
  }
};

export const generateClozeExercise = async (modelEssay: string): Promise<{ textWithBlanks: string, blanks: ClozeBlank[] } | null> => {
  try {
    checkForApiKey();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Create a logic chain cloze exercise from: ${modelEssay}`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { return null; }
};

export const evaluateClozeAnswers = async (blanks: ClozeBlank[], userAnswers: Record<number, string>): Promise<Record<number, ClozeFeedback> | null> => {
  try {
    checkForApiKey();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Grade these: ${JSON.stringify(userAnswers)} against ${JSON.stringify(blanks)}`,
      config: { responseMimeType: "application/json" }
    });
    const json = JSON.parse(response.text || "{}");
    const map: Record<number, ClozeFeedback> = {};
    json.feedback?.forEach((f: any) => map[f.id] = f);
    return map;
  } catch (error) { return null; }
};

export const analyzeTopicMarkSchemes = async (chapterTitle: string, questions: Question[]): Promise<ChapterAnalysis | null> => {
  try {
    checkForApiKey();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze trends for ${chapterTitle}: ${JSON.stringify(questions)}`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { return null; }
};

export const improveSnippet = async (snippet: string, context?: string): Promise<{ improved: string, explanation: string, aoFocus: string }> => {
  try {
    checkForApiKey();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Improve this CIE Economics snippet: ${snippet}. Context: ${context}\n\n${CIE_LOGIC_TRUTH}`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { return { improved: "", explanation: "Error", aoFocus: "" }; }
};

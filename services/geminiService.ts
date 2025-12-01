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
        throw new Error("API Key is missing. Please go to Vercel Settings -> Environment Variables and add API_KEY.");
    }
};

export const generateModelAnswer = async (question: Question): Promise<string> => {
  try {
    checkForApiKey();
    
    let instructions = "";

    if (question.maxMarks === 8) {
      instructions = `
      **Structure Requirements for 8 Marks (Part a):**
      
      **[AO1: Knowledge & Understanding] (3 marks)**
      - Provide precise, textbook definitions. 
      - Example: Do not just say "inflation is rising prices". Say "inflation is a sustained increase in the general price level".
      - If a diagram is relevant, describe it explicitly (axes, curves, shifts).
      
      **[AO2: Analysis] (3 marks)**
      - **CRITICAL:** Use complete logical chains of reasoning (A -> B -> C -> D).
      - Do not skip steps. Explain the *mechanism*.
      - Example: Instead of "Depreciation increases inflation", write "Depreciation reduces the exchange rate -> imports become relatively more expensive -> costs of raw materials rise -> SRAS shifts left -> Cost-Push Inflation."
      
      **[AO3: Evaluation] (2 marks)**
      - Provide a specific evaluative comment based on the context (e.g., "This is more likely in countries with few natural resources because...").
      - **Mandatory:** A clear, justified conclusion.
      `;
    } else if (question.maxMarks === 12) {
      instructions = `
      **Structure Requirements for 12 Marks (Part b):**
      
      **[AO1 & AO2: Knowledge, Understanding & Analysis] (8 marks)**
      - **Detailed** logical chains are required. No assertions without explanation.
      - **Context:** You MUST apply your analysis to the specific context in the question (e.g., "high income country", "developing economy").
      - Provide a balanced argument (Pros vs Cons, or Method A vs Method B).
      
      **[AO3: Evaluation] (4 marks)**
      - Critically assess the arguments (e.g., assumptions, short-run vs long-run, elasticity, magnitude).
      - Provide a detailed, justified conclusion that weighs the arguments.
      `;
    } else {
      instructions = `
      **General High-Standard Requirements:**
      - **AO1:** Define key terms precisely.
      - **AO2:** Develop detailed analytical chains. No logical jumps.
      - **AO3:** Evaluate significance and conclude.
      `;
    }

    const prompt = `
      You are a **world-class Cambridge International AS Level Economics Examiner**.
      Write a **perfect, full-mark model essay** for the following question.
      
      **Question:** ${question.questionText}
      **Max Marks:** ${question.maxMarks}
      **Mark Scheme Guidance:**
      ${question.markScheme}
      
      **Strict Writing Standards:**
      1. **Precision:** Use exact economic terminology (e.g., "Aggregate Demand", "Real GDP", "SRAS", "Purchasing Power").
      2. **Logical Chains:** Never make an assertion without explaining the mechanism. Every point must form a closed loop.
      3. **Context is King:** If the question mentions a specific scenario (e.g., "country with few natural resources"), your answer **must** hinge on that fact.
      
      **Instructions:**
      ${instructions}
      
      - The tone should be academic, professional, and exam-focused.
      - Use the bold headers exactly as specified above.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Error generating response.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message.includes("API Key")) {
        return "Error: API Key is missing in Vercel Settings. Please configure it and redeploy.";
    }
    return "Failed to generate essay. Please check API key or try again.";
  }
};

export const gradeEssay = async (question: Question, studentEssay: string, imagesBase64?: string[]): Promise<string> => {
  try {
    checkForApiKey();

    const parts: any[] = [];
    
    let essayContentText = studentEssay;

    if (imagesBase64 && imagesBase64.length > 0) {
       imagesBase64.forEach((img) => {
         // Attempt to detect mime type from base64 header, default to jpeg
         const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,/);
         const mimeType = match ? match[1] : 'image/jpeg';
         const cleanBase64 = img.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

         parts.push({
            inlineData: {
               mimeType: mimeType,
               data: cleanBase64
            }
         });
       });

       const imageNote = `\n\n[Note: The student has attached ${imagesBase64.length} page(s) of handwritten notes. Please treat them as a sequence constituting the full answer.]`;
       
       if (!essayContentText.trim()) {
           essayContentText = "See attached images for the student's handwritten essay." + imageNote;
       } else {
           essayContentText += imageNote;
       }
    }

    let gradingRubric = "";
    let rubricTitle = "";

    if (question.maxMarks === 8) {
       rubricTitle = "Cambridge AS Level 8-Mark Rubric (Strict)";
       gradingRubric = `
       **Strict Marking Logic (3/3/2 Split):**
       
       **AO1: Knowledge & Understanding (3 marks)**
       - **Requirements:** Precise definitions + Accurate Diagram (if asked/relevant).
       - **Strictness:** 
         - "Inflation is rising prices" = 0 marks. 
         - "Inflation is a sustained increase in the general price level" = 1 mark.
         - If a diagram is missing or inaccurate when asked for, cap AO1.

       **AO2: Analysis (3 marks)**
       - **Requirements:** DETAILED Logical Chains of Reasoning (A -> B -> C -> D).
       - **Strictness:** 
         - **0 Marks for Assertions:** "Depreciation causes inflation" is an assertion. 0 Marks.
         - **High Marks:** Must show the mechanism. "Depreciation reduces the value of currency -> import prices rise -> raw material costs increase -> SRAS shifts left -> Cost Push Inflation."
         - **Context:** If the question mentions "few natural resources", the analysis MUST explain why this matters (e.g., dependency on imports).

       **AO3: Evaluation (2 marks)**
       - 1 mark for specific evaluative comment (e.g., "depends on PED of imports").
       - 1 mark **strictly** for a valid Conclusion.
       `;
    } else {
       // 12 Mark Logic based on Tables A & B from Official Mark Scheme
       rubricTitle = "Cambridge AS Level 12-Mark Levels-Based Rubric (Strict)";
       gradingRubric = `
       **TABLE A: AO1 Knowledge & Understanding + AO2 Analysis (Max 8 marks)**
       
       *Level 3 (6–8 marks):*
       - **Detailed** knowledge and **Developed** analysis.
       - **Logical Chains:** Reasoning must be complete (no logical jumps). 
         - *Bad:* "Investment increases growth." 
         - *Good:* "Investment is a component of AD -> AD shifts right -> Real GDP increases -> Economic Growth." OR "Investment increases capital stock -> LRAS shifts right -> Potential growth."
       - **Context:** Analysis must be applied to the specific context in the question.
       
       *Level 2 (3–5 marks):*
       - Some knowledge, but explanations are limited or generic.
       - **Assertions:** Points are stated but not fully explained.
       - **Partial Accuracy:** Diagrams may be missing labels or shifts.
       - **One-sided:** Answers that only look at one side (e.g., only advantages) are CAPPED at Level 2.

       *Level 1 (1–2 marks):*
       - Descriptive, errors, or very brief.

       **TABLE B: AO3 Evaluation (Max 4 marks)**
       
       *Level 2 (3–4 marks):*
       - **Justified Conclusion:** The conclusion must follow logically from the analysis.
       - **Developed Evaluation:** "Depends on X" is explained (e.g., "Depends on the elasticity of demand because if PED is inelastic...").
       
       *Level 1 (1–2 marks):*
       - Vague/General conclusion ("It depends").
       - **One-sided:** Answers that are one-sided get 0 marks for Evaluation.
       `;
    }

    const prompt = `
      You are a **strict** Cambridge International AS Level Economics (9708) Examiner.
      Your goal is to grade the student's essay to professional standards, specifically penalizing logical gaps and superficial answers.

      **CRITICAL GRADING RULES:**
      1. **No "Benefit of the Doubt":** If a student skips a logical step (e.g. jumps from "depreciation" to "inflation" without explaining *import prices*), DO NOT give credit for Analysis. Mark it as an Assertion.
      2. **Terminology:** Require standard economic terms (e.g., "Aggregate Demand", "Real GDP", "SRAS", "Purchasing Power").
      3. **The "Why" Rule:** Every point must form a logical loop.
         - *Example of Failure:* "Depreciation increases exports." (Assertion)
         - *Example of Success:* "Depreciation makes exports cheaper in foreign currency terms -> increases international competitiveness -> quantity demanded for exports rises -> Export revenue rises (assuming elastic demand)." (Analysis)
      4. **Context Matters:** If the question includes specific context (e.g., "low income country", "resource scarce"), the answer MUST use that context to get top marks.
      5. **Multiple Pages:** If multiple images are provided, they are ordered pages of the same essay. Read them sequentially.

      **Question:** ${question.questionText}
      **Max Marks:** ${question.maxMarks}
      
      **Official Mark Scheme Guidance:**
      ${question.markScheme}

      **${rubricTitle}:**
      ${gradingRubric}

      **Student Essay:**
      ${essayContentText}

      **Instructions for Output:**
      1. **Total Score:** Give a specific mark out of ${question.maxMarks}. Be stingy.
      2. **Breakdown:** Show marks for AO1, AO2, and AO3 separately.
      3. **Detailed Critique:**
         - **Identify Logical Jumps:** Quote specific sentences where the student made an **Assertion** instead of an **Explanation**. Show exactly what step was missing.
         - **Context Check:** Did they use the specific context (e.g. "few natural resources")? If not, penalize.
         - **Terminology:** Highlight imprecise language.
         - **Next Step:** Provide one concrete way to turn their Level 2 point into a Level 3 point.
    `;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: parts },
    });
    return response.text || "Error grading essay.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message.includes("API Key")) {
        return "Error: API Key is missing in Vercel Settings.";
    }
    return "Failed to grade essay. Please check API key.";
  }
};

export const getRealTimeCoaching = async (question: Question, currentText: string): Promise<{ao1: number, ao2: number, ao3: number, total: number, advice: string}> => {
  try {
    checkForApiKey();

    let distribution = "";
    
    if (question.maxMarks === 8) {
        distribution = "Max Marks Distribution: AO1: 3, AO2: 3, AO3: 2";
    } else if (question.maxMarks === 12) {
        distribution = "Max Marks Distribution: AO1+AO2: 8, AO3: 4.";
    } else {
        distribution = `Max Marks: ${question.maxMarks}`;
    }

    const prompt = `
      You are a **strict** Cambridge Economics Examiner watching a student write in real-time.
      
      **Question:** ${question.questionText}
      **Total Marks:** ${question.maxMarks}
      **${distribution}**
      **Mark Scheme:** ${question.markScheme}
      **Current Draft:** "${currentText}"

      **Grading Standards:**
      - **AO1:** Only award if definitions are precise (e.g. "SRAS shift", not just "supply change").
      - **AO2:** Only award if **logical chains are complete**. If they jump from A to Z, do not give the mark. They must show the mechanism (A -> B -> C -> Z).
      - **AO3:** Only award for evaluation that refers to the specific context (e.g., "few natural resources").

      **Task:**
      1. Estimate current AO1, AO2, AO3 scores (integers). Be stingy.
      2. Calculate Total.
      3. **Advice:** Identify the most immediate logical gap. 
         - *Example:* "You said depreciation causes inflation. Explain WHY. Mention import prices and production costs."
         - *Example:* "You defined inflation loosely. Use 'sustained increase in general price level'."
      4. Keep advice brief (under 50 words).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ao1: { type: Type.INTEGER, description: "Strict score for Knowledge & Understanding" },
            ao2: { type: Type.INTEGER, description: "Strict score for Analysis (Logical Chains)" },
            ao3: { type: Type.INTEGER, description: "Strict score for Evaluation (Context)" },
            total: { type: Type.INTEGER, description: "Total score" },
            advice: { type: Type.STRING }
          },
          required: ["ao1", "ao2", "ao3", "total", "advice"],
          propertyOrdering: ["total", "ao1", "ao2", "ao3", "advice"]
        }
      }
    });
    
    const json = JSON.parse(response.text || "{}");
    return {
        ao1: json.ao1 || 0,
        ao2: json.ao2 || 0,
        ao3: json.ao3 || 0,
        total: json.total || 0,
        advice: json.advice || "Keep writing..."
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { ao1: 0, ao2: 0, ao3: 0, total: 0, advice: "Check API Key" };
  }
};

export const generateClozeExercise = async (modelEssay: string): Promise<{ textWithBlanks: string, blanks: ClozeBlank[] } | null> => {
  try {
    checkForApiKey();

    const prompt = `
      You are an expert Economics teacher creating a "Logic Chain" completion exercise.
      Take the provided model essay and create a fill-in-the-blank (cloze) test.

      **Instructions:**
      1. Identify **8 to 12** critical parts to remove.
      2. Target:
         - **AO1:** Key definitions/terms.
         - **AO2:** Logical connectors or middle steps in analysis chains.
         - **AO3:** Evaluative qualifiers.
      3. Replace with [BLANK_1], [BLANK_2], etc.
      4. Return JSON with the text and the list of blanks + hints.
      
      **Input Essay:**
      ${modelEssay}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
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
                  id: { type: Type.INTEGER },
                  original: { type: Type.STRING },
                  hint: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    return {
      textWithBlanks: json.textWithBlanks,
      blanks: json.blanks
    };
  } catch (error) {
    console.error("Cloze Generation Error:", error);
    return null;
  }
};

export const evaluateClozeAnswers = async (
  blanks: ClozeBlank[],
  userAnswers: Record<number, string>
): Promise<Record<number, ClozeFeedback> | null> => {
  
  try {
    checkForApiKey();

    const comparisons = blanks.map(b => ({
      id: b.id,
      original: b.original,
      studentAnswer: userAnswers[b.id] || "(No answer)"
    }));

    const prompt = `
      Grade the student's answers for a fill-in-the-blank Economics exercise.
      
      **Data:**
      ${JSON.stringify(comparisons)}

      **Instructions:**
      For each item:
      1. Compare Student Answer to Original.
      2. Score (1-5): 5 = Perfect logic/meaning (exact words not needed), 1 = Incorrect.
      3. Provide a 1-sentence comment.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
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
                  id: { type: Type.INTEGER },
                  score: { type: Type.INTEGER },
                  comment: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    const feedbackMap: Record<number, ClozeFeedback> = {};
    
    if (json.feedback && Array.isArray(json.feedback)) {
      json.feedback.forEach((item: any) => {
        feedbackMap[item.id] = {
          score: item.score,
          comment: item.comment
        };
      });
    }
    
    return feedbackMap;

  } catch (error) {
    console.error("Cloze Evaluation Error:", error);
    return null;
  }
};

export const analyzeTopicMarkSchemes = async (
  chapterTitle: string, 
  questions: Question[]
): Promise<ChapterAnalysis | null> => {
  try {
    checkForApiKey();

    // Prepare inputs: ID, Year/Variant, Question Text, Mark Scheme
    const inputs = questions.map(q => ({
      ref: `${q.year} ${q.variant} Q${q.questionNumber}`,
      text: q.questionText,
      ms: q.markScheme
    }));

    const prompt = `
      You are a senior Cambridge Economics Examiner.
      I have provided a list of questions and their mark schemes for the chapter: "${chapterTitle}".
      
      **Your Task:**
      Analyze these to create a "Master Summary" of what is required for AO1, AO2, and AO3 in this specific chapter.
      Group similar points together. For example, if multiple questions ask for the definition of "Public Good", merge them into one AO1 point and list all source references.

      **Input Data:**
      ${JSON.stringify(inputs)}

      **Output Requirements (JSON):**
      - **ao1 (Knowledge):** List key definitions, diagrams, and facts required.
      - **ao2 (Analysis):** List common logical chains or analytical mechanisms (e.g. "Price mechanism functions").
      - **ao3 (Evaluation):** List common evaluation arguments or judgment criteria used in this chapter.
      
      For each point, provide:
      - 'point': A concise summary of the requirement.
      - 'sourceRefs': An array of the 'ref' strings provided in the input (e.g. ["2023 May/June Q2a", "2024 Feb/March Q3b"]).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ao1: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  point: { type: Type.STRING },
                  sourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            ao2: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  point: { type: Type.STRING },
                  sourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            ao3: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  point: { type: Type.STRING },
                  sourceRefs: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    
    return {
      chapter: chapterTitle,
      lastUpdated: new Date().toISOString(),
      questionCount: questions.length,
      ao1: json.ao1 || [],
      ao2: json.ao2 || [],
      ao3: json.ao3 || []
    };

  } catch (error) {
    console.error("Topic Analysis Error:", error);
    return null;
  }
};

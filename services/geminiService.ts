import { GoogleGenAI, Type } from "@google/genai";
import { Question, ClozeBlank, ClozeFeedback } from "../types";

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
      
      **[AO1: Knowledge & Understanding] (Max 3 marks)**
      - Clearly define key economic terms.
      - If applicable, describe the diagram clearly.
      
      **[AO2: Analysis] (Max 3 marks)**
      - Explain the economic theory/mechanism.
      - Use logical chains of reasoning (Cause -> Effect -> Consequence).
      
      **[AO3: Evaluation] (Max 2 marks)**
      - Provide a brief evaluative comment (e.g., short-run vs long-run, elasticity).
      - **CRITICAL:** You MUST provide a valid Conclusion. 1 mark is strictly reserved for the conclusion.
      `;
    } else if (question.maxMarks === 12) {
      instructions = `
      **Structure Requirements for 12 Marks (Part b):**
      
      **[AO1 & AO2: Knowledge, Understanding & Analysis] (Max 8 marks)**
      - Provide comprehensive knowledge and detailed analysis together.
      - Use diagrams where relevant to support analysis.
      - Develop logical chains of reasoning fully.
      - Cover both sides of the argument if the question is "Assess" or "Discuss".
      
      **[AO3: Evaluation] (Max 4 marks)**
      - Critically assess the arguments (e.g., assumptions, effectiveness, magnitude).
      - Provide a detailed, justified conclusion.
      `;
    } else {
      // Fallback for custom questions not following standard mark patterns
      instructions = `
      **[AO1: Knowledge & Understanding]**
      - Define key terms clearly.
      
      **[AO2: Analysis]**
      - Develop analytical points with logical chains.
      
      **[AO3: Evaluation]**
      - Evaluate the extent/significance.
      - Provide a conclusion.
      `;
    }

    const prompt = `
      You are a world-class Cambridge International AS Level Economics teacher.
      Write a model essay answer for the following question.
      
      **Question:** ${question.questionText}
      **Max Marks:** ${question.maxMarks}
      **Mark Scheme Requirements:**
      ${question.markScheme}
      
      **Instructions:**
      ${instructions}
      
      - Use precise economic terminology.
      - The tone should be academic and exam-focused.
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

export const gradeEssay = async (question: Question, studentEssay: string, imageBase64?: string): Promise<string> => {
  try {
    checkForApiKey();

    const parts: any[] = [];
    
    let essayContentText = studentEssay;

    if (imageBase64) {
       const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
       parts.push({
          inlineData: {
             mimeType: 'image/jpeg',
             data: cleanBase64
          }
       });
       essayContentText = "See attached image for the student's handwritten essay.";
    }

    let gradingRubric = "";
    let rubricTitle = "";

    if (question.maxMarks === 8) {
       rubricTitle = "Cambridge AS Level 8-Mark Rubric";
       gradingRubric = `
       **Marking Logic (Strict adherence required):**
       
       **AO1: Knowledge & Understanding (3 marks)**
       - 1 mark for each accurate definition or identification of a key concept.
       - 1 mark for an accurate, fully labelled diagram (if applicable).
       - *Penalty:* Inaccurate definitions or incomplete diagrams (missing labels, wrong shifts) lose marks.

       **AO2: Analysis (3 marks)**
       - Award marks for **developed chains of reasoning** (Cause -> Effect -> Consequence).
       - **Zero marks** for "assertions" (statements without explanation).
       - Example of assertion (0 marks): "Lower interest rates increase investment."
       - Example of analysis (1 mark): "Lower interest rates reduce the cost of borrowing, which increases the profitability of projects, incentivizing firms to invest."

       **AO3: Evaluation (2 marks)**
       - 1 mark for a specific evaluative comment (e.g., depends on elasticity, time lag, or ceteris paribus).
       - **1 mark strictly reserved for a valid Conclusion.** No conclusion = Max 1/2 for AO3.
       `;
    } else {
       // 12 Mark Logic based on Tables A & B from Official Mark Scheme
       rubricTitle = "Cambridge AS Level 12-Mark Levels-Based Rubric";
       gradingRubric = `
       **TABLE A: AO1 Knowledge & Understanding + AO2 Analysis (Max 8 marks)**
       
       *Level 3 (6–8 marks):*
       - Detailed knowledge of relevant concepts.
       - Analysis is **developed** and **detailed** with accurate chains of reasoning.
       - Accurate use of diagrams/formulae where necessary.
       - Well-organized and focused.
       
       *Level 2 (3–5 marks):*
       - Some knowledge, but explanations may be limited, over-generalized, or contain inaccuracies.
       - Analysis is present but lacks detail (more assertions than explanations).
       - Diagrams may be partially accurate or not fully explained.
       - **CRITICAL:** One-sided answers (only advantages OR disadvantages) are capped at **Level 2 (Max 5 marks)** for this section.

       *Level 1 (1–2 marks):*
       - Small number of relevant points.
       - Significant errors or omissions.
       - Largely descriptive with little economic analysis.

       **TABLE B: AO3 Evaluation (Max 4 marks)**
       
       *Level 2 (3–4 marks):*
       - Provides a **justified conclusion** that addresses the specific question.
       - Making developed, reasoned, and well-supported evaluative comments throughout.
       
       *Level 1 (1–2 marks):*
       - Vague or general conclusion.
       - Simple evaluative comments with no development or supporting evidence.
       - **CRITICAL:** One-sided answers cannot gain **ANY** evaluation marks (0/4).

       **Common Examiner Deductions (Apply these strictly):**
       - **Assertion vs. Explanation:** Do not credit points that are simply stated. "X leads to Y" is an assertion. "X leads to Y because Z..." is analysis.
       - **Diagrams:** If a diagram is drawn but not referred to in the text, or is inaccurate (missing labels, wrong equilibrium), reduce marks.
       - **Focus:** If the question asks for "Best Way", and the student only discusses one way, cap marks significantly.
       `;
    }

    const prompt = `
      You are a **strict** Cambridge International AS Level Economics (9708) Examiner.
      Your task is to grade the student's essay **harshly and accurately** against the official standard.
      
      **Do not be benevolent.** High marks (Level 3) are reserved only for answers that demonstrate detailed logical chains of reasoning and accurate conceptual understanding.

      **Question:** ${question.questionText}
      **Max Marks:** ${question.maxMarks}
      
      **Official Mark Scheme Guidance:**
      ${question.markScheme}

      **${rubricTitle}:**
      ${gradingRubric}

      **Student Essay:**
      ${essayContentText}

      **Instructions for Output:**
      1. **Total Score:** Give a specific mark out of ${question.maxMarks}.
      2. **Breakdown:** Show marks for AO1, AO2, and AO3 separately.
      3. **Examiner Feedback:**
         - Identify specific **Assertions** that should have been **Explanations**. Quote the student's text and say "This is an assertion. To get marks, you needed to explain..."
         - Identify any errors in diagrams or definitions.
         - If the answer is one-sided (for 12 marks), explicitly state that marks were capped due to lack of balance.
         - Provide one clear "Next Step" for improvement.
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

export const getRealTimeCoaching = async (question: Question, currentText: string): Promise<{scoreEstimate: string, advice: string}> => {
  try {
    checkForApiKey();

    const prompt = `
      You are a helpful Economics tutor watching a student write an essay in real-time.
      
      **Question:** ${question.questionText}
      **Marks:** ${question.maxMarks}
      **Mark Scheme:** ${question.markScheme}
      **Current Draft:** "${currentText}"

      **Task:**
      1. Estimate the current mark range (e.g., "2-3 marks").
      2. Provide ONE specific, actionable tip to get the *next* mark based on the Mark Scheme.
      3. Keep it brief (under 50 words).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scoreEstimate: { type: Type.STRING },
            advice: { type: Type.STRING }
          },
          propertyOrdering: ["scoreEstimate", "advice"]
        }
      }
    });
    
    const json = JSON.parse(response.text || "{}");
    return {
        scoreEstimate: json.scoreEstimate || "Unknown",
        advice: json.advice || "Keep writing..."
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { scoreEstimate: "...", advice: "Check API Key" };
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

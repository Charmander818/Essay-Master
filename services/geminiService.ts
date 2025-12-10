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
      **STRICT STRUCTURE FOR 8 MARKS (Part a):**
      
      **1. Deconstruct the Question (Mental Step):**
      - Identify the "AND" in the question. You MUST address the part before the "and" and the part after the "and".
      - Even if the second part is small ("consider the extent"), you must follow the structure below.
      
      **2. Introduction (AO1 - Bookwork):**
      - Define the Key Terms exactly as they appear in the CIE Textbook. 
      - Do not "wing it". Use formal definitions.
      
      **3. AO2 Analysis (The Core):**
      - **Rule:** Analyze Side A and Side B **INDEPENDENTLY**. 
      - **Do NOT compare** them here. Comparison belongs in AO3.
      - **Paragraph Structure:** Topic Sentence -> Logical Chain (A leads to B leads to C leads to Z) -> Economic Term.
      - **Content:** 
        - Explain the mechanism for the part before the "and".
        - Explain the mechanism for the part after the "and".
      
      **4. AO3 Evaluation (The Judgment):**
      - **Task:** Answer the "Extent" or "Whether".
      - **Structure:** 
        - "In what specific situation is A true?"
        - "In what specific situation is B true?"
        - **Conclusion:** A clear judgment supported by a specific justification (not just "it is not always effective").
      `;
    } else if (question.maxMarks === 12) {
      instructions = `
      **STRICT STRUCTURE FOR 12 MARKS (Part b):**
      
      **1. Introduction:**
      - Define Key Terms (if not done in Part a).
      - **Crucial:** State your intended answer/thesis immediately (e.g., "Inflation is generally more serious than unemployment because..."). Do not wait until the end to reveal your stance.
      
      **2. Body Paragraphs (AO2 - Analysis):**
      - **Requirement:** 6 distinct points/paragraphs (e.g., 3 Pros / 3 Cons, or Policy A + 2 limits / Policy B + 2 limits).
      - **Paragraph Formula:** 
        1. **Topic Sentence:** State the specific point.
        2. **Logical Chain:** Explain the mechanism step-by-step (A -> B -> C -> Z). Never skip steps.
        3. **Economic Terminology:** Use precise words.
      
      **3. Conclusion (AO3 - Evaluation):**
      - **The Judgment:** Provide a final decision.
      - **The Justification:** Provide at least 2 specific reasons (e.g., "It depends on the time lag...", "It depends on the elasticity...").
      - **Context:** Must relate to the specific economy type mentioned (e.g., Developing, High Income).
      `;
    } else {
      instructions = `
      **General High-Standard Requirements:**
      - **AO1:** Textbook definitions.
      - **AO2:** Detailed analytical chains. A -> B -> C -> Z.
      - **AO3:** Evaluate "Depends on" factors and conclude.
      `;
    }

    const prompt = `
      You are a **world-class Cambridge International AS Level Economics Examiner and Tutor**.
      Write a **perfect, full-mark model essay** for the following question.
      
      **Question:** ${question.questionText}
      **Max Marks:** ${question.maxMarks}
      **Mark Scheme Guidance:**
      ${question.markScheme}
      
      **Writing Philosophy:**
      1. **AO1 is Bookwork:** Definitions must be textbook accurate.
      2. **AO2 is Logic:** Every paragraph must have a Topic Sentence and a complete Logical Chain (A->Z).
      3. **AO3 is Extent:** For "Extent/Assess" questions, AO2 analyzes sides separately. AO3 provides the comparison ("When is A better? When is B better?").
      
      **Instructions:**
      ${instructions}
      
      - The tone should be academic, professional, and exam-focused.
      - Use bold headers for **Introduction**, **Analysis**, and **Evaluation**.
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

export const generateQuestionDeconstruction = async (questionText: string): Promise<string> => {
    try {
        checkForApiKey();
        const prompt = `
        You are an expert Economics tutor helping a student decode an exam question.
        
        **Question:** "${questionText}"
        
        **Official CIE Command Word Definitions:**
        The student must adhere to these definitions when answering:
        - **Analyse**: examine in detail to show meaning, identify elements and the relationship between them
        - **Assess**: make an informed judgement
        - **Calculate**: work out from given facts, figures or information
        - **Comment**: give an informed opinion
        - **Compare**: identify/comment on similarities and/or differences
        - **Consider**: review and respond to given information
        - **Define**: give precise meaning
        - **Demonstrate**: show how or give an example
        - **Describe**: state the points of a topic / give characteristics and main features
        - **Discuss**: write about issue(s) or topic(s) in depth in a structured way
        - **Evaluate**: judge or calculate the quality, importance, amount, or value of something
        - **Explain**: set out purposes or reasons / make the relationships between things clear / say why and/or how and support with relevant evidence
        - **Give**: produce an answer from a given source or recall/memory
        - **Identify**: name/select/recognise
        - **Justify**: support a case with evidence/argument
        - **Outline**: set out the main points
        - **State**: express in clear terms

        **Task:** 
        Break down this question prompt into its components.
        
        **Required Output Format (Markdown):**
        
        **1. Command Word Analysis**
        - **Command Word:** [e.g. "Assess" or "Explain"]
        - **Definition:** [Quote the specific definition from the list above]
        - **Implication:** [Briefly explain what this means for the essay structure, e.g., "Requires a two-sided argument ending with a judgment"]

        **2. AO1 (Knowledge & Understanding)**
        *Identifying Key Terms:*
        - "[Quote word from question]" → Requires definition of...
        - "[Quote phrase]" → Requires explanation of concept...
        
        **3. AO2 (Analysis)**
        *Identifying the Mechanism:*
        - "[Quote 'Explain', 'Analyse' or causal phrase]" → Requires a logical chain connecting [X] to [Y].
        - Identify the specific relationships to analyse (e.g., "Relationship between Interest Rates and Investment").
        - *Guidance:* Refer back to the command word definition (e.g., if "Explain", ensure relationships are made clear).
        
        **4. AO3 (Evaluation)**
        *Identifying the Debate:*
        - "[Quote 'Assess', 'Evaluate', 'Consider', 'Discuss']" → Requires judgment.
        - *Context Clue:* "[Quote specific context e.g., 'low income country']" → Evaluation must focus on this specific scenario.
        - Identify the counter-argument or "it depends" factors required here.
        
        Keep it concise and actionable.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || "Error analyzing question.";
    } catch (error: any) {
        console.error("Deconstruction Error:", error);
        return "Failed to analyze question. Check API Key.";
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
    
    if (question.maxMarks === 8) {
       gradingRubric = `
       **Strict Marking Logic (Part a - 8 Marks):**
       
       **Structure Check (Crucial):**
       - Did the student identify the "AND" in the question? 
       - Did they address the part *before* the "and" and the part *after* the "and"?
       - **AO2 Rule:** Did they analyze the sides **independently** without mixing comparison into the analysis paragraphs? Comparison belongs in Conclusion.
       
       **AO1 (3 marks): Bookwork**
       - Definitions must be precise textbook definitions.
       - "Inflation is rising prices" = 0. "Sustained increase in general price level" = 1.
       
       **AO2 (3 marks): Logic Chains**
       - Paragraphs must follow: Topic Sentence -> Logical Chain (A->B->C->Z) -> Terminology.
       - Penalize "Assertions" (statements without the 'why').
       
       **AO3 (2 marks): Evaluation**
       - 1 mark: Answering the "extent" (When is A true? When is B true?).
       - 1 mark: Valid justification/Conclusion.
       `;
    } else {
       gradingRubric = `
       **Strict Marking Logic (Part b - 12 Marks):**
       
       **Structure Check:**
       - **Intro:** Did they answer the question/state a thesis immediately?
       - **Body:** Are there distinct points (e.g. 3 Pros / 3 Cons)? One point per paragraph?
       
       **AO1 + AO2 (Max 8 marks):**
       - **Chain of Reasoning:** Look for "A -> B -> C -> Z". 
       - If they skip steps (e.g., "Investment leads to growth" without explaining AD or LRAS), mark as L2 (max 5 marks).
       - **Context:** Must apply to the specific context (e.g. "Developing Economy").
       
       **AO3 (Max 4 marks):**
       - **Judgment:** A clear final decision.
       - **Justification:** Must include "Depends on" factors (Time lags, Elasticity, etc.).
       - **Justification Score:** 2 marks are strictly for the justifications. "Not always effective" is not enough. Why?
       `;
    }

    const prompt = `
      You are a **strict** Cambridge International AS Level Economics (9708) Examiner.
      Your goal is to grade the student's essay to professional standards.

      **CRITICAL GRADING PHILOSOPHY:**
      1. **AO1 is Bookwork:** If definitions don't match the textbook, penalize.
      2. **AO2 is Logical Chains:** "A causes Z" is an assertion (0 marks). "A causes B, which causes C, leading to Z" is analysis.
      3. **Structure Matters:** 
         - For 8-mark questions, ensure they split the answer based on the "AND" in the prompt.
         - For 12-mark questions, ensure they have an introduction that answers the question and a balanced body.
      4. **Evaluation (AO3):** Requires "When/If" logic (e.g., "This policy is best WHEN demand is elastic...").

      **Question:** ${question.questionText}
      **Max Marks:** ${question.maxMarks}
      
      **Official Mark Scheme Guidance:**
      ${question.markScheme}

      **Rubric:**
      ${gradingRubric}

      **Student Essay:**
      ${essayContentText}

      **Instructions for Output:**
      1. **Total Score:** Give a specific mark out of ${question.maxMarks}. Be stingy.
      2. **Breakdown:** Show marks for AO1, AO2, and AO3 separately.
      3. **Detailed Critique:**
         - **Structure Check:** Comment on whether they followed the Part (a) vs Part (b) structure correctly.
         - **Logical Gaps:** Quote where they made an assertion instead of a chain.
         - **Next Step:** Provide one concrete way to improve the logical chain or structure.
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
      Analyze these to create a "Master Summary" of requirements for this chapter.
      
      **Specific Focus on Debates & Evaluation:**
      This chapter likely contains comparative debates (e.g., Market vs Mixed Economy, Indirect Tax vs Subsidy).
      I need you to extract these specific comparisons and evaluations.
      
      **Input Data:**
      ${JSON.stringify(inputs)}

      **Output Requirements (JSON):**
      
      1. **ao1 (Knowledge):** Key definitions/facts.
      2. **ao2 (Analysis):** Common logical chains.
      3. **ao3 (Evaluation):** General evaluation points.
      
      4. **debates (NEW SECTION):** 
         Identify specific comparative topics or policy evaluations found in these questions.
         For each topic (e.g., "Planned Economy", "Subsidies", "Market Mechanism"), provide:
         - **pros**: List of benefits/advantages/effectiveness arguments.
         - **cons**: List of limitations/disadvantages/problems (The "However..." points).
         - **dependencies**: List of "Depends on..." factors (e.g., "Depends on PED", "Depends on government information").
      
      For each point in all sections, provide 'sourceRefs' (e.g. ["2023 May/June Q2a"]).
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
            },
            debates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING, description: "The subject of the debate (e.g. Market Economy)" },
                  pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                  cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                  dependencies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Factors that determine success (Depends on...)" },
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
      ao3: json.ao3 || [],
      debates: json.debates || []
    };

  } catch (error) {
    console.error("Topic Analysis Error:", error);
    return null;
  }
};
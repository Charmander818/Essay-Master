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
    
    const cieStandards = `
    **CIE ECONOMICS WRITING STANDARDS (STRICT ADHERENCE REQUIRED):**

    **1. Essay Structure:**
      - **Introduction (AO1):** 
        - Define Key Terms exactly as they appear in the official CIE Textbook (Bamford/Grant).
        - Briefly state the essay's intent/scope to set the context.
      - **Analysis (AO2):**
        - **Paragraph Structure:** Start with a **Topic Sentence** (A->Z summary). Then provide a **Complete Logical Chain** (A -> B -> C ... -> Z).
        - **Content:**
          - For **8 marks**: Write 2 distinct, fully developed points/paragraphs.
          - For **12 marks**: Write 6 distinct points (e.g., 3 arguments for, 3 arguments against/limitations).
          - For **20 marks**: Comprehensive coverage.
      - **Conclusion (Evaluation AO3):**
        - **Make a Stand:** Provide a clear judgement.
        - **Justify the Stand:** Explain *why* this judgement holds true (e.g., "In the short run X, but in the long run Y").
        - **Something Special:** Add contextual nuance or insight to wake up the examiner.

    **2. Five Goals for Full Marks:**
      - **Master Textbook:** Definitions must be accurate.
      - **Economic Terminology:** MANDATORY. Do not use layman terms. 
        - *Bad:* "People have more money." -> *Good:* "Increase in purchasing power/disposable income."
        - *Bad:* "People want to buy." -> *Good:* "Effective demand increases."
      - **Complete Logical Chains:** Do not skip steps. 
        - *Example:* Income ↑ -> Purchasing Power ↑ -> Normal Good -> Demand ↑ -> Shortage at original price -> Upward pressure on price -> Price ↑.
      - **Make a Judgement:** Weigh the pros/cons based on the specific situation.
      - **Context:** Apply all points to the specific market/economy in the question.
    `;

    let specificInstructions = "";

    if (question.maxMarks === 8) {
      specificInstructions = `
      **Specific 8-Mark Strategy (Part a):**
      - **Mental Step:** Identify the "AND" in the question. Address the part before and after the "and".
      - **Analysis:** 2 Detailed Paragraphs. Analyse sides INDEPENDENTLY (do not compare yet).
      - **Evaluation:** Answer the "extent" or "whether" in the conclusion.
      `;
    } else if (question.maxMarks === 12) {
      specificInstructions = `
      **Specific 12-Mark Strategy (Part b):**
      - **Intro:** Definitions + Thesis.
      - **Body:** **6 distinct points** (e.g., 3 advantages, 3 disadvantages). Each point = 1 Paragraph with full logic chain.
      - **Conclusion:** Final Judgement + Justification + "Something Special".
      `;
    } else {
      specificInstructions = `
      **General/A2 Strategy:**
      - Ensure comprehensive coverage of the syllabus points relevant to the question.
      - Focus heavily on detailed logical chains and evaluative weight.
      `;
    }

    const prompt = `
      You are a **world-class Cambridge International AS/A Level Economics Examiner**.
      Write a **perfect, full-mark model essay** for the following question.
      
      **Question:** ${question.questionText}
      **Max Marks:** ${question.maxMarks}
      **Mark Scheme Guidance:**
      ${question.markScheme}
      
      ${cieStandards}
      
      ${specificInstructions}
      
      - The tone should be academic, professional, and exam-focused.
      - Use bold headers for **Introduction**, **Analysis**, and **Conclusion**.
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

    const coreCriteria = `
    **CRITICAL GRADING CRITERIA (CIE STANDARDS):**
    1. **Terminology:** Deduct marks for layman terms (e.g., "money" instead of "purchasing power", "want" instead of "effective demand").
    2. **Logic Chains:** Deduct marks for broken chains. The student MUST show every step (A->B->C->Z). 
       - *Example of error:* "Prices rose because demand rose." (Missing: shortage, pressure).
    3. **Structure:** 
       - Introduction must define terms.
       - Body paragraphs must start with Topic Sentences.
       - Conclusion must have a Judgement + Justification.
    4. **Context:** Arguments must explicitly reference the specific context (e.g., Low Income Country).
    `;

    let gradingRubric = "";
    let tableInstructions = "";
    
    if (question.maxMarks === 8) {
       gradingRubric = `
       ${coreCriteria}
       **8-Mark Specifics:**
       - **AO1 (Max 3):** Accurate Definitions.
       - **AO2 (Max 3):** 2 distinct points. Complete logical chains required for full marks.
       - **AO3 (Max 2):** Judgement answering the "extent/whether".
       `;
       
       tableInstructions = `
      Rows:
      1. **AO1 (Knowledge) (Max 3)**: Check definitions. Identify any layman terms used.
      2. **AO2 (Analysis) (Max 3)**: Check for 2 distinct points and complete logic chains (A->B->C->Z). Identify specifically which step is missing in their chain.
      3. **AO3 (Evaluation) (Max 2)**: Check for judgement and justification.
       `;
    } else {
       gradingRubric = `
       ${coreCriteria}
       **12-Mark Specifics:**
       - **AO1 + AO2 (Max 8):** 6 distinct points (e.g. 3 pros, 3 cons) with complete chains and definitions.
       - **AO3 (Max 4):** Clear Judgement + Justification + "Something Special" (context/nuance).
       `;

       tableInstructions = `
      Rows:
      1. **AO1+AO2 (Knowledge & Analysis) (Max 8)**: Check definitions and 6 logic chains. Penalize missing steps or terminology heavily.
      2. **AO3 (Evaluation) (Max 4)**: Check Judgement, Justification, and Context.
       `;
    }

    const prompt = `
      You are a **strict** Cambridge International AS Level Economics Examiner.
      Your goal is to grade the student's essay to professional standards.

      **Question:** ${question.questionText}
      **Max Marks:** ${question.maxMarks}
      **Official Mark Scheme:** ${question.markScheme}
      **Rubric:** ${gradingRubric}
      **Student Essay:** ${essayContentText}

      **OUTPUT INSTRUCTIONS (MANDATORY FORMAT):**

      **Section 1: Overall Summary**
      - Total Score: X / ${question.maxMarks}
      - Brief 1-sentence overall verdict.

      **Section 2: Sequential Commentary (Paragraph by Paragraph)**
      - Read the essay **chronologically**.
      - **CRITICAL:** Point out every instance of colloquial language and provide the correct economic term.
      - **CRITICAL:** Point out broken logic chains (e.g. "You jumped from X to Z without explaining Y").

      **Section 3: Detailed Scoring Table (Markdown)**
      You MUST output a Markdown table with the following columns:
      | AO Category | Score | Strengths | Weaknesses | How to Improve (Specific Gap) |
      |---|---|---|---|---|
      
      ${tableInstructions}
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
      - **AO1:** Precision of Definitions. **Use of correct Economic Terminology** is mandatory (e.g. "Effective Demand", "Purchasing Power").
      - **AO2:** **Complete Logical Chains**. A -> B -> C -> Z. No skipping steps. (e.g. Income -> Purchasing Power -> Demand -> Shortage -> Price).
      - **AO3:** Contextual Evaluation. Judgement with Justification.

      **Task:**
      1. Estimate current AO1, AO2, AO3 scores (integers). Be stingy.
      2. Calculate Total.
      3. **Advice:** Identify the most immediate logical gap or terminology error.
         - *Example:* "Use 'purchasing power' instead of 'more money'."
         - *Example:* "You jumped from demand to price. Mention 'shortage' first."
         - *Example:* "Define [Term] before analysing it."
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
         - **AO1:** Key Definitions and Terminology (e.g. "Purchasing Power").
         - **AO2:** Logical connectors or middle steps in analysis chains (e.g. "Shortage", "Incentive").
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
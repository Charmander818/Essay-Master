
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import EssayGenerator from './components/EssayGenerator';
import EssayGrader from './components/EssayGrader';
import RealTimeWriter from './components/RealTimeWriter';
import EssayImprover from './components/EssayImprover';
import TopicAnalysis from './components/TopicAnalysis'; // Import new component
import AddQuestionModal from './components/AddQuestionModal';
import CodeExportModal from './components/CodeExportModal';
import { Question, AppMode, QuestionState, ChapterAnalysis } from './types';
import { questions as initialQuestions } from './data';
import { generateModelAnswer, generateClozeExercise } from './services/geminiService';

const STORAGE_KEY_CUSTOM_QUESTIONS = 'cie_econ_custom_questions_v2';
const STORAGE_KEY_DELETED_IDS = 'cie_econ_deleted_ids_v1';
const STORAGE_KEY_WORK = 'cie_economics_work_v1';
const STORAGE_KEY_ANALYSIS = 'cie_econ_topic_analyses_v1'; // New key
const SESSION_KEY_AUTH = 'cie_econ_auth_session';

// Basic protection.
const APP_PASSWORD = "kittymoni"; 

const App: React.FC = () => {
  // --- Authentication State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem(SESSION_KEY_AUTH) === 'true';
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // --- Application State ---
  const [customQuestions, setCustomQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_QUESTIONS);
    return saved ? JSON.parse(saved) : [];
  });

  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DELETED_IDS);
    return saved ? JSON.parse(saved) : [];
  });

  const allQuestions = useMemo(() => {
    // Create a map of custom questions for easy lookup (ID -> Question)
    const customMap = new Map(customQuestions.map(q => [q.id, q]));
    const initialIds = new Set(initialQuestions.map(q => q.id));

    // 1. Start with initial questions. If an edited version exists in customMap, use that instead.
    const mergedInitial = initialQuestions.map(q => customMap.has(q.id) ? customMap.get(q.id)! : q);

    // 2. Add purely new custom questions (those with IDs NOT in initialQuestions)
    const newCustom = customQuestions.filter(q => !initialIds.has(q.id));

    // 3. Combine them and filter out deleted IDs
    return [...mergedInitial, ...newCustom].filter(q => !deletedIds.includes(q.id));
  }, [customQuestions, deletedIds]);

  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [mode, setMode] = useState<AppMode>(AppMode.GENERATOR);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCodeExportOpen, setIsCodeExportOpen] = useState(false);
  const [questionToEdit, setQuestionToEdit] = useState<Question | null>(null);
  
  const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WORK);
    return saved ? JSON.parse(saved) : {};
  });

  // State for Topic Analyses
  const [topicAnalyses, setTopicAnalyses] = useState<Record<string, ChapterAnalysis>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ANALYSIS);
    return saved ? JSON.parse(saved) : {};
  });

  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CUSTOM_QUESTIONS, JSON.stringify(customQuestions));
  }, [customQuestions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DELETED_IDS, JSON.stringify(deletedIds));
  }, [deletedIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WORK, JSON.stringify(questionStates));
  }, [questionStates]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ANALYSIS, JSON.stringify(topicAnalyses));
  }, [topicAnalyses]);

  // --- Handlers ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === APP_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem(SESSION_KEY_AUTH, 'true');
      setAuthError("");
    } else {
      setAuthError("Incorrect password");
    }
  };

  const getQuestionState = (id: string): QuestionState => {
    return questionStates[id] || {
      generatorEssay: "",
      graderEssay: "",
      graderFeedback: "",
      realTimeEssay: ""
    };
  };

  const updateQuestionState = (id: string, updates: Partial<QuestionState>) => {
    setQuestionStates(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {
          generatorEssay: "",
          graderEssay: "",
          graderFeedback: "",
          realTimeEssay: ""
        }),
        ...updates
      }
    }));
  };

  const handleSaveAnalysis = (chapterId: string, analysis: ChapterAnalysis) => {
    setTopicAnalyses(prev => ({
        ...prev,
        [chapterId]: analysis
    }));
  };

  const handleSaveQuestion = (question: Question) => {
    if (deletedIds.includes(question.id)) {
        setDeletedIds(prev => prev.filter(id => id !== question.id));
    }

    setCustomQuestions(prev => {
      const exists = prev.some(q => q.id === question.id);
      if (exists) {
        return prev.map(q => q.id === question.id ? question : q);
      }
      return [...prev, question];
    });

    if (selectedQuestion?.id === question.id) {
      setSelectedQuestion(question);
    }
    
    setQuestionToEdit(null);
    setIsModalOpen(false);
  };

  const handleDeleteQuestion = (id: string) => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      if (id.startsWith('custom-')) {
         setCustomQuestions(prev => prev.filter(q => q.id !== id));
      } else {
         setDeletedIds(prev => [...prev, id]);
         setCustomQuestions(prev => prev.filter(q => q.id !== id));
      }

      if (selectedQuestion?.id === id) {
        setSelectedQuestion(null);
      }
    }
  };

  const handleBatchGenerate = async () => {
    if (isBatchProcessing) return;
    if (!window.confirm("This will automatically generate Model Essays and Cloze Exercises for all questions that don't have them yet. This process may take several minutes due to AI rate limits. Continue?")) return;

    setIsBatchProcessing(true);
    let count = 0;
    const total = allQuestions.length;

    for (const q of allQuestions) {
        count++;
        setBatchProgress(`${count} / ${total}`);
        
        const state: QuestionState = questionStates[q.id] || {
            generatorEssay: "",
            graderEssay: "",
            graderFeedback: "",
            realTimeEssay: ""
        };
        let essay = state.generatorEssay;

        if (!essay) {
            try {
                essay = await generateModelAnswer(q);
                await new Promise(r => setTimeout(r, 4000));
            } catch (e) {
                console.error(`Failed to generate essay for ${q.id}`, e);
                continue;
            }
        }

        let clozeData = state.clozeData;
        if (essay && !clozeData) {
            try {
                const result = await generateClozeExercise(essay);
                if (result) clozeData = result;
                await new Promise(r => setTimeout(r, 4000));
            } catch (e) {
                console.error(`Failed to generate cloze for ${q.id}`, e);
            }
        }

        updateQuestionState(q.id, { 
            generatorEssay: essay,
            clozeData: clozeData
        });
    }

    setIsBatchProcessing(false);
    setBatchProgress("");
    alert("Batch generation complete!");
  };

  const handleExportAll = () => {
    // ... existing export logic ...
    // To keep file size manageable for this edit, keeping logic same as before but ensuring no changes lost.
    const dateStr = new Date().toLocaleDateString();
    let htmlBody = `
        <h1 style="color:#2E74B5; font-size:24pt; font-family: Calibri, sans-serif;">CIE A Level Economics (9708) - Study Bank</h1>
        <p style="font-family: Calibri, sans-serif;"><strong>Export Date:</strong> ${dateStr}</p>
        <p style="font-family: Calibri, sans-serif;"><strong>Total Questions:</strong> ${allQuestions.length}</p>
        <hr/>
    `;

    const sortedQuestions = [...allQuestions].sort((a, b) => {
        if (a.topic !== b.topic) return a.topic.localeCompare(b.topic);
        return a.chapter.localeCompare(b.chapter);
    });

    sortedQuestions.forEach((q, index) => {
        const state: QuestionState = questionStates[q.id] || {
            generatorEssay: "",
            graderEssay: "",
            graderFeedback: "",
            realTimeEssay: ""
        };
        
        htmlBody += `
            <div style="margin-bottom: 30px; padding-bottom: 20px;">
                <h2 style="color:#1F4E79; font-size:16pt; margin-top:20px; font-family: Calibri, sans-serif;">${index + 1}. ${q.topic} - ${q.chapter}</h2>
                <div style="background-color:#f9f9f9; padding:10px; border:1px solid #ddd; font-family: Calibri, sans-serif;">
                    <strong>${q.paper} ${q.variant} ${q.year} (${q.maxMarks} Marks)</strong><br/>
                    <em>${q.questionText}</em>
                </div>
        `;

        if (state.generatorEssay) {
            let formattedEssay = state.generatorEssay
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n\n/g, '<br/><br/>')
                .replace(/\n/g, '<br/>');
            
            htmlBody += `
                <h3 style="color:#2E74B5; border-bottom: 1px solid #ccc; font-family: Calibri, sans-serif;">Model Answer</h3>
                <div style="font-family: Calibri, sans-serif;">${formattedEssay}</div>
            `;
        } else {
            htmlBody += `<p style="color:#999; font-family: Calibri, sans-serif;"><em>(No model answer generated)</em></p>`;
        }
        
        htmlBody += `<br/><hr/></div>`;
    });

    const fullHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset="utf-8">
            <title>Economics Export</title>
            <style>
                body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; }
            </style>
        </head>
        <body>${htmlBody}</body>
        </html>
    `;

    const blob = new Blob([fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CIE_Economics_Master_Bank_${new Date().toISOString().slice(0,10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    const headers = ["Year", "Code", "Season", "Question No", "Question", "Mark Scheme", "Topic", "Chapter", "Marks"];
    const escapeCsv = (text: string) => {
      if (!text) return "";
      const cleaned = text.replace(/"/g, '""');
      return `"${cleaned}"`;
    };
    const rows = allQuestions.map(q => {
      return [
        escapeCsv(q.year),
        escapeCsv(q.paper),
        escapeCsv(q.variant),
        escapeCsv(q.questionNumber),
        escapeCsv(q.questionText),
        escapeCsv(q.markScheme),
        escapeCsv(q.topic),
        escapeCsv(q.chapter),
        escapeCsv(q.maxMarks.toString())
      ].join(",");
    });
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CIE_Economics_Question_Bank_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">CIE Economics Master</h1>
            <p className="text-slate-500 mt-2 text-sm">Protected Access</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Password</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Enter access code"
                autoFocus
              />
            </div>
            {authError && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-100">{authError}</div>}
            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all active:scale-[0.98]">Unlock Access</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar 
        questions={allQuestions}
        onSelectQuestion={(q) => { setSelectedQuestion(q); setMode(AppMode.GENERATOR); }} // Default to Generator on select
        selectedQuestionId={selectedQuestion?.id || null}
        onAddQuestionClick={() => { setQuestionToEdit(null); setIsModalOpen(true); }}
        onDeleteQuestion={handleDeleteQuestion}
        onEditQuestion={(q) => { setQuestionToEdit(q); setIsModalOpen(true); }}
        questionStates={questionStates}
        onExportAll={handleExportAll}
        onExportExcel={handleExportExcel}
        onBatchGenerate={handleBatchGenerate}
        isBatchProcessing={isBatchProcessing}
        batchProgress={batchProgress}
        onOpenCodeExport={() => setIsCodeExportOpen(true)}
      />
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            {mode === AppMode.ANALYSIS ? (
               <div>
                  <h2 className="text-lg font-bold text-slate-800">Question Bank Analysis</h2>
                  <p className="text-sm text-slate-500">Aggregate insights by chapter</p>
               </div>
            ) : selectedQuestion ? (
              <div>
                 <h2 className="text-lg font-bold text-slate-800">{selectedQuestion.paper} - {selectedQuestion.variant} {selectedQuestion.year}</h2>
                 <p className="text-sm text-slate-500">{selectedQuestion.topic} - {selectedQuestion.questionNumber}</p>
              </div>
            ) : (
              <p className="text-slate-400 italic">Select a question or mode</p>
            )}
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto">
            {Object.values(AppMode).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  mode === m 
                    ? 'bg-white text-blue-700 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scroll relative">
            {/* Analysis Mode (Full Screen, no specific question selected needed) */}
            {mode === AppMode.ANALYSIS && (
                 <div className="absolute inset-0">
                    <TopicAnalysis 
                        questions={allQuestions}
                        savedAnalyses={topicAnalyses}
                        onSaveAnalysis={handleSaveAnalysis}
                    />
                 </div>
            )}

            {/* Question-Specific Modes */}
            {mode !== AppMode.ANALYSIS && (
                <div className="p-8">
                    {selectedQuestion ? (
                        <>
                        {mode === AppMode.GENERATOR && (
                            <EssayGenerator 
                              question={selectedQuestion} 
                              savedEssay={getQuestionState(selectedQuestion.id).generatorEssay}
                              savedDeconstruction={getQuestionState(selectedQuestion.id).deconstruction}
                              onSave={(essay) => updateQuestionState(selectedQuestion.id, { generatorEssay: essay })}
                              onSaveDeconstruction={(deconstruction) => updateQuestionState(selectedQuestion.id, { deconstruction })}
                            />
                        )}
                        {mode === AppMode.IMPROVER && (
                            <EssayImprover 
                            question={selectedQuestion}
                            modelEssay={getQuestionState(selectedQuestion.id).generatorEssay}
                            clozeData={getQuestionState(selectedQuestion.id).clozeData}
                            userAnswers={getQuestionState(selectedQuestion.id).clozeUserAnswers}
                            feedback={getQuestionState(selectedQuestion.id).clozeFeedback}
                            onSaveData={(data) => updateQuestionState(selectedQuestion.id, { clozeData: data })}
                            onSaveProgress={(answers, fb) => updateQuestionState(selectedQuestion.id, { clozeUserAnswers: answers, clozeFeedback: fb })}
                            onModelEssayGenerated={(essay) => updateQuestionState(selectedQuestion.id, { generatorEssay: essay })}
                            />
                        )}
                        {mode === AppMode.GRADER && (
                            <EssayGrader 
                            question={selectedQuestion} 
                            savedInput={getQuestionState(selectedQuestion.id).graderEssay}
                            savedFeedback={getQuestionState(selectedQuestion.id).graderFeedback}
                            onSave={(input, feedback) => updateQuestionState(selectedQuestion.id, { graderEssay: input, graderFeedback: feedback })}
                            />
                        )}
                        {mode === AppMode.COACH && (
                            <RealTimeWriter 
                            question={selectedQuestion} 
                            savedText={getQuestionState(selectedQuestion.id).realTimeEssay}
                            onSave={(text) => updateQuestionState(selectedQuestion.id, { realTimeEssay: text })}
                            />
                        )}
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 mt-20">
                            <svg className="w-24 h-24 mb-6 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <h3 className="text-xl font-semibold text-slate-600 mb-2">Welcome to Essay Master</h3>
                            <p className="max-w-md text-center mb-6">Select a question from the sidebar to start.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      </main>

      <AddQuestionModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setQuestionToEdit(null); }} 
        onSave={handleSaveQuestion}
        initialQuestion={questionToEdit}
      />

      <CodeExportModal
         isOpen={isCodeExportOpen}
         onClose={() => setIsCodeExportOpen(false)}
         questions={allQuestions}
      />
    </div>
  );
};

export default App;

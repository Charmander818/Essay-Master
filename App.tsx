
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import EssayGenerator from './components/EssayGenerator';
import EssayGrader from './components/EssayGrader';
import RealTimeWriter from './components/RealTimeWriter';
import EssayImprover from './components/EssayImprover';
import TopicAnalysis from './components/TopicAnalysis'; 
import SentenceImprover from './components/SentenceImprover';
import AddQuestionModal from './components/AddQuestionModal';
import CodeExportModal from './components/CodeExportModal';
import { Question, AppMode, QuestionState, ChapterAnalysis } from './types';
import { questions as initialQuestions } from './data';
import { generateModelAnswer, generateClozeExercise } from './services/geminiService';

const STORAGE_KEY_CUSTOM_QUESTIONS = 'cie_econ_custom_questions_v2';
const STORAGE_KEY_DELETED_IDS = 'cie_econ_deleted_ids_v1';
const STORAGE_KEY_WORK = 'cie_economics_work_v1';
const STORAGE_KEY_ANALYSIS = 'cie_econ_topic_analyses_v1';
const SESSION_KEY_AUTH = 'cie_econ_auth_session';

const APP_PASSWORD = "kittymoni"; 

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem(SESSION_KEY_AUTH) === 'true';
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [customQuestions, setCustomQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_QUESTIONS);
    return saved ? JSON.parse(saved) : [];
  });

  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DELETED_IDS);
    return saved ? JSON.parse(saved) : [];
  });

  const allQuestions = useMemo(() => {
    const customMap = new Map(customQuestions.map(q => [q.id, q]));
    const initialIds = new Set(initialQuestions.map(q => q.id));
    const mergedInitial = initialQuestions.map(q => customMap.has(q.id) ? customMap.get(q.id)! : q);
    const newCustom = customQuestions.filter(q => !initialIds.has(q.id));
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

  const [topicAnalyses, setTopicAnalyses] = useState<Record<string, ChapterAnalysis>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ANALYSIS);
    return saved ? JSON.parse(saved) : {};
  });

  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");

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

  const updateQuestionState = (id: string, updates: Partial<QuestionState>) => {
    setQuestionStates(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { generatorEssay: "", graderEssay: "", graderFeedback: "", realTimeEssay: "" }),
        ...updates
      }
    }));
  };

  const handleSaveQuestion = (question: Question) => {
    setCustomQuestions(prev => {
      const exists = prev.some(q => q.id === question.id);
      if (exists) return prev.map(q => q.id === question.id ? question : q);
      return [...prev, question];
    });
    setIsModalOpen(false);
  };

  const handleDeleteQuestion = (id: string) => {
    if (window.confirm("Delete this question?")) {
      setDeletedIds(prev => [...prev, id]);
      if (selectedQuestion?.id === id) setSelectedQuestion(null);
    }
  };

  const isApiConnected = process.env.API_KEY && process.env.API_KEY !== "undefined";

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800">CIE Economics Master</h1>
            <p className="text-slate-500 mt-2 text-sm">Protected Access for Teachers</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter access code"
              autoFocus
            />
            {authError && <div className="text-red-500 text-sm text-center">{authError}</div>}
            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all">Unlock</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar 
        questions={allQuestions}
        onSelectQuestion={(q) => { setSelectedQuestion(q); setMode(AppMode.GENERATOR); }}
        selectedQuestionId={selectedQuestion?.id || null}
        onAddQuestionClick={() => { setQuestionToEdit(null); setIsModalOpen(true); }}
        onDeleteQuestion={handleDeleteQuestion}
        onEditQuestion={(q) => { setQuestionToEdit(q); setIsModalOpen(true); }}
        questionStates={questionStates}
        onExportAll={() => {}}
        onExportExcel={() => {}}
        onBatchGenerate={() => {}}
        isBatchProcessing={isBatchProcessing}
        batchProgress={batchProgress}
        onOpenCodeExport={() => setIsCodeExportOpen(true)}
        onBackup={() => {}}
        onRestore={() => {}}
      />
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            {selectedQuestion ? (
              <div>
                 <h2 className="text-lg font-bold text-slate-800">{selectedQuestion.paper} - {selectedQuestion.year}</h2>
                 <p className="text-sm text-slate-500">{selectedQuestion.questionNumber}</p>
              </div>
            ) : <p className="text-slate-400 italic">Select a question to begin</p>}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {Object.values(AppMode).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === m ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
               <div className={`w-2 h-2 rounded-full ${isApiConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isApiConnected ? 'Connected' : 'Missing Key'}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scroll p-8">
            {selectedQuestion ? (
                <>
                {mode === AppMode.GENERATOR && (
                    <EssayGenerator 
                      question={selectedQuestion} 
                      savedEssay={questionStates[selectedQuestion.id]?.generatorEssay || ""}
                      savedDeconstruction={questionStates[selectedQuestion.id]?.deconstruction}
                      onSave={(essay) => updateQuestionState(selectedQuestion.id, { generatorEssay: essay })}
                      onSaveDeconstruction={(deconstruction) => updateQuestionState(selectedQuestion.id, { deconstruction })}
                    />
                )}
                {mode === AppMode.GRADER && (
                    <EssayGrader 
                      question={selectedQuestion} 
                      savedInput={questionStates[selectedQuestion.id]?.graderEssay || ""}
                      savedFeedback={questionStates[selectedQuestion.id]?.graderFeedback || ""}
                      onSave={(input, feedback) => updateQuestionState(selectedQuestion.id, { graderEssay: input, graderFeedback: feedback })}
                    />
                )}
                {mode === AppMode.COACH && (
                    <RealTimeWriter 
                      question={selectedQuestion} 
                      savedText={questionStates[selectedQuestion.id]?.realTimeEssay || ""}
                      onSave={(text) => updateQuestionState(selectedQuestion.id, { realTimeEssay: text })}
                    />
                )}
                {mode === AppMode.IMPROVER && (
                    <EssayImprover 
                      question={selectedQuestion}
                      modelEssay={questionStates[selectedQuestion.id]?.generatorEssay || ""}
                      clozeData={questionStates[selectedQuestion.id]?.clozeData}
                      onSaveData={(data) => updateQuestionState(selectedQuestion.id, { clozeData: data })}
                      onSaveProgress={() => {}}
                      onModelEssayGenerated={(essay) => updateQuestionState(selectedQuestion.id, { generatorEssay: essay })}
                    />
                )}
                {mode === AppMode.ANALYSIS && <TopicAnalysis questions={allQuestions} savedAnalyses={topicAnalyses} onSaveAnalysis={() => {}} />}
                {mode === AppMode.SNIPPET && <SentenceImprover question={selectedQuestion} />}
                </>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <h3 className="text-xl font-semibold mb-2">Welcome, Professor!</h3>
                    <p className="max-w-md text-center">Select a past paper question from the left sidebar to start generating model answers or grading student work.</p>
                </div>
            )}
        </div>
      </main>

      <AddQuestionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveQuestion} initialQuestion={questionToEdit} />
      <CodeExportModal isOpen={isCodeExportOpen} onClose={() => setIsCodeExportOpen(false)} questions={allQuestions} />
    </div>
  );
};

export default App;

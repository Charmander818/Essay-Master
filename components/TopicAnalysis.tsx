
import React, { useState, useMemo } from 'react';
import { Question, SyllabusTopic, ChapterAnalysis, AnalysisPoint } from '../types';
import { SYLLABUS_STRUCTURE, Level } from '../syllabusData';
import { analyzeTopicMarkSchemes } from '../services/geminiService';

interface Props {
  questions: Question[];
  savedAnalyses: Record<string, ChapterAnalysis>;
  onSaveAnalysis: (chapterId: string, analysis: ChapterAnalysis) => void;
}

const AnalysisCard: React.FC<{ title: string, color: string, points: AnalysisPoint[] }> = ({ title, color, points }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full`}>
    <div className={`px-4 py-3 ${color} border-b border-slate-100 flex justify-between items-center`}>
      <h3 className="font-bold text-slate-800">{title}</h3>
      <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full font-medium text-slate-600">{points.length} points</span>
    </div>
    <div className="p-4 overflow-y-auto custom-scroll flex-1">
      {points.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No specific points identified yet.</p>
      ) : (
        <ul className="space-y-4">
          {points.map((p, idx) => (
            <li key={idx} className="group">
              <div className="text-sm text-slate-800 font-medium leading-relaxed mb-1.5">
                {p.point}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.sourceRefs.map((ref, rIdx) => (
                  <span key={rIdx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-500 border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors">
                    {ref}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

const TopicAnalysis: React.FC<Props> = ({ questions, savedAnalyses, onSaveAnalysis }) => {
  const [level, setLevel] = useState<Level>("AS");
  const [selectedTopic, setSelectedTopic] = useState<SyllabusTopic>(SYLLABUS_STRUCTURE["AS"].topics[0]);
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Initialize chapter when topic changes
  useMemo(() => {
    const chapters = (SYLLABUS_STRUCTURE[level].chapters as any)[selectedTopic] || [];
    if (!chapters.includes(selectedChapter)) {
        setSelectedChapter(chapters[0] || "");
    }
  }, [level, selectedTopic]);

  const currentChapters = (SYLLABUS_STRUCTURE[level].chapters as any)[selectedTopic] || [];

  const chapterQuestions = useMemo(() => {
    return questions.filter(q => q.topic === selectedTopic && q.chapter === selectedChapter);
  }, [questions, selectedTopic, selectedChapter]);

  const currentAnalysis = savedAnalyses[selectedChapter];

  const handleAnalyze = async () => {
    if (chapterQuestions.length === 0) return;
    setIsAnalyzing(true);
    const result = await analyzeTopicMarkSchemes(selectedChapter, chapterQuestions);
    if (result) {
      onSaveAnalysis(selectedChapter, result);
    } else {
        alert("Analysis failed. Please try again.");
    }
    setIsAnalyzing(false);
  };

  const handleLevelChange = (newLevel: Level) => {
    setLevel(newLevel);
    const newTopic = SYLLABUS_STRUCTURE[newLevel].topics[0];
    setSelectedTopic(newTopic);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Controls Bar */}
      <div className="bg-white border-b border-slate-200 p-4 shadow-sm z-10 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
         <div className="flex flex-col gap-2 w-full md:w-auto">
             <div className="flex gap-2">
                 <div className="bg-slate-100 p-1 rounded-lg inline-flex">
                    <button onClick={() => handleLevelChange("AS")} className={`px-3 py-1.5 text-xs font-bold rounded ${level === "AS" ? "bg-white shadow text-blue-700" : "text-slate-500"}`}>AS</button>
                    <button onClick={() => handleLevelChange("A Level")} className={`px-3 py-1.5 text-xs font-bold rounded ${level === "A Level" ? "bg-white shadow text-purple-700" : "text-slate-500"}`}>A Level</button>
                 </div>
                 <select 
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value as SyllabusTopic)}
                    className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 max-w-[200px]"
                 >
                    {SYLLABUS_STRUCTURE[level].topics.map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
                 <select 
                    value={selectedChapter}
                    onChange={(e) => setSelectedChapter(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 max-w-[300px]"
                 >
                    {currentChapters.map((c: string) => <option key={c} value={c}>{c}</option>)}
                 </select>
             </div>
         </div>

         <div className="flex items-center gap-4">
             <div className="text-right hidden md:block">
                 <p className="text-xs font-bold text-slate-500 uppercase">Questions in Chapter</p>
                 <p className="text-lg font-bold text-blue-600">{chapterQuestions.length}</p>
             </div>
             <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || chapterQuestions.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
             >
                {isAnalyzing ? (
                   <>
                     <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                     Analyzing...
                   </>
                ) : (
                   <>
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                     {currentAnalysis ? "Update Analysis" : "Generate Analysis"}
                   </>
                )}
             </button>
         </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        {currentAnalysis ? (
           <div className="h-full grid grid-cols-1 md:grid-cols-3 gap-6">
              <AnalysisCard title="AO1: Knowledge & Understanding" color="bg-blue-50" points={currentAnalysis.ao1} />
              <AnalysisCard title="AO2: Analysis Chains" color="bg-purple-50" points={currentAnalysis.ao2} />
              <AnalysisCard title="AO3: Evaluation Points" color="bg-amber-50" points={currentAnalysis.ao3} />
           </div>
        ) : (
           <div className="h-full flex flex-col items-center justify-center text-slate-400">
               <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
               </div>
               <h3 className="text-xl font-bold text-slate-600 mb-2">Topic Analysis</h3>
               <p className="max-w-md text-center">
                 Select a chapter and click "Generate Analysis" to have AI aggregate all AO1, AO2, and AO3 points from the mark schemes in that chapter.
               </p>
               <p className="mt-4 text-sm font-medium text-slate-500">
                  {chapterQuestions.length} questions available for {selectedChapter}
               </p>
           </div>
        )}
      </div>
      
      {/* Footer Info */}
      {currentAnalysis && (
        <div className="bg-white border-t border-slate-200 px-6 py-2 text-xs text-slate-400 flex justify-between items-center">
            <span>Last Updated: {new Date(currentAnalysis.lastUpdated).toLocaleString()}</span>
            <span>Based on {currentAnalysis.questionCount} questions</span>
        </div>
      )}
    </div>
  );
};

export default TopicAnalysis;

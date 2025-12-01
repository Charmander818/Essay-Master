
import React, { useState, useMemo } from 'react';
import { Question, SyllabusTopic, ChapterAnalysis, AnalysisPoint, DebateAnalysis } from '../types';
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
    <div className="p-4 overflow-y-auto custom-scroll flex-1 h-64 md:h-auto">
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

const DebateCard: React.FC<{ debate: DebateAnalysis }> = ({ debate }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
    <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
        <h3 className="font-bold text-white tracking-wide">{debate.topic}</h3>
        <div className="flex gap-1">
             {debate.sourceRefs.slice(0, 3).map((ref, i) => (
                 <span key={i} className="text-[10px] text-slate-300 bg-slate-700 px-1.5 rounded">{ref}</span>
             ))}
             {debate.sourceRefs.length > 3 && <span className="text-[10px] text-slate-300 bg-slate-700 px-1.5 rounded">+{debate.sourceRefs.length - 3}</span>}
        </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        
        {/* Pros */}
        <div className="p-4">
            <h4 className="text-xs font-bold text-emerald-600 uppercase mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Advantages / Effectiveness
            </h4>
            <ul className="space-y-2">
                {debate.pros.length > 0 ? debate.pros.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 leading-snug pl-2 border-l-2 border-emerald-100">
                        {item}
                    </li>
                )) : <li className="text-sm text-slate-400 italic">None listed</li>}
            </ul>
        </div>

        {/* Cons */}
        <div className="p-4">
            <h4 className="text-xs font-bold text-rose-600 uppercase mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Limitations / Problems
            </h4>
            <ul className="space-y-2">
                {debate.cons.length > 0 ? debate.cons.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 leading-snug pl-2 border-l-2 border-rose-100">
                        {item}
                    </li>
                )) : <li className="text-sm text-slate-400 italic">None listed</li>}
            </ul>
        </div>

        {/* Dependencies */}
        <div className="p-4 bg-slate-50/50">
             <h4 className="text-xs font-bold text-purple-600 uppercase mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span> Depends On...
            </h4>
            <ul className="space-y-2">
                {debate.dependencies.length > 0 ? debate.dependencies.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 leading-snug pl-2 border-l-2 border-purple-200">
                        {item}
                    </li>
                )) : <li className="text-sm text-slate-400 italic">No specific dependencies listed</li>}
            </ul>
        </div>
    </div>
  </div>
);

const TopicAnalysis: React.FC<Props> = ({ questions, savedAnalyses, onSaveAnalysis }) => {
  const [level, setLevel] = useState<Level>("AS");
  const [selectedTopic, setSelectedTopic] = useState<SyllabusTopic>(SYLLABUS_STRUCTURE["AS"].topics[0]);
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copyStatus, setCopyStatus] = useState("Copy Full Analysis");

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

  const handleCopyAll = () => {
    if (!currentAnalysis) return;

    let text = `Topic Analysis: ${currentAnalysis.chapter}\n`;
    text += `Questions Analyzed: ${currentAnalysis.questionCount}\n\n`;

    text += `=== AO1: Knowledge & Understanding ===\n`;
    currentAnalysis.ao1.forEach((p, i) => {
        text += `${i + 1}. ${p.point}\n   [Refs: ${p.sourceRefs.join(', ')}]\n`;
    });
    text += `\n`;

    text += `=== AO2: Analysis Chains ===\n`;
    currentAnalysis.ao2.forEach((p, i) => {
        text += `${i + 1}. ${p.point}\n   [Refs: ${p.sourceRefs.join(', ')}]\n`;
    });
    text += `\n`;

    if (currentAnalysis.debates && currentAnalysis.debates.length > 0) {
        text += `=== DEBATES & EVALUATION SUMMARIES ===\n\n`;
        currentAnalysis.debates.forEach((d) => {
            text += `TOPIC: ${d.topic.toUpperCase()}\n`;
            
            text += `  [PROS / EFFECTIVENESS]:\n`;
            d.pros.forEach(p => text += `  - ${p}\n`);
            
            text += `  [CONS / LIMITATIONS]:\n`;
            d.cons.forEach(p => text += `  - ${p}\n`);
            
            text += `  [DEPENDS ON]:\n`;
            d.dependencies.forEach(p => text += `  - ${p}\n`);
            
            text += `  [Refs: ${d.sourceRefs.join(', ')}]\n\n`;
        });
    }

    text += `=== General AO3 Points ===\n`;
    currentAnalysis.ao3.forEach((p, i) => {
        text += `${i + 1}. ${p.point}\n   [Refs: ${p.sourceRefs.join(', ')}]\n`;
    });

    navigator.clipboard.writeText(text);
    setCopyStatus("Copied!");
    setTimeout(() => setCopyStatus("Copy Full Analysis"), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Controls Bar */}
      <div className="bg-white border-b border-slate-200 p-4 shadow-sm z-10 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between flex-shrink-0">
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

         <div className="flex items-center gap-2">
             <div className="text-right hidden md:block mr-2">
                 <p className="text-xs font-bold text-slate-500 uppercase">Questions in Chapter</p>
                 <p className="text-lg font-bold text-blue-600">{chapterQuestions.length}</p>
             </div>

             {currentAnalysis && (
                 <button
                    onClick={handleCopyAll}
                    className={`px-4 py-2 font-medium rounded-lg shadow-sm flex items-center gap-2 transition-all ${
                        copyStatus === "Copied!" 
                        ? "bg-green-100 text-green-700 border border-green-200" 
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                 >
                    {copyStatus === "Copied!" ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    )}
                    {copyStatus}
                 </button>
             )}

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
      <div className="flex-1 overflow-y-auto custom-scroll p-6">
        {currentAnalysis ? (
           <div className="space-y-6">
              
              {/* General AO Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-96">
                  <AnalysisCard title="AO1: Knowledge & Understanding" color="bg-blue-50" points={currentAnalysis.ao1} />
                  <AnalysisCard title="AO2: Analysis Chains" color="bg-purple-50" points={currentAnalysis.ao2} />
                  <AnalysisCard title="AO3: General Evaluation" color="bg-amber-50" points={currentAnalysis.ao3} />
              </div>

              {/* Debate / Comparison Section */}
              {currentAnalysis.debates && currentAnalysis.debates.length > 0 && (
                  <div>
                      <h2 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-200 pb-2">
                        Key Debates & Policy Evaluations (Limitations & Dependencies)
                      </h2>
                      <div className="space-y-6">
                          {currentAnalysis.debates.map((debate, idx) => (
                              <DebateCard key={idx} debate={debate} />
                          ))}
                      </div>
                  </div>
              )}
           </div>
        ) : (
           <div className="h-full flex flex-col items-center justify-center text-slate-400">
               <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
               </div>
               <h3 className="text-xl font-bold text-slate-600 mb-2">Topic Analysis</h3>
               <p className="max-w-md text-center">
                 Select a chapter and click "Generate Analysis". The AI will now summarize comparative debates, focusing on pros, cons (limitations), and "it depends" (dependencies).
               </p>
               <p className="mt-4 text-sm font-medium text-slate-500">
                  {chapterQuestions.length} questions available for {selectedChapter}
               </p>
           </div>
        )}
      </div>
      
      {/* Footer Info */}
      {currentAnalysis && (
        <div className="bg-white border-t border-slate-200 px-6 py-2 text-xs text-slate-400 flex justify-between items-center flex-shrink-0">
            <span>Last Updated: {new Date(currentAnalysis.lastUpdated).toLocaleString()}</span>
            <span>Based on {currentAnalysis.questionCount} questions</span>
        </div>
      )}
    </div>
  );
};

export default TopicAnalysis;

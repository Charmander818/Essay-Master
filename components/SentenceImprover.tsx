import React, { useState } from 'react';
import { Question } from '../types';
import { improveSnippet } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface Props {
  question?: Question | null;
}

const SentenceImprover: React.FC<Props> = ({ question }) => {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ improved: string; explanation: string; aoFocus: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImprove = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const context = question ? `${question.questionText} (${question.topic})` : "General Economics Essay";
    const data = await improveSnippet(input, context);
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6">
      {/* Input Section */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Original Text</h3>
            {question && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full truncate max-w-[200px]" title={question.questionText}>
                    Context: {question.questionNumber}
                </span>
            )}
        </div>
        <textarea
            className="flex-1 w-full p-6 resize-none focus:outline-none font-serif text-lg leading-relaxed text-slate-800 placeholder-slate-400"
            placeholder="Paste a single sentence or paragraph here. e.g. 'When price rises, demand falls because people have less money.'"
            value={input}
            onChange={(e) => setInput(e.target.value)}
        />
        <div className="p-4 bg-white border-t border-slate-100">
            <button
                onClick={handleImprove}
                disabled={loading || !input.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {loading ? (
                    <>
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Analyzing Logic Chain...
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Improve Logic & Evaluation
                    </>
                )}
            </button>
        </div>
      </div>

      {/* Output Section */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
             <h3 className="font-bold text-slate-700">Improved Version</h3>
             {result && (
                 <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${result.aoFocus.includes('AO2') ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                     {result.aoFocus}
                 </span>
             )}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scroll p-6 bg-slate-50/30">
             {!result ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400">
                     <svg className="w-16 h-16 mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     <p>Submit text to see the upgraded version here.</p>
                 </div>
             ) : (
                 <div className="space-y-6">
                     <div className="bg-white p-6 rounded-lg border-l-4 border-blue-500 shadow-sm">
                         <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Rewritten Text</h4>
                         <p className="text-lg text-slate-800 font-serif leading-relaxed">
                             {result.improved}
                         </p>
                         <button 
                            onClick={() => navigator.clipboard.writeText(result.improved)}
                            className="mt-4 text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                         >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                            Copy to Clipboard
                         </button>
                     </div>

                     <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-100">
                         <h4 className="text-xs font-bold text-indigo-800 uppercase mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Why is this better?
                         </h4>
                         <div className="prose prose-sm prose-indigo">
                             <ReactMarkdown>{result.explanation}</ReactMarkdown>
                         </div>
                     </div>
                 </div>
             )}
          </div>
      </div>
    </div>
  );
};

export default SentenceImprover;
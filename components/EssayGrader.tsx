
import React, { useState, useEffect, useRef } from 'react';
import { Question } from '../types';
import { gradeEssay } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  question: Question;
  savedInput: string;
  savedFeedback: string;
  onSave: (input: string, feedback: string) => void;
}

const EssayGrader: React.FC<Props> = ({ question, savedInput, savedFeedback, onSave }) => {
  const [input, setInput] = useState(savedInput);
  const [feedback, setFeedback] = useState(savedFeedback);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState("Copy Feedback");

  useEffect(() => {
    setInput(savedInput);
    setFeedback(savedFeedback);
    // Images are not persisted in local state for now to avoid memory bloat
  }, [savedInput, savedFeedback, question.id]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const promises = Array.from(files).map((file: File) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(promises).then(results => {
        setImages(prev => [...prev, ...results]);
        // Reset the file input so the same file can be selected again if needed (though multi-select handles this mostly)
        if(fileInputRef.current) fileInputRef.current.value = '';
      });
    }
  };

  const removeImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleGrade = async () => {
    if (!input.trim() && images.length === 0) return;
    setLoading(true);
    // Pass the array of images
    const result = await gradeEssay(question, input, images.length > 0 ? images : undefined);
    setFeedback(result);
    onSave(input, result);
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);
    onSave(newValue, feedback);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const content = `Question: ${question.questionText}\n\nMy Essay:\n${input}\n\n-------------------\n\nExaminer Feedback:\n${feedback}`;
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `graded_essay_${question.year}_${question.questionNumber}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleCopyFeedback = () => {
    if (!feedback) return;
    navigator.clipboard.writeText(feedback);
    setCopyStatus("Copied!");
    setTimeout(() => setCopyStatus("Copy Feedback"), 2000);
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
      {/* Input Side (5 columns) */}
      <div className="flex flex-col h-full lg:col-span-5">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex-1 flex flex-col overflow-hidden">
          <div className="flex justify-between items-start mb-3 flex-shrink-0">
             <h3 className="text-sm font-semibold text-slate-700">Your Answer</h3>
             {(input || feedback) && (
               <button 
                 onClick={handleDownload}
                 className="text-slate-400 hover:text-blue-600 transition-colors"
                 title="Download Result"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
               </button>
             )}
          </div>
          <p className="text-sm text-slate-500 mb-4 font-medium leading-relaxed border-b border-slate-100 pb-3 flex-shrink-0">
            {question.questionText}
          </p>
          
          <div className="flex-1 overflow-y-auto custom-scroll min-h-0 flex flex-col">
              {/* Image Grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group bg-slate-100 rounded-lg border border-slate-200 overflow-hidden aspect-[3/4]">
                        <img src={img} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        <button 
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            title="Remove page"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                            Page {idx + 1}
                        </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Text Area */}
              <textarea
                className="flex-1 w-full p-4 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-serif text-lg leading-relaxed text-slate-800 placeholder-slate-400 min-h-[200px]"
                placeholder="Type your essay here OR upload photos of your handwritten work..."
                value={input}
                onChange={handleChange}
              />
          </div>

          <div className="mt-4 flex justify-between items-center flex-shrink-0 pt-2 border-t border-slate-50">
            <div className="flex items-center">
               <input 
                 type="file" 
                 accept="image/*" 
                 multiple
                 className="hidden" 
                 ref={fileInputRef}
                 onChange={handleImageUpload}
               />
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="text-slate-500 hover:text-blue-600 text-sm font-medium flex items-center gap-1 transition-colors px-2 py-1 hover:bg-slate-50 rounded"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                 Add Pages
               </button>
               {images.length > 0 && <span className="text-xs text-slate-400 ml-2">{images.length} page(s)</span>}
            </div>
            <button
              onClick={handleGrade}
              disabled={loading || (!input.trim() && images.length === 0)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-6 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Marking...
                </>
              ) : (
                "Grade Essay"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Side (7 columns) */}
      <div className="flex flex-col h-full overflow-hidden lg:col-span-7">
        <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full overflow-y-auto custom-scroll ${!feedback ? 'flex items-center justify-center' : ''}`}>
          {!feedback ? (
            <div className="text-center text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <p>Submit your essay (text or images) to receive detailed feedback</p>
            </div>
          ) : (
            <div className="prose prose-sm prose-slate max-w-none w-full">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                 <h3 className="text-lg font-semibold text-slate-900 m-0">Examiner Feedback</h3>
                 <button
                   onClick={handleCopyFeedback}
                   className={`text-xs font-bold px-3 py-1.5 rounded transition-all flex items-center gap-1 ${
                       copyStatus === "Copied!" 
                       ? "bg-green-100 text-green-700" 
                       : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                   }`}
                 >
                    {copyStatus === "Copied!" ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    )}
                    {copyStatus}
                 </button>
              </div>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{feedback}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EssayGrader;

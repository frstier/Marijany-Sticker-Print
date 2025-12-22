import React, { useEffect, useState } from 'react';
import { CloseIcon } from './Icons';
// Import README raw content
import readmeRaw from '../README.md?raw';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    // Simple Markdown Renderer
    const renderMarkdown = (text: string) => {
        return text.split('\n').map((line, index) => {
            // Headers
            if (line.startsWith('## ')) return <h2 key={index} className="text-xl font-bold mt-4 mb-2 text-slate-800 border-b pb-1">{line.replace('## ', '')}</h2>;
            if (line.startsWith('# ')) return <h1 key={index} className="text-2xl font-bold mb-4 text-[#115740]">{line.replace('# ', '')}</h1>;
            if (line.startsWith('### ')) return <h3 key={index} className="text-lg font-semibold mt-3 mb-1 text-slate-700">{line.replace('### ', '')}</h3>;

            // Lists
            if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) return <li key={index} className="ml-5 list-disc text-slate-600 my-0.5">{line.replace(/^[\*\-] /, '')}</li>;
            if (line.trim().match(/^\d+\. /)) return <li key={index} className="ml-5 list-decimal text-slate-600 my-0.5">{line.replace(/^\d+\. /, '')}</li>; // Simple list item

            // Tables (Very Basic - just mono font)
            if (line.includes('|')) return <pre key={index} className="bg-slate-50 p-1 text-xs md:text-sm font-mono whitespace-pre-wrap text-slate-700 overflow-x-auto my-1">{line}</pre>;

            // Separator
            if (line.includes('---')) return <hr key={index} className="my-4 border-slate-200" />;

            // Images
            if (line.includes('![Logo]')) return <div key={index} className="flex justify-center my-4 opacity-50"><span className="text-xs italic">Logotype</span></div>;

            // Empty
            if (line.trim() === '') return <div key={index} className="h-2"></div>;

            // Paragraph
            return <p key={index} className="text-slate-600 text-sm md:text-base leading-relaxed">{line}</p>;
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        📃 Інструкція
                    </h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                        <CloseIcon />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                    {renderMarkdown(readmeRaw)}
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition-colors"
                    >
                        Зрозуміло
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InfoModal;

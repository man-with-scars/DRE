import React, { useState } from 'react';
import type { AiReport } from '../lib/data-service';
import { formatReportToText, downloadFile, downloadCsv } from '../lib/data-service';
import { CheckCircleIcon, LightBulbIcon, WrenchScrewdriverIcon, XMarkIcon, SparklesIcon, DocumentDuplicateIcon, DownloadIcon, DatabaseIcon } from './icons.tsx';
import type { SourceData } from '../services/geminiService';

interface AiFixReportModalProps {
    report: AiReport | null;
    isOpen: boolean;
    onClose: () => void;
    aiFixedSourceData: SourceData | null;
}

const ReportSection: React.FC<{ title: string; items: string[]; icon: React.ReactNode }> = ({ title, items, icon }) => (
    <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
            {icon}
            {title}
        </h3>
        {items && items.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 text-black dark:text-gray-200 pl-2">
                {items.map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>
        ) : (
            <p className="text-black dark:text-gray-400 italic">No information provided for this section.</p>
        )}
    </div>
);

export const AiFixReportModal: React.FC<AiFixReportModalProps> = ({ report, isOpen, onClose, aiFixedSourceData }) => {
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

    if (!isOpen || !report) return null;

    const handleCopy = () => {
        const reportText = formatReportToText(report);
        navigator.clipboard.writeText(reportText).then(() => {
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('idle'), 2000);
        });
    };

    const handleDownload = () => {
        const reportText = formatReportToText(report);
        downloadFile(reportText, 'ai_reconciliation_report.txt', 'text/plain;charset=utf-8;');
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white/95 dark:bg-slate-800/80 backdrop-blur-lg border border-gray-200 dark:border-slate-700 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col p-6 animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-start mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <CheckCircleIcon className="h-8 w-8 text-green-400" />
                        AI Reconciliation Complete
                    </h2>
                    <div className="flex items-center gap-2">
                         <button 
                            onClick={handleCopy} 
                            className="text-gray-700 hover:text-black dark:text-gray-300 dark:hover:text-white transition-colors p-2 rounded-md hover:bg-black/10 dark:hover:bg-white/10"
                            title="Copy Report"
                         >
                             {copyStatus === 'copied' ? <CheckCircleIcon className="h-5 w-5 text-green-400"/> : <DocumentDuplicateIcon className="h-5 w-5" />}
                         </button>
                         <button 
                            onClick={handleDownload} 
                            className="text-gray-700 hover:text-black dark:text-gray-300 dark:hover:text-white transition-colors p-2 rounded-md hover:bg-black/10 dark:hover:bg-white/10"
                            title="Download Report"
                        >
                            <DownloadIcon className="h-5 w-5" />
                        </button>
                        <button 
                            onClick={onClose} 
                            className="text-gray-700 hover:text-black dark:text-gray-300 dark:hover:text-white transition-colors p-2 rounded-md hover:bg-black/10 dark:hover:bg-white/10"
                            title="Close"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>
                
                <div className="space-y-6 overflow-y-auto pr-2">
                    <ReportSection 
                        title="Fixes Applied"
                        items={report.fixesApplied}
                        icon={<WrenchScrewdriverIcon className="h-5 w-5 text-cyan-400" />}
                    />
                    <ReportSection 
                        title="Potential Root Causes"
                        items={report.rootCauseAnalysis}
                        icon={<LightBulbIcon className="h-5 w-5 text-amber-400" />}
                    />
                    <ReportSection 
                        title="Recommendations"
                        items={report.recommendations}
                        icon={<SparklesIcon className="h-5 w-5 text-indigo-400" />}
                    />
                    {aiFixedSourceData && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                                <DatabaseIcon className="h-5 w-5 text-green-400" />
                                Download Corrected Files
                            </h3>
                            <p className="text-sm text-black dark:text-gray-300 mb-3">Download the original source files with AI corrections applied.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {aiFixedSourceData.legacy?.length > 0 && <button onClick={() => downloadCsv(aiFixedSourceData.legacy, 'legacy_fixed.csv')} className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-200 dark:bg-slate-700/50 text-gray-800 dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors duration-200"><DownloadIcon className="h-4 w-4"/> Legacy DB</button>}
                                {aiFixedSourceData.spreadsheet?.length > 0 && <button onClick={() => downloadCsv(aiFixedSourceData.spreadsheet, 'spreadsheet_fixed.csv')} className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-200 dark:bg-slate-700/50 text-gray-800 dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors duration-200"><DownloadIcon className="h-4 w-4"/> Spreadsheet</button>}
                                {aiFixedSourceData.supplier?.length > 0 && <button onClick={() => downloadCsv(aiFixedSourceData.supplier, 'supplier_fixed.csv')} className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-200 dark:bg-slate-700/50 text-gray-800 dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors duration-200"><DownloadIcon className="h-4 w-4"/> Supplier Data</button>}
                                {aiFixedSourceData.reverseLogistics?.length > 0 && <button onClick={() => downloadCsv(aiFixedSourceData.reverseLogistics, 'returns_fixed.csv')} className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-200 dark:bg-slate-700/50 text-gray-800 dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors duration-200"><DownloadIcon className="h-4 w-4"/> Returns Data</button>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
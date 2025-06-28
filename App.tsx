

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { FileUploadCard } from './components/FileUploadCard';
import { Loader } from './components/Loader';
import { SparklesIcon } from './components/icons';
import { processFiles, ProcessedData, AiReport, mergeAiFixesIntoSources } from './lib/data-service';
import { getAiFixSuggestions, startChat } from './services/geminiService';
import { Header } from './components/Header';
import { RightSidebar } from './components/RightSidebar';
import { AiFixReportModal } from './components/AiFixReportModal';
import { SupplyChainVisualizer } from './components/SupplyChainVisualizer';
import type { SourceData } from './services/geminiService';
import type { Chat } from '@google/genai';
import { ViewToggle } from './components/ViewToggle';
import { PhoneFrame } from './components/PhoneFrame';


export type FileState = {
  legacy: File | null;
  spreadsheet: File | null;
  supplier: File | null;
  reverseLogistics: File | null;
  historicalBackup: File | null;
};

export type ManualOverrides = Record<string, { inventory_qty?: number; reorder_level?: number }>;
export type Theme = 'dark' | 'light';
export type ViewMode = 'desktop' | 'mobile';

export type ChatMessage = {
    role: 'user' | 'model';
    parts: { text: string }[];
};

const ConditionalWrapper: React.FC<{
  condition: boolean;
  wrapper: (children: React.ReactNode) => React.ReactNode;
  children: React.ReactNode;
}> = ({ condition, wrapper, children }) => 
  condition ? wrapper(children) : <>{children}</>;


export const App: React.FC = () => {
  const [files, setFiles] = useState<FileState>({
    legacy: null,
    spreadsheet: null,
    supplier: null,
    reverseLogistics: null,
    historicalBackup: null,
  });
  const [results, setResults] = useState<ProcessedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualOverrides, setManualOverrides] = useState<ManualOverrides>({});
  const [showAiReport, setShowAiReport] = useState(false);
  const [aiReportContent, setAiReportContent] = useState<AiReport | null>(null);
  const [aiFixedSourceData, setAiFixedSourceData] = useState<SourceData | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const isMobileView = viewMode === 'mobile';

  useEffect(() => {
    document.documentElement.className = theme;
     if (isMobileView) {
      document.body.style.backgroundColor = theme === 'dark' ? '#334155' : '#F3F4F6'; // slate-700 / gray-100
    } else {
       document.body.style.backgroundColor = theme === 'dark' ? '#0D1B2A' : '#F3F4F6';
    }
  }, [theme, isMobileView]);


  const handleFileLoad = useCallback((type: keyof FileState, file: File) => {
    setFiles((prev) => ({ ...prev, [type]: file }));
    setResults(null);
    setManualOverrides({});
    setAiReportContent(null);
    setAiFixedSourceData(null);
  }, []);

  const handleFileClear = useCallback((type: keyof FileState) => {
    setFiles((prev) => ({ ...prev, [type]: null }));
    setResults(null);
    setManualOverrides({});
    setAiReportContent(null);
    setAiFixedSourceData(null);
  }, []);

  const mandatoryFilesUploaded = useMemo(() => {
    return files.legacy && files.spreadsheet && files.supplier;
  }, [files]);
  
  const headerInfo = useMemo(() => {
      const mandatoryFilesUploadedCount = [files.legacy, files.spreadsheet, files.supplier].filter(Boolean).length;
      const allSourcesProvided = mandatoryFilesUploadedCount === 3;
      if (allSourcesProvided) {
        return {
            userName: 'Alfred',
            location: 'Akathethara, Palakkad, Kerala',
        };
      }
      return {
          userName: 'User',
          location: 'Milky Way Galaxy',
      };
  }, [files]);
  
  const initializeChat = async (data: ProcessedData) => {
      try {
          const chatSession = startChat(data);
          setChat(chatSession);
          // Get initial message from AI
          setIsChatLoading(true);
          // Use a simple prompt to get the conversation started. The main context is in the system instructions.
          const initialResponse = await chatSession.sendMessage({ message: "Hello, introduce yourself." });
          setChatHistory([{ role: 'model', parts: [{ text: initialResponse.text }] }]);
      } catch (err: any) {
          setError(err.message || 'Failed to initialize AI Chat.');
      } finally {
          setIsChatLoading(false);
      }
  };


  const handleReconcile = async () => {
    if (!mandatoryFilesUploaded) return;
    setIsLoading(true);
    setError(null);
    setResults(null);
    setManualOverrides({});
    setAiReportContent(null);
    setAiFixedSourceData(null);
    setChat(null);
    setChatHistory([]);

    try {
      const processedData = await processFiles(files);
      setResults(processedData);
      if (processedData) {
          await initializeChat(processedData);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during processing.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAutoFix = async () => {
    if (!results || !results.sourceData) return;
    setIsFixing(true);
    setError(null);
    try {
      // The AI is now called regardless of whether inconsistencies were pre-identified.
      const fixedData = await getAiFixSuggestions(results.sourceData, results.inconsistencies);
      if (fixedData.report && typeof fixedData.report !== 'string') {
        setAiReportContent(fixedData.report);
        setShowAiReport(true);
      }
      // Merge AI fixes back into source files for download
      const updatedSourceData = mergeAiFixesIntoSources(results.sourceData, fixedData);
      setAiFixedSourceData(updatedSourceData);
      
      // Update the main results with the AI-corrected data, clearing old inconsistencies.
      setResults(prev => prev ? { ...prev, ...fixedData, inconsistencies: [] } : null); 
      setManualOverrides({});
    } catch (err: any)      {
      setError(err.message || 'An unexpected error occurred during the AI fix process.');
      console.error(err);
    } finally {
      setIsFixing(false);
    }
  };

  const handleSendMessage = async (message: string) => {
      if (!chat) return;
      setIsChatLoading(true);
      const userMessage: ChatMessage = { role: 'user', parts: [{ text: message }] };
      setChatHistory(prev => [...prev, userMessage]);

      try {
          const response = await chat.sendMessage({ message });
          const aiMessage: ChatMessage = { role: 'model', parts: [{ text: response.text }] };
          setChatHistory(prev => [...prev, aiMessage]);
      } catch(err: any) {
           const errorMessage: ChatMessage = { role: 'model', parts: [{ text: `Sorry, I encountered an error: ${err.message}` }] };
           setChatHistory(prev => [...prev, errorMessage]);
      } finally {
          setIsChatLoading(false);
      }
  };
  
  const handleManualUpdate = useCallback((itemId: string, field: 'inventory_qty' | 'reorder_level', value: number) => {
    setManualOverrides(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  }, []);

  const resultsWithOverrides = useMemo(() => {
    if (!results) return null;
    const newInventory = results.consolidatedInventory.map(item => {
      const override = manualOverrides[item.item_id];
      if (override) {
        return {
          ...item,
          inventory_qty: override.inventory_qty ?? item.inventory_qty,
          reorder_level: override.reorder_level ?? item.reorder_level,
          _source: override.inventory_qty !== undefined ? 'Manual' : item._source,
        };
      }
      return item;
    });
    return { ...results, consolidatedInventory: newInventory };
  }, [results, manualOverrides]);

  return (
    <div className={`${isMobileView ? 'flex items-center justify-center' : 'p-4 sm:p-6 md:p-8'} min-h-screen`}>
       <div className="fixed top-6 right-6 z-50">
          <ViewToggle viewMode={viewMode} onToggle={setViewMode} />
        </div>
      
      <ConditionalWrapper
        condition={isMobileView}
        wrapper={children => (
          <PhoneFrame>
            <div className="p-2 h-full w-full overflow-y-auto bg-white dark:bg-slate-800 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent">
              {children}
            </div>
          </PhoneFrame>
        )}
      >
        <main className={`${isMobileView ? 'flex flex-col gap-4' : 'grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-[1800px] mx-auto'}`}>
          
          {/* Left Column */}
          <div className={`${isMobileView ? 'order-1 flex flex-col gap-4' : 'lg:col-span-2 flex flex-col gap-8'}`}>
            <div>
                <h1 className="text-5xl font-extrabold text-red-600 tracking-tighter">DRE</h1>
                <p className="text-md text-gray-600 dark:text-gray-400 italic">
                  <span className="text-red-600">D</span>ata <span className="text-red-600">R</span>econciliation <span className="text-red-600">E</span>ngine
                </p>
            </div>
            <Header userName={headerInfo.userName} location={headerInfo.location} theme={theme} setTheme={setTheme} isMobileView={isMobileView} />
            
            <div className={`bg-white dark:bg-white/20 backdrop-blur-md border border-gray-200 dark:border-white/30 rounded-2xl shadow-lg ${isMobileView ? 'p-4' : 'p-6'}`}>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Upload Data Sources</h3>
              
              <p className="text-black dark:text-white mb-2 font-semibold">Mandatory Sources</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 mb-4">
                  <FileUploadCard title="Legacy DB (.csv)" onFileLoad={(file) => handleFileLoad('legacy', file)} file={files.legacy} onClear={() => handleFileClear('legacy')} />
                  <FileUploadCard title="Spreadsheet (.csv)" onFileLoad={(file) => handleFileLoad('spreadsheet', file)} file={files.spreadsheet} onClear={() => handleFileClear('spreadsheet')} />
                  <FileUploadCard title="Supplier Data (.csv)" onFileLoad={(file) => handleFileLoad('supplier', file)} file={files.supplier} onClear={() => handleFileClear('supplier')} />
              </div>

              <p className="text-black dark:text-white mb-2 font-semibold">Optional Sources</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                  <FileUploadCard title="Returns (Optional, .csv)" onFileLoad={(file) => handleFileLoad('reverseLogistics', file)} file={files.reverseLogistics} onClear={() => handleFileClear('reverseLogistics')} />
                  <FileUploadCard title="Historical Backup (Optional, .csv)" onFileLoad={(file) => handleFileLoad('historicalBackup', file)} file={files.historicalBackup} onClear={() => handleFileClear('historicalBackup')} />
              </div>

              <div className="text-center mt-6">
                  <button
                    onClick={handleReconcile}
                    disabled={!mandatoryFilesUploaded || isLoading || isFixing}
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl text-lg font-semibold hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-blue-500/50 transform hover:-translate-y-1"
                  >
                    {isLoading ? <><Loader /> Reconciling Data...</> : <><SparklesIcon className="h-6 w-6" /> Reconcile & Analyze</>}
                  </button>
              </div>
            </div>
          

            {error && (
              <div className="p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-center font-medium">
                <strong>Error:</strong> {error}
              </div>
            )}

            {resultsWithOverrides && !isLoading && (
                <SupplyChainVisualizer 
                  {...resultsWithOverrides} 
                  onAutoFix={handleAutoFix} 
                  isFixing={isFixing} 
                  onManualUpdate={handleManualUpdate}
                />
            )}

          </div>

          {/* Right Column */}
          <div className={`${isMobileView ? 'order-2' : 'lg:col-span-1'}`}>
              <RightSidebar
                  data={resultsWithOverrides}
                  onAutoFix={handleAutoFix}
                  isFixing={isFixing}
                  aiReportContent={aiReportContent}
                  onViewReport={() => setShowAiReport(true)}
                  chatHistory={chatHistory}
                  isChatLoading={isChatLoading}
                  onSendMessage={handleSendMessage}
                  hasData={!!results}
              />
          </div>

        </main>
        
        <footer className={`text-center p-4 mt-8 text-sm text-gray-500 dark:text-gray-400 ${isMobileView ? '' : 'max-w-[1800px] mx-auto'} w-full`}>
          Data Reconciliation Supply Chain Visibility Engine (DRACVE)
        </footer>
      </ConditionalWrapper>

      {aiReportContent && (
         <AiFixReportModal 
            report={aiReportContent}
            isOpen={showAiReport}
            onClose={() => setShowAiReport(false)}
            aiFixedSourceData={aiFixedSourceData}
          />
      )}
    </div>
  );
};
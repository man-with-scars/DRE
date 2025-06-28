
import React, { useState } from 'react';
import type { ProcessedData, AiReport } from '../lib/data-service';
import { 
    SparklesIcon, CogIcon, BellIcon, UserCircleIcon, WindIcon, DropIcon, 
    CheckCircleIcon, AlertTriangleIcon, SunIcon, CloudIcon, 
    BoltIcon, ChartBarIcon, MapPinIcon, ViewGridIcon, DatabaseIcon, TruckIcon,
    ChatBubbleLeftRightIcon
} from './icons.tsx';
import { Loader } from './Loader';
import { ChatPanel } from './ChatPanel';

type ChatMessage = {
    role: 'user' | 'model';
    parts: { text: string }[];
};

interface RightSidebarProps {
    data: ProcessedData | null;
    isFixing: boolean;
    onAutoFix: () => void;
    aiReportContent: AiReport | null;
    onViewReport: () => void;
    chatHistory: ChatMessage[];
    isChatLoading: boolean;
    onSendMessage: (message: string) => void;
    hasData: boolean;
}

const DetailItem: React.FC<{ day: string, status: string, temp: string, icon: React.ReactNode }> = ({ day, status, temp, icon }) => (
    <div className="flex items-center justify-between py-3.5">
        <div className="flex items-center gap-4">
            <div className="text-blue-500 dark:text-blue-300">{icon}</div>
            <div>
                <p className="font-semibold">{day}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{status}</p>
            </div>
        </div>
        <p className="font-bold text-lg">{temp}</p>
    </div>
);

export const RightSidebar: React.FC<RightSidebarProps> = ({ data, isFixing, onAutoFix, aiReportContent, onViewReport, chatHistory, isChatLoading, onSendMessage, hasData }) => {
    const [activeTab, setActiveTab] = useState('Summary');
    
    const inconsistencies = data?.inconsistencies || [];
    const inventory = data?.consolidatedInventory || [];
    const orders = data?.consolidatedOrders || [];
    const disruptionAnalysis = data?.disruptionAnalysis;
    const totalIssues = inconsistencies.reduce((acc, i) => acc + i.details.length, 0);
    const hasBeenFixed = aiReportContent && inconsistencies.length === 0 && !isFixing;

    const getSummaryIcon = () => {
        if (!data) return <CloudIcon className="w-24 h-24 text-gray-300 dark:text-gray-400/50"/>;
        if (inconsistencies.length > 0 || (disruptionAnalysis && disruptionAnalysis.missingInventoryData.count > 0)) return <BoltIcon className="w-24 h-24 text-yellow-500 dark:text-yellow-300"/>;
        return <SunIcon className="w-24 h-24 text-amber-500 dark:text-amber-300"/>;
    }

    const getSummaryText = () => {
        if (!data) return "Awaiting Data";
        if (inconsistencies.length > 0) return `${inconsistencies.length} Issue Types`;
        if (disruptionAnalysis && disruptionAnalysis.missingInventoryData.count > 0) return "Missing Data";
        return "Fully Reconciled";
    }

    const mainMetric = totalIssues > 0 ? totalIssues : (disruptionAnalysis?.missingInventoryData.count || 0);

    return (
        <aside className="bg-white dark:bg-blue-900/70 backdrop-blur-xl border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white rounded-2xl p-6 flex flex-col h-full shadow-lg sticky top-8">
            <div className="flex justify-end items-center mb-6">
                <div className="flex items-center gap-3">
                    <button className="p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"><BellIcon className="h-5 w-5 text-black dark:text-white" /></button>
                    <button className="p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"><UserCircleIcon className="h-5 w-5 text-black dark:text-white" /></button>
                </div>
            </div>

            <div className="text-center my-4 flex-shrink-0">
                {getSummaryIcon()}
                <p className="text-5xl font-bold mt-2">{mainMetric}</p>
                <p className="text-lg text-black dark:text-gray-200">{getSummaryText()}</p>
                <div className="flex justify-center gap-8 text-black dark:text-gray-200 mt-4 text-sm">
                    <div className="flex items-center gap-2"><WindIcon className="w-5 h-5"/>{orders.length} Orders</div>
                    <div className="flex items-center gap-2"><DropIcon className="w-5 h-5"/>{inventory.length} Items</div>
                </div>
            </div>

            <div className="bg-gray-200 dark:bg-white/10 rounded-xl p-1 flex justify-around my-6 flex-shrink-0">
                <button onClick={() => setActiveTab('Summary')} className={`px-4 py-2 rounded-lg text-sm font-semibold w-full transition-colors ${activeTab === 'Summary' ? 'bg-blue-500 text-white' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}>Summary</button>
                <button onClick={() => setActiveTab('Fixes')} className={`px-4 py-2 rounded-lg text-sm font-semibold w-full transition-colors ${activeTab === 'Fixes' ? 'bg-blue-500 text-white' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}>Fixes</button>
                <button 
                    onClick={() => setActiveTab('Chat')} 
                    disabled={!hasData}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold w-full transition-colors flex items-center justify-center gap-2 ${activeTab === 'Chat' ? 'bg-blue-500 text-white' : 'hover:bg-black/10 dark:hover:bg-white/10'} disabled:text-gray-500 dark:disabled:text-gray-500 disabled:cursor-not-allowed`}
                >
                    <ChatBubbleLeftRightIcon className="h-5 w-5"/> Chat
                </button>
            </div>

            <div className="flex-grow overflow-y-auto min-h-[150px]">
                {activeTab === 'Summary' && data && (
                    <div className="divide-y divide-gray-200 dark:divide-white/20 animate-fade-in">
                         <DetailItem day="Inventory Items" status="Consolidated" temp={`${inventory.length}`} icon={<DatabaseIcon className="w-8 h-8" />} />
                         <DetailItem day="Orders" status="Consolidated" temp={`${orders.length}`} icon={<ChartBarIcon className="w-8 h-8" />} />
                         {inconsistencies.length > 0 && <DetailItem day="Inconsistencies" status="Issue Types" temp={`${inconsistencies.length}`} icon={<AlertTriangleIcon className="w-8 h-8 text-red-500 dark:text-red-300" />} />}
                         {disruptionAnalysis && (
                             <>
                                {disruptionAnalysis.inTransitOrders.length > 0 && (
                                    <DetailItem day="In-Transit" status="Shipments" temp={`${disruptionAnalysis.inTransitOrders.length}`} icon={<TruckIcon className="w-8 h-8 text-cyan-500 dark:text-cyan-300"/>} />
                                )}
                                {disruptionAnalysis.missingInventoryData.count > 0 && (
                                    <DetailItem day="Missing Data" status="Inventory Records" temp={`${disruptionAnalysis.missingInventoryData.percentage}%`} icon={<BoltIcon className="w-8 h-8 text-yellow-500 dark:text-yellow-300" />} />
                                )}
                             </>
                         )}
                    </div>
                )}
                {activeTab === 'Fixes' && (
                    <div className="space-y-4 pt-2 animate-fade-in">
                        {hasBeenFixed ? (
                            <div className="text-center space-y-3 pt-2">
                                <CheckCircleIcon className="h-12 w-12 text-green-500 dark:text-green-400 mx-auto" />
                                <h4 className="text-md font-bold">AI Fixes Applied</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm font-semibold">
                                    <div className="bg-gray-100 dark:bg-white/10 p-3 rounded-lg">
                                        <p className="font-bold text-2xl">{aiReportContent.fixesApplied.length}</p>
                                        <p className="text-gray-700 dark:text-gray-200">Fixes</p>
                                    </div>
                                    <div className="bg-gray-100 dark:bg-white/10 p-3 rounded-lg">
                                        <p className="font-bold text-2xl">{aiReportContent.recommendations.length}</p>
                                        <p className="text-gray-700 dark:text-gray-200">Suggestions</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={onViewReport}
                                    className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-500 transition-colors"
                                >
                                    View Full Report
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={onAutoFix}
                                    disabled={isFixing || inconsistencies.length === 0}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-400 disabled:bg-gray-600/50 disabled:cursor-not-allowed transition-all duration-200"
                                >
                                    {isFixing ? <><Loader /> Applying Fixes...</> : <><SparklesIcon className="h-5 w-5" /> Auto-Fix with AI</>}
                                </button>
                                <p className="text-xs text-center text-black dark:text-gray-300">
                                {inconsistencies.length > 0 
                                        ? "Use AI to resolve all issues automatically." 
                                        : "No inconsistencies to fix!"
                                }
                                </p>
                            </>
                        )}
                    </div>
                )}
                 {activeTab === 'Chat' && hasData && (
                     <div className="animate-fade-in h-[450px]">
                        <ChatPanel history={chatHistory} isLoading={isChatLoading} onSendMessage={onSendMessage} />
                     </div>
                )}
                {activeTab === 'Chat' && !hasData && (
                    <div className="text-center p-4 text-black dark:text-gray-400 animate-fade-in">
                        Please reconcile data first to enable AI chat.
                    </div>
                )}
            </div>
        </aside>
    );
}

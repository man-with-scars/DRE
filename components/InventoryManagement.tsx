import React, { useState } from 'react';
import { WrenchScrewdriverIcon, DownloadIcon, LightBulbIcon } from './icons.tsx';
import { downloadCsv, downloadFile, formatReportToText } from '../lib/data-service';
import type { AiReport } from '../lib/data-service';

interface InventoryManagementProps {
    inventory: any[];
    orders: any[];
    returns: any[];
    report: string | AiReport;
    onManualUpdate: (itemId: string, field: 'inventory_qty' | 'reorder_level', value: number) => void;
}

export const InventoryManagement: React.FC<InventoryManagementProps> = ({ inventory, orders, returns, report, onManualUpdate }) => {
    
    const [editingLevel, setEditingLevel] = useState<string | null>(null);
    const [levelValue, setLevelValue] = useState<number | string>('');

    const handleSetLevelClick = (item: any) => {
        setEditingLevel(item.item_id);
        setLevelValue(item.reorder_level || '');
    };

    const handleLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLevelValue(e.target.value);
    };

    const handleLevelSave = (itemId: string) => {
        const numericValue = parseInt(String(levelValue), 10);
        if (!isNaN(numericValue) && numericValue >= 0) {
            onManualUpdate(itemId, 'reorder_level', numericValue);
        }
        setEditingLevel(null);
    };


    return (
        <div className="bg-gray-50 dark:bg-[#1A2637] border border-gray-200 dark:border-slate-700 rounded-lg p-6">
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <button onClick={() => downloadCsv(inventory, 'inventory.csv')} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-[#2a3649] text-black dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors duration-200"><DownloadIcon className="h-5 w-5"/> Inventory CSV</button>
                <button onClick={() => downloadCsv(orders, 'orders.csv')} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-[#2a3649] text-black dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors duration-200"><DownloadIcon className="h-5 w-5"/> Orders CSV</button>
                {returns.length > 0 && <button onClick={() => downloadCsv(returns, 'returns.csv')} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-[#2a3649] text-black dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors duration-200"><DownloadIcon className="h-5 w-5"/> Returns CSV</button>}
                <button onClick={() => downloadFile(formatReportToText(report), 'reconciliation_report.txt', 'text/plain;charset=utf-8;')} className="inline-flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-colors duration-200"><DownloadIcon className="h-5 w-5"/> Full Report</button>
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <WrenchScrewdriverIcon className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                Inventory & Reorder Management
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-black dark:text-gray-200">
                    <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase">
                        <tr>
                            <th className="p-3 font-semibold">Item ID</th>
                            <th className="p-3 font-semibold">Current Inv.</th>
                            <th className="p-3 font-semibold">Manual Inv.</th>
                            <th className="p-3 font-semibold text-right">Reorder Level</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventory.map(item => (
                            <React.Fragment key={item.item_id}>
                                <tr className="border-b border-gray-200 dark:border-slate-700/50">
                                    <td className="p-3 font-medium text-black dark:text-white">{item.item_id}</td>
                                    <td className={`p-3 font-mono ${item.inventory_qty < 0 ? 'text-red-500 dark:text-red-400' : ''}`}>
                                        {item.inventory_qty}
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            defaultValue={item.inventory_qty}
                                            onBlur={(e) => onManualUpdate(item.item_id, 'inventory_qty', parseInt(e.target.value, 10))}
                                            className="w-28 bg-white dark:bg-[#101824] border border-gray-300 dark:border-slate-600 rounded p-2 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                                        />
                                    </td>
                                    <td className="p-3 text-right">
                                        {editingLevel === item.item_id ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <input
                                                    type="number"
                                                    value={levelValue}
                                                    onChange={handleLevelChange}
                                                    autoFocus
                                                    onBlur={() => handleLevelSave(item.item_id)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleLevelSave(item.item_id)}
                                                    className="w-24 bg-white dark:bg-slate-900 border border-cyan-500 rounded p-2 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                                />
                                                <button onClick={() => handleLevelSave(item.item_id)} className="px-3 py-2 bg-blue-600 rounded hover:bg-blue-500 text-white text-xs font-bold">Save</button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => handleSetLevelClick(item)}
                                                className="px-4 py-2 bg-gray-200 dark:bg-[#2a3649] border border-gray-300 dark:border-slate-600 rounded text-black dark:text-white hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                                            >
                                            {item.reorder_level ? item.reorder_level : 'Set level'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {item._ai_explanation && (
                                     <tr className="bg-cyan-50/50 dark:bg-slate-900/40">
                                        <td colSpan={4} className="p-3 text-sm text-cyan-800 dark:text-cyan-300 border-b border-gray-200 dark:border-slate-700/50">
                                            <div className="flex items-start gap-2">
                                            <LightBulbIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-cyan-600 dark:text-cyan-400" />
                                            <div>
                                                <span className="font-semibold text-cyan-900 dark:text-cyan-200">AI Explanation: </span>
                                                {item._ai_explanation}
                                            </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
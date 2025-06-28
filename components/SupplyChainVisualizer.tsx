import React, { useMemo } from 'react';
import { ProcessedData, downloadCsv, downloadFile, formatReportToText } from '../lib/data-service';
import { TableIcon, AlertTriangleIcon, DownloadIcon, DatabaseIcon, TruckIcon, FlowChartIcon, ChevronDownIcon, WandIcon, CheckCircleIcon, ArrowUturnLeftIcon, BoltIcon, SparklesIcon } from './icons.tsx';
import { Loader } from './Loader';
import { InventoryManagement } from './InventoryManagement';

type Source = 'Legacy' | 'Spreadsheet' | 'Supplier' | 'ReverseLogistics' | 'Manual' | 'AI-Corrected' | 'Unknown';

const SOURCE_STYLES: Record<Source, { classes: string; name: string }> = {
    Legacy: { classes: 'bg-slate-400 dark:bg-slate-500', name: 'Legacy DB' },
    Spreadsheet: { classes: 'bg-emerald-400 dark:bg-emerald-500', name: 'Spreadsheet' },
    Supplier: { classes: 'bg-sky-400 dark:bg-sky-500', name: 'Supplier Data' },
    ReverseLogistics: { classes: 'bg-amber-400 dark:bg-amber-500', name: 'Returns' },
    Manual: { classes: 'bg-fuchsia-400 dark:bg-fuchsia-500', name: 'Manual Override' },
    'AI-Corrected': { classes: 'bg-indigo-400 dark:bg-indigo-500', name: 'AI Corrected' },
    Unknown: { classes: 'bg-gray-500 dark:bg-gray-600', name: 'Unknown' },
};


const SourceCard: React.FC<{ title: string; icon: React.ReactNode }> = ({ title, icon }) => (
    <div className="flex flex-col items-center justify-center p-4 bg-gray-200/70 dark:bg-slate-800/60 backdrop-blur-sm border border-gray-300 dark:border-slate-700 rounded-lg text-center h-full">
        <div className="text-cyan-600 dark:text-cyan-400 mb-2">{icon}</div>
        <h3 className="font-semibold text-gray-800 dark:text-white text-sm">{title}</h3>
    </div>
);

const DisruptionIndicator: React.FC<{ count: number }> = ({ count }) => (
    <div className="relative group flex items-center justify-center bg-red-900/50 border-2 border-red-600 rounded-full h-12 w-12 z-10">
        <AlertTriangleIcon className="h-6 w-6 text-red-300 animate-pulse" />
        <div className="absolute bottom-full mb-2 w-max px-3 py-1 bg-gray-800 dark:bg-slate-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {count} {count > 1 ? 'inconsistencies' : 'inconsistency'} found
        </div>
    </div>
);

const renderTable = (data: Record<string, any>[]) => {
    if (!data || data.length === 0) {
      return <p className="text-gray-500 dark:text-gray-400 text-center italic py-4">No data to display.</p>;
    }
    const headers = Object.keys(data[0]);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-black dark:text-gray-200">
          <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-200 dark:bg-gray-700/50">
            <tr>
              {headers.map(header => <th key={header} className="px-4 py-2">{header.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 ${row.reorder_needed === 'Yes' ? 'bg-amber-100/50 dark:bg-amber-900/30' : 'bg-white dark:bg-gray-800/50'}`}>
                {headers.map(header => (
                  <td key={header} className="px-4 py-2 whitespace-nowrap">
                    {row.reorder_needed === 'Yes' && header === 'reorder_needed' ? (
                        <span className="font-bold text-amber-600 dark:text-amber-400">{row[header]}</span>
                    ) : (
                        row[header] === null || row[header] === undefined ? <span className="text-gray-600 dark:text-gray-400">N/A</span> : String(row[header])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

type VisualizerProps = ProcessedData & {
    onAutoFix: () => Promise<void>;
    isFixing: boolean;
    onManualUpdate: (itemId: string, field: 'inventory_qty' | 'reorder_level', value: number) => void;
};

export const SupplyChainVisualizer: React.FC<VisualizerProps> = (props) => {
    const { inconsistencies, consolidatedInventory, consolidatedOrders, consolidatedReturns, report, onAutoFix, isFixing, onManualUpdate, disruptionAnalysis } = props;

    const sourceCounts = useMemo(() => {
        const countSources = (data: any[]) => 
            data.reduce((acc, row) => {
                const source = (row._source as Source) || 'Unknown';
                acc[source] = (acc[source] || 0) + 1;
                return acc;
            }, {} as Record<Source, number>);

        return { 
            inventory: countSources(consolidatedInventory), 
            orders: countSources(consolidatedOrders),
            returns: countSources(consolidatedReturns),
        };
    }, [consolidatedInventory, consolidatedOrders, consolidatedReturns]);

    return (
        <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200 dark:border-slate-700 rounded-lg shadow-2xl p-6 md:p-8 space-y-8 animate-fade-in">
            {/* Main Visual Flow */}
            <div className="flex flex-col md:flex-row items-center justify-around gap-4 md:gap-2">
                {/* Step 1: Sources */}
                <div className="grid grid-cols-4 gap-3 w-full md:w-auto">
                    <SourceCard title="Legacy DB" icon={<DatabaseIcon className="h-8 w-8" />} />
                    <SourceCard title="Spreadsheet" icon={<TableIcon className="h-8 w-8" />} />
                    <SourceCard title="Supplier Data" icon={<TruckIcon className="h-8 w-8" />} />
                    <SourceCard title="Returns" icon={<ArrowUturnLeftIcon className="h-8 w-8" />} />
                </div>

                {/* Connector */}
                <div className="flex items-center w-full md:w-auto md:flex-1 max-w-xs">
                    <div className="flex-1 h-px bg-gray-300 dark:bg-slate-600"></div>
                    {inconsistencies.length > 0 ? (
                        <DisruptionIndicator count={inconsistencies.length} />
                    ) : (
                         <div className="relative group flex items-center justify-center bg-green-900/50 border-2 border-green-500 rounded-full h-12 w-12 z-10">
                            <CheckCircleIcon className="h-6 w-6 text-green-300" />
                             <div className="absolute bottom-full mb-2 w-max px-3 py-1 bg-gray-800 dark:bg-slate-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                Data Reconciled
                            </div>
                        </div>
                    )}
                    <div className="flex-1 h-px bg-gray-300 dark:bg-slate-600"></div>
                </div>

                {/* Step 2: Consolidated View */}
                <div className="p-4 bg-gray-100/80 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-700 rounded-lg w-full md:w-auto md:flex-1 max-w-md">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <FlowChartIcon className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                        Consolidated View
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div>
                            <h4 className="font-semibold text-black dark:text-white mb-1">Inventory ({consolidatedInventory.length} records)</h4>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(sourceCounts.inventory).map(([src, count]) => (
                                    <div key={src} className={`flex items-center gap-1.5 text-xs font-medium text-white px-2 py-0.5 rounded-full ${SOURCE_STYLES[src as Source]?.classes}`}>
                                        {SOURCE_STYLES[src as Source]?.name ?? SOURCE_STYLES.Unknown.name}: <span className="font-bold">{String(count)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-black dark:text-white mb-1">Orders ({consolidatedOrders.length} records)</h4>
                             <div className="flex flex-wrap gap-2">
                                {Object.entries(sourceCounts.orders).map(([src, count]) => (
                                    <div key={src} className={`flex items-center gap-1.5 text-xs font-medium text-white px-2 py-0.5 rounded-full ${SOURCE_STYLES[src as Source]?.classes}`}>
                                        {SOURCE_STYLES[src as Source]?.name ?? SOURCE_STYLES.Unknown.name}: <span className="font-bold">{String(count)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                         {consolidatedReturns.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-black dark:text-white mb-1">Returns ({consolidatedReturns.length} records)</h4>
                                <div className="flex flex-wrap gap-2">
                                    <div className={`flex items-center gap-1.5 text-xs font-medium text-white px-2 py-0.5 rounded-full ${SOURCE_STYLES.ReverseLogistics.classes}`}>
                                        {SOURCE_STYLES.ReverseLogistics.name}: <span className="font-bold">{consolidatedReturns.length}</span>
                                    </div>
                                </div>
                            </div>
                         )}
                    </div>
                </div>
            </div>

             {/* Action Buttons */}
             {consolidatedInventory.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-4 pt-6 border-t border-gray-200 dark:border-slate-700">
                    <button
                        onClick={onAutoFix}
                        disabled={isFixing}
                        className="inline-flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-lg text-base font-semibold hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200 shadow-lg hover:shadow-indigo-500/50 transform hover:-translate-y-0.5"
                    >
                        {isFixing ? <Loader /> : <SparklesIcon className="h-6 w-6" />}
                        {isFixing ? 'Analyzing...' : 'Generate AI Analysis & Fixes'}
                    </button>
                </div>
             )}

            {/* Disruption Analysis Card */}
            {disruptionAnalysis && (
                <details className="bg-gray-100/70 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-lg transition-all duration-300" open>
                    <summary className="p-4 font-semibold text-red-600 dark:text-red-300 cursor-pointer flex justify-between items-center hover:bg-gray-200/50 dark:hover:bg-slate-800/50 rounded-t-lg">
                        <span className="flex items-center gap-2"><BoltIcon className="h-5 w-5" /> View Disruption Analysis</span>
                        <ChevronDownIcon className="h-6 w-6 transition-transform transform details-open:rotate-180 chevron" />
                    </summary>
                    <div className="p-4 border-t border-gray-200 dark:border-slate-700 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 dark:bg-slate-800/70 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                                <h4 className="font-semibold text-gray-800 dark:text-white">Missing Inventory Data</h4>
                                <p className="text-3xl font-bold text-red-500 dark:text-red-400">{disruptionAnalysis.missingInventoryData.percentage}%</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{disruptionAnalysis.missingInventoryData.count} of {disruptionAnalysis.missingInventoryData.total} records have missing fields.</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-slate-800/70 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                                <h4 className="font-semibold text-gray-800 dark:text-white">Missing Order Data</h4>
                                <p className="text-3xl font-bold text-red-500 dark:text-red-400">{disruptionAnalysis.missingOrderData.percentage}%</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{disruptionAnalysis.missingOrderData.count} of {disruptionAnalysis.missingOrderData.total} records have missing fields.</p>
                            </div>
                        </div>
                        {disruptionAnalysis.inTransitOrders.length > 0 && (
                            <div>
                                <h4 className="text-md font-semibold mb-2 text-cyan-600 dark:text-cyan-300 flex items-center gap-2"><TruckIcon className="h-5 w-5" /> Potential In-Transit Shipments ({disruptionAnalysis.inTransitOrders.length})</h4>
                                {renderTable(disruptionAnalysis.inTransitOrders)}
                            </div>
                        )}
                    </div>
                </details>
            )}

            {/* Inconsistency Details (Collapsible) */}
            {inconsistencies.length > 0 && (
                 <details className="bg-gray-100/70 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-lg transition-all duration-300">
                    <summary className="p-4 font-semibold text-yellow-600 dark:text-yellow-300 cursor-pointer flex justify-between items-center hover:bg-gray-200/50 dark:hover:bg-slate-800/50 rounded-t-lg">
                        <span><AlertTriangleIcon className="inline h-5 w-5 mr-2" /> View {inconsistencies.length} Data {inconsistencies.length > 1 ? 'Inconsistencies' : 'Inconsistency'}</span>
                        <ChevronDownIcon className="h-6 w-6 transition-transform transform details-open:rotate-180 chevron" />
                    </summary>
                    <div className="p-4 border-t border-gray-200 dark:border-slate-700 space-y-4">
                       {inconsistencies.map((issue, i) => (
                          <div key={i}>
                            <h4 className="text-md font-semibold mb-2 text-yellow-500 dark:text-yellow-400">{issue.type}</h4>
                            {renderTable(issue.details)}
                          </div>
                        ))}
                    </div>
                </details>
            )}

             {/* Inventory & Reorder Management Card */}
            {consolidatedInventory.length > 0 && (
                <InventoryManagement 
                    inventory={consolidatedInventory} 
                    orders={consolidatedOrders}
                    returns={consolidatedReturns}
                    report={report}
                    onManualUpdate={onManualUpdate}
                />
            )}
        </div>
    );
};
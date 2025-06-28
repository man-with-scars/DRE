import type { FileState } from '../App';
import type { SourceData } from '../services/geminiService';

// --- TYPE DEFINITIONS ---
type DataRow = Record<string, any>;
export type Inconsistency = { type: string; details: DataRow[] };

export type AiReport = {
  fixesApplied: string[];
  rootCauseAnalysis: string[];
  recommendations: string[];
};

export type DisruptionAnalysis = {
    missingInventoryData: { count: number; percentage: number; total: number };
    missingOrderData: { count: number; percentage: number; total: number };
    inTransitOrders: DataRow[];
};

export type ProcessedData = {
  inconsistencies: Inconsistency[];
  cleaningSteps: string[];
  consolidatedInventory: DataRow[];
  consolidatedOrders: DataRow[];
  consolidatedReturns: DataRow[];
  report: string | AiReport;
  disruptionAnalysis: DisruptionAnalysis | null;
  sourceData: SourceData;
};

// --- FILE HELPERS ---

// A simple CSV parser. Assumes comma-separated and a header row.
const parseCSV = (text: string): DataRow[] => {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return header.reduce((obj, nextKey, index) => {
      const value = values[index]?.trim() || null;
      // Remove surrounding quotes if they exist
      obj[nextKey] = (value && value.startsWith('"') && value.endsWith('"')) ? value.slice(1, -1) : value;
      return obj;
    }, {} as DataRow);
  });
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

const generateCsvContent = (data: DataRow[]): string => {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const headerRow = headers.join(',');
    const rows = data.map(row => headers.map(header => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        const strVal = String(val);
        // handle values with commas by enclosing in quotes
        if (strVal.includes(',')) {
            return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
    }).join(','));
    return [headerRow, ...rows].join('\n');
};

export const downloadFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};

export const downloadCsv = (data: DataRow[], fileName: string) => {
    const csvContent = generateCsvContent(data);
    downloadFile(csvContent, fileName, 'text/csv;charset=utf-8;');
};


// --- DATA PROCESSING LOGIC (Ported from Python) ---

const cleanData = (data: DataRow[], sourceName: string): DataRow[] => {
  if(!data || data.length === 0) return [];
  const df = JSON.parse(JSON.stringify(data)); // Deep copy

  const qtyColumns = Object.keys(df[0] || {}).filter(col => col.toLowerCase().includes('qty'));
  const textColumns = ['item_id', 'item_name', 'order_id', 'return_id'];

  df.forEach(row => {
    qtyColumns.forEach(col => {
        if (row[col] === '' || row[col] === null || row[col] === undefined || row[col] === 'NA') {
            row[col] = null;
        } else {
            const num = Number(row[col]);
            row[col] = isNaN(num) ? null : num;
        }
    });
    textColumns.forEach(col => {
      if (row[col] && typeof row[col] === 'string') {
        row[col] = row[col].trim().toUpperCase();
      }
    });
  });
  return df;
};

const identifyInconsistencies = (legacy: DataRow[], spreadsheet: DataRow[]): Inconsistency[] => {
  const inconsistencies: Inconsistency[] = [];

  // Helper for outer join on a key and a value column
  const outerJoin = (left: DataRow[], right: DataRow[], key: string, valCol: string, suffixes: [string, string]) => {
    const map = new Map<string, any>();
    left.forEach(row => {
        if(row[key]) map.set(row[key], { [key]: row[key], [`${valCol}${suffixes[0]}`]: row[valCol] })
    });
    right.forEach(row => {
        if(!row[key]) return;
      const existing = map.get(row[key]) || {[key]: row[key]};
      map.set(row[key], { ...existing, [`${valCol}${suffixes[1]}`]: row[valCol] });
    });
    return Array.from(map.values());
  };

  // Inventory
  const mergedInv = outerJoin(legacy, spreadsheet, 'item_id', 'inventory_qty', ['_legacy', '_spreadsheet']);
  const qtyDiscrepancies = mergedInv.filter(row => {
    const val1 = row.inventory_qty_legacy;
    const val2 = row.inventory_qty_spreadsheet;
    if (val1 === null || val2 === null) return false; // Don't compare if one is missing
    const diff = Number(val1) - Number(val2);
    return !isNaN(diff) && diff !== 0;
  });
  if (qtyDiscrepancies.length > 0) {
    inconsistencies.push({ type: 'Inventory Quantity Discrepancy', details: qtyDiscrepancies });
  }

  // Orders
  const mergedOrders = outerJoin(legacy, spreadsheet, 'order_id', 'order_qty', ['_legacy', '_spreadsheet']);
  const orderDiscrepancies = mergedOrders.filter(row => {
      const val1 = row.order_qty_legacy;
      const val2 = row.order_qty_spreadsheet;
      if (val1 === null || val2 === null) return false;
      const diff = Number(val1) - Number(val2);
      return !isNaN(diff) && diff !== 0;
  });
  if (orderDiscrepancies.length > 0) {
    inconsistencies.push({ type: 'Order Quantity Discrepancy', details: orderDiscrepancies });
  }
  
  return inconsistencies;
};

const calculateDisruption = (legacy: DataRow[], spreadsheet: DataRow[], supplier: DataRow[]): DisruptionAnalysis => {
    const REQUIRED_INV_FIELDS = ['item_id', 'inventory_qty', 'last_updated'];
    const REQUIRED_ORDER_FIELDS = ['order_id', 'order_qty', 'last_updated'];

    const invRecords = [...legacy, ...spreadsheet].filter(r => r.item_id);
    const missingInv = invRecords.filter(r => REQUIRED_INV_FIELDS.some(field => r[field] === null || r[field] === undefined || r[field] === '')).length;
    const totalInvRecords = invRecords.length;

    const orderRecords = [...legacy, ...spreadsheet].filter(r => r.order_id);
    const missingOrders = orderRecords.filter(r => REQUIRED_ORDER_FIELDS.some(field => r[field] === null || r[field] === undefined || r[field] === '')).length;
    const totalOrderRecords = orderRecords.length;

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const inTransitOrders = supplier.filter(r => {
        if (!r.shipment_date) return false;
        try {
            const shipmentDate = new Date(r.shipment_date.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')); // handle MM/DD/YYYY
            return shipmentDate > twoWeeksAgo;
        } catch {
            return false;
        }
    });

    return {
        missingInventoryData: {
            count: missingInv,
            total: totalInvRecords,
            percentage: totalInvRecords > 0 ? parseFloat(((missingInv / totalInvRecords) * 100).toFixed(1)) : 0
        },
        missingOrderData: {
            count: missingOrders,
            total: totalOrderRecords,
            percentage: totalOrderRecords > 0 ? parseFloat(((missingOrders / totalOrderRecords) * 100).toFixed(1)) : 0
        },
        inTransitOrders: inTransitOrders
    };
};


const proposeCleaningSteps = (inconsistencies: Inconsistency[]): string[] => {
  if (inconsistencies.length === 0) return ["No inconsistencies found. Data appears aligned."];
  return inconsistencies.map(issue => 
    `Resolve ${issue.type}: Use most recent data or manual verification for ${issue.details.length} records.`
  );
};

const consolidateData = (legacy: DataRow[], spreadsheet: DataRow[], supplier: DataRow[], reverseLogistics: DataRow[]): { inventory: DataRow[], orders: DataRow[], returns: DataRow[] } => {
  // Inventory
  const legacyInv = legacy.map(r => ({ item_id: r.item_id, item_name: r.item_name, inventory_qty: r.inventory_qty, last_updated: r.last_updated, _source: 'Legacy' }));
  const spreadsheetInv = spreadsheet.map(r => ({ item_id: r.item_id, item_name: r.item_name, inventory_qty: r.inventory_qty, last_updated: r.last_updated, _source: 'Spreadsheet' }));
  const supplierInv = supplier.map(r => ({ item_id: r.item_id, item_name: r.item_name, inventory_qty: r.shipment_qty, last_updated: r.shipment_date, _source: 'Supplier' }));
  
  const combinedInv = [...legacyInv, ...spreadsheetInv, ...supplierInv].filter(r => r.item_id && r.last_updated);
  combinedInv.sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());
  
  const uniqueInv = new Map<string, DataRow>();
  combinedInv.forEach(row => {
    if(!uniqueInv.has(row.item_id)) uniqueInv.set(row.item_id, row)
  });
  
  // Orders
  const combinedOrders = [
    ...legacy.map(r => ({ order_id: r.order_id, order_qty: r.order_qty, last_updated: r.last_updated, _source: 'Legacy' })),
    ...spreadsheet.map(r => ({ order_id: r.order_id, order_qty: r.order_qty, last_updated: r.last_updated, _source: 'Spreadsheet' }))
  ].filter(r => r.order_id && r.last_updated);
  combinedOrders.sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());

  const uniqueOrders = new Map<string, DataRow>();
  combinedOrders.forEach(row => {
    if(!uniqueOrders.has(row.order_id)) uniqueOrders.set(row.order_id, row)
  });

  // Returns
  const consolidatedReturns = reverseLogistics.map(r => ({...r, _source: 'ReverseLogistics'}));

  return { inventory: Array.from(uniqueInv.values()), orders: Array.from(uniqueOrders.values()), returns: consolidatedReturns };
};

export const formatReportToText = (report: string | AiReport): string => {
    if (typeof report === 'string') {
        return report;
    }
    let text = `# Supply Chain Data Reconciliation Report\nGenerated on: ${new Date().toISOString()}\n\n`;
    text += "## AI Fixes Applied\n";
    if (report.fixesApplied?.length > 0) {
        report.fixesApplied.forEach(fix => text += `- ${fix}\n`);
    } else {
        text += "No specific fixes were automatically applied.\n";
    }
    text += "\n## AI Root Cause Analysis\n";
     if (report.rootCauseAnalysis?.length > 0) {
        report.rootCauseAnalysis.forEach(cause => text += `- ${cause}\n`);
    } else {
        text += "No root cause analysis was generated.\n";
    }
    text += "\n## AI Recommendations\n";
     if (report.recommendations?.length > 0) {
        report.recommendations.forEach(rec => text += `- ${rec}\n`);
    } else {
        text += "No specific recommendations were generated.\n";
    }
    return text;
};

export const mergeAiFixesIntoSources = (originalSources: SourceData, aiFixedData: Partial<ProcessedData>): SourceData => {
    const updatedSources = JSON.parse(JSON.stringify(originalSources)); // Deep copy

    const { consolidatedInventory, consolidatedOrders } = aiFixedData;

    // Helper to update a source array
    const updateSource = (sourceArray: DataRow[], consolidatedData: DataRow[], idField: string, mappings: Record<string, string>) => {
        if (!sourceArray || !consolidatedData) return;

        const consolidatedMap = new Map(consolidatedData.map(item => [item[idField], item]));

        sourceArray.forEach(row => {
            const correctedItem = consolidatedMap.get(row[idField]);
            if (correctedItem) {
                // Update fields based on mapping
                for (const destKey in mappings) {
                    const srcKey = mappings[destKey];
                    if (correctedItem[srcKey] !== undefined) {
                        row[destKey] = correctedItem[srcKey];
                    }
                }
            }
        });
    };

    // Update inventory data (legacy and spreadsheet)
    if (consolidatedInventory) {
        const invMapping = {
            'item_name': 'item_name',
            'inventory_qty': 'inventory_qty',
            'last_updated': 'last_updated',
        };
        updateSource(updatedSources.legacy, consolidatedInventory, 'item_id', invMapping);
        updateSource(updatedSources.spreadsheet, consolidatedInventory, 'item_id', invMapping);
    }

    // Update order data (legacy and spreadsheet)
    if (consolidatedOrders) {
        const orderMapping = {
            'order_qty': 'order_qty',
            'last_updated': 'last_updated',
        };
        updateSource(updatedSources.legacy, consolidatedOrders, 'order_id', orderMapping);
        updateSource(updatedSources.spreadsheet, consolidatedOrders, 'order_id', orderMapping);
    }
    
    // We don't update supplier or reverse logistics as they are considered sources of truth
    return updatedSources;
};


// --- MAIN ORCHESTRATION FUNCTION ---

export const processFiles = async (files: FileState): Promise<ProcessedData> => {
  try {
    if (!files.legacy || !files.spreadsheet || !files.supplier) {
        throw new Error("Missing one or more mandatory data files.");
    }
    const legacyRaw = await readFileAsText(files.legacy);
    const spreadsheetRaw = await readFileAsText(files.spreadsheet);
    const supplierRaw = await readFileAsText(files.supplier);
    const reverseLogisticsRaw = files.reverseLogistics ? await readFileAsText(files.reverseLogistics) : "";
    const historicalBackupRaw = files.historicalBackup ? await readFileAsText(files.historicalBackup) : "";


    let legacyData = parseCSV(legacyRaw);
    let spreadsheetData = parseCSV(spreadsheetRaw);
    let supplierData = parseCSV(supplierRaw);
    let reverseLogisticsData = parseCSV(reverseLogisticsRaw);
    let historicalBackupData = parseCSV(historicalBackupRaw);

    legacyData = cleanData(legacyData, 'Legacy Database');
    spreadsheetData = cleanData(spreadsheetData, 'Manual Spreadsheet');
    supplierData = cleanData(supplierData, 'Supplier Data');
    reverseLogisticsData = cleanData(reverseLogisticsData, 'Reverse Logistics');
    historicalBackupData = cleanData(historicalBackupData, 'Historical Backup');


    const inconsistencies = identifyInconsistencies(legacyData, spreadsheetData);
    const cleaningSteps = proposeCleaningSteps(inconsistencies);
    
    const { inventory: consolidatedInventory, orders: consolidatedOrders, returns: consolidatedReturns } = consolidateData(legacyData, spreadsheetData, supplierData, reverseLogisticsData);
    
    const disruptionAnalysis = calculateDisruption(legacyData, spreadsheetData, supplierData);
    
    const report = "Initial report. Run 'Auto-Fix with AI' for detailed analysis.";

    const sourceData = {
        legacy: legacyData,
        spreadsheet: spreadsheetData,
        supplier: supplierData,
        reverseLogistics: reverseLogisticsData,
        historicalBackup: historicalBackupData
    };

    return {
      inconsistencies,
      cleaningSteps,
      consolidatedInventory,
      consolidatedOrders,
      consolidatedReturns,
      report,
      disruptionAnalysis,
      sourceData
    };
  } catch (error) {
    console.error("Error during file processing:", error);
    throw new Error("Failed to read or process one of the files. Please ensure they are valid CSVs.");
  }
};
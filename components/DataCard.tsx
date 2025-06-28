import React from 'react';

const renderTable = (data: Record<string, any>[]) => {
    if (!data || data.length === 0) {
      return <p className="text-gray-500 italic p-4 text-center">No data to display.</p>;
    }
    const headers = Object.keys(data[0]);
    return (
      <div className="overflow-x-auto -mx-6">
        <table className="w-full text-sm text-left text-gray-600">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              {headers.map(header => <th key={header} className="px-6 py-3 font-semibold tracking-wider">{header.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {headers.map(header => (
                  <td key={header} className="px-6 py-4 whitespace-nowrap">
                     {row[header] === null || row[header] === undefined ? <span className="text-gray-400">N/A</span> : String(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };


interface DataCardProps {
    title: string;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    data?: Record<string, any>[];
}

const DataCard: React.FC<DataCardProps> & { Table: typeof renderTable } = ({ title, icon, children, data }) => {
    return (
        <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                {icon && <div className="text-gray-400">{icon}</div>}
            </div>
            <div>
                {children}
                {data && renderTable(data)}
            </div>
        </div>
    );
};
DataCard.Table = renderTable;

export { DataCard };

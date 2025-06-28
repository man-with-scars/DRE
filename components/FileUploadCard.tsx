


import React, { useState, useCallback, DragEvent } from 'react';
import { UploadIcon, FileCheckIcon, XMarkIcon } from './icons.tsx';

interface FileUploadCardProps {
  title: string;
  onFileLoad: (file: File) => void;
  file: File | null;
  onClear: () => void;
}

export const FileUploadCard: React.FC<FileUploadCardProps> = ({ title, onFileLoad, file, onClear }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.type === 'text/csv') {
      onFileLoad(selectedFile);
    } else if (selectedFile) {
      alert('Please upload a valid CSV file.');
    }
  };

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleClearClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClear();
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      className={`relative p-2 bg-white/20 dark:bg-slate-800/20 backdrop-blur-md border border-dashed rounded-lg text-center transition-all duration-300 h-24 flex flex-col justify-center
        ${isDragging 
            ? 'border-blue-500 scale-105 bg-blue-500/20 dark:bg-blue-400/20' 
            : `border-gray-300 dark:border-gray-500`
        }
        ${file ? 'border-solid border-green-500 dark:border-green-500 bg-green-500/10' : ''}`}
    >
      <input
        type="file"
        id={`file-upload-${title.replace(/\s+/g, '-')}`}
        className="hidden"
        accept=".csv"
        onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
        onClick={(e) => (e.currentTarget.value = '')} // Allow re-uploading the same file
      />
      <label
        htmlFor={`file-upload-${title.replace(/\s+/g, '-')}`}
        className="cursor-pointer flex flex-col items-center justify-center h-full"
      >
        {file ? (
          <div className="flex flex-col items-center justify-center text-green-600 w-full gap-0.5">
            <FileCheckIcon className="h-5 w-5" />
            <h3 className="text-xs font-semibold text-[#242424] dark:text-gray-100">{title}</h3>
            <p className="text-[10px] leading-tight text-gray-700 dark:text-gray-300 truncate max-w-full px-1" title={file.name}>{file.name}</p>
            <div className="flex items-center gap-1 mt-0.5 text-[10px] leading-tight text-gray-700 dark:text-gray-300">
                <span className="hover:underline">Click to change</span>
                <button 
                  onClick={handleClearClick} 
                  title="Clear file" 
                  className="p-0.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                >
                    <XMarkIcon className="h-3 w-3" />
                </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-700 dark:text-gray-300 gap-0.5">
            <UploadIcon className="h-5 w-5 text-blue-600 dark:text-blue-500" />
            <h3 className="text-xs font-semibold text-[#242424] dark:text-gray-100">{title}</h3>
            <p className="text-[10px] leading-tight">Drag & drop or <span className="text-blue-600 font-semibold">click to upload</span></p>
          </div>
        )}
      </label>
    </div>
  );
};
import React from 'react';
import { ComputerDesktopIcon, DevicePhoneMobileIcon } from './icons';
import type { ViewMode } from '../App';

interface ViewToggleProps {
    viewMode: ViewMode;
    onToggle: (mode: ViewMode) => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ viewMode, onToggle }) => {
    return (
        <div className="flex items-center gap-1 p-1 rounded-full bg-gray-200/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-300 dark:border-slate-600">
            <button
                onClick={() => onToggle('desktop')}
                className={`p-2 rounded-full transition-colors duration-200 ${
                    viewMode === 'desktop' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-slate-700/50'
                }`}
                aria-label="Switch to desktop view"
            >
                <ComputerDesktopIcon className="h-5 w-5" />
            </button>
            <button
                onClick={() => onToggle('mobile')}
                className={`p-2 rounded-full transition-colors duration-200 ${
                    viewMode === 'mobile' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-slate-700/50'
                }`}
                aria-label="Switch to mobile view"
            >
                <DevicePhoneMobileIcon className="h-5 w-5" />
            </button>
        </div>
    );
};
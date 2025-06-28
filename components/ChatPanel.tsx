import React, { useState, useEffect, useRef } from 'react';
import MarkdownIt from 'markdown-it';
import { PaperAirplaneIcon, UserCircleIcon, SparklesIcon } from './icons';
import { Loader } from './Loader';

// Define the message type, matching App.tsx state
type ChatMessage = {
    role: 'user' | 'model';
    parts: { text: string }[];
};

interface ChatPanelProps {
    history: ChatMessage[];
    isLoading: boolean;
    onSendMessage: (message: string) => void;
}

const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
});

export const ChatPanel: React.FC<ChatPanelProps> = ({ history, isLoading, onSendMessage }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [history, isLoading]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSendMessage(input.trim());
            setInput('');
        }
    };
    
    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-blue-900/50 rounded-lg border border-gray-200 dark:border-blue-800/50">
            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                {history.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'model' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                                <SparklesIcon className="w-5 h-5" />
                            </div>
                        )}
                        <div className={`max-w-xs md:max-w-md lg:max-w-sm rounded-xl px-4 py-2.5 shadow-sm ${
                            msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-br-none' 
                                : 'bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                        }`}>
                             <div className="chat-content" dangerouslySetInnerHTML={{ __html: md.render(msg.parts[0].text) }} />
                        </div>
                         {msg.role === 'user' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-slate-600 flex items-center justify-center text-gray-600 dark:text-gray-200">
                                <UserCircleIcon className="w-6 h-6" />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3 justify-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                            <SparklesIcon className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="max-w-xs md:max-w-md lg:max-w-sm rounded-xl px-4 py-2.5 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-bl-none">
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                <Loader />
                                <span>Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t border-gray-200 dark:border-white/20">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your data..."
                        className="flex-grow w-full bg-white dark:bg-blue-800/80 border border-gray-300 dark:border-blue-700 rounded-lg p-2.5 placeholder-gray-600 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="flex-shrink-0 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                        aria-label="Send message"
                    >
                        <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                </form>
            </div>
            <style>{`
                .chat-content p:first-child { margin-top: 0; }
                .chat-content p:last-child { margin-bottom: 0; }
                .chat-content ul, .chat-content ol { padding-left: 1.25rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
                .chat-content a { color: #2563eb; text-decoration: underline; }
                .dark .chat-content a { color: #60a5fa; }
            `}</style>
        </div>
    );
};
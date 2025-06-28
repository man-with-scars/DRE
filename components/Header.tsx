


import React, { useState, useEffect, useMemo } from 'react';
import { MapPinIcon, ChevronDownIcon, SunIcon, MoonIcon } from './icons.tsx';
import type { Theme } from '../App';

interface HeaderProps {
    userName: string;
    location: string;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    isMobileView?: boolean;
}

const BouncingBallsAnimation = React.memo(({ theme, numBalls = 20 }: { theme: Theme, numBalls?: number }) => {
    const balls = useMemo(() => {
        return Array.from({ length: numBalls }).map((_, i) => {
            const size = Math.random() * 80 + 20; // 20px to 100px
            return {
                id: i,
                style: {
                    '--size': `${size}px`,
                    '--start-x': `${Math.random() * 100 - 50}vw`,
                    '--start-y': `${Math.random() * 100 - 50}vh`,
                    '--end-x': `${Math.random() * 100 - 50}vw`,
                    '--end-y': `${Math.random() * 100 - 50}vh`,
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    animationDuration: `${Math.random() * 20 + 15}s`, // 15s to 35s
                    animationDelay: `-${Math.random() * 35}s`,
                } as React.CSSProperties
            };
        });
    }, []);

    const ballColorClass = theme === 'dark' ? 'bg-red-500/70' : 'bg-blue-500/20';

    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden filter blur-sm">
            {balls.map(ball => (
                <div
                    key={ball.id}
                    className={`absolute rounded-full ${ballColorClass} animate-move`}
                    style={ball.style}
                />
            ))}
        </div>
    );
});


export const Header: React.FC<HeaderProps> = ({ userName, location, theme, setTheme, isMobileView }) => {
    const [time, setTime] = useState(new Date());
    const [animationKey, setAnimationKey] = useState(0);

    useEffect(() => {
        const timeTimerId = setInterval(() => setTime(new Date()), 1000);
        return () => {
            clearInterval(timeTimerId);
        };
    }, []);

    const handleHeaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent re-rendering animation if clicking the theme toggle
        if ((e.target as HTMLElement).closest('.theme-toggle')) {
            return;
        }
        setAnimationKey(prev => prev + 1);
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    };
    
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    };

    const getGreeting = useMemo(() => {
        const hour = time.getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        if (hour < 22) return 'Good Evening';
        return 'Good Night';
    }, [time]);

    return (
        <>
        <style>
            {`
                @keyframes move {
                    from { transform: translate(var(--start-x), var(--start-y)) scale(0.8); }
                    to { transform: translate(var(--end-x), var(--end-y)) scale(1.2); }
                }
                .animate-move {
                    width: var(--size);
                    height: var(--size);
                    animation-name: move;
                    animation-timing-function: linear;
                    animation-iteration-count: infinite;
                    animation-direction: alternate;
                }
            `}
        </style>
        <div 
            className={`relative text-gray-800 dark:text-white ${isMobileView ? 'p-6 min-h-[260px]' : 'p-8 min-h-[320px]'} rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-lg flex flex-col justify-between cursor-pointer`}
            onClick={handleHeaderClick}
        >
            <BouncingBallsAnimation key={animationKey} theme={theme} />
            <div className="absolute inset-0 bg-black/5 dark:bg-black/20 backdrop-blur-lg"></div>
            
            <div className={`relative z-10 flex ${isMobileView ? 'flex-col gap-4' : 'justify-between'} items-start w-full`}>
                <h1 className="text-2xl font-semibold" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{getGreeting}, <span className="text-red-500">{userName}</span></h1>
                 <div className={`flex items-center gap-2 ${isMobileView ? 'self-end' : ''}`}>
                    <button 
                        onClick={toggleTheme}
                        className="theme-toggle p-2 rounded-full bg-black/10 dark:bg-white/20 backdrop-blur-sm text-sm border border-black/20 dark:border-white/30"
                        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {theme === 'dark' ? <SunIcon className="h-5 w-5 text-yellow-300"/> : <MoonIcon className="h-5 w-5 text-blue-800"/>}
                    </button>
                    <div className="flex items-center gap-2 bg-black/10 dark:bg-white/20 backdrop-blur-sm p-2 px-4 rounded-full text-sm border border-black/20 dark:border-white/30">
                        <MapPinIcon className="h-5 w-5" />
                        <span>{location}</span>
                        <ChevronDownIcon className="h-5 w-5 opacity-70" />
                    </div>
                </div>
            </div>
            <div className="relative z-10">
                <p className={`${isMobileView ? 'text-7xl' : 'text-8xl'} font-bold`} style={{ textShadow: '0 2px 15px rgba(0,0,0,0.5)' }}>{formatTime(time).replace(/ /g,'')}</p>
                <p className="text-lg mt-1 text-gray-600 dark:text-gray-300" style={{ textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>{formatDate(time)}</p>
            </div>
        </div>
        </>
    );
};
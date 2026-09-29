import { useEffect, useState } from 'react';

function readTheme() {
    const saved = localStorage.getItem('seatlock-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
    const [theme, setTheme] = useState(readTheme);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.querySelector('meta[name="theme-color"]')?.setAttribute(
            'content',
            theme === 'dark' ? '#0d1117' : '#f8f7f4'
        );
        localStorage.setItem('seatlock-theme', theme);
    }, [theme]);

    return {
        theme,
        toggleTheme: () => setTheme(current => current === 'dark' ? 'light' : 'dark')
    };
}

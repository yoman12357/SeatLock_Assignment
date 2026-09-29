import { MoonIcon, SunIcon } from './Icons';

export default function ThemeToggle({ theme, onToggle }) {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-label={`Switch to ${nextTheme} theme`}
            title={`Switch to ${nextTheme} theme`}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white/80 text-slate-600 transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
        >
            {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
        </button>
    );
}

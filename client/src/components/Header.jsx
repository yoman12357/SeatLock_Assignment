import Brand from './Brand';
import ThemeToggle from './ThemeToggle';
import { LogoutIcon } from './Icons';

export default function Header({ userId, connected, theme, onThemeToggle, onLogout }) {
    return (
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-stone-50/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#0d1117]/85">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
                <Brand compact />
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300 sm:flex">
                        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,.65)]' : 'bg-rose-500'}`} />
                        {connected ? 'Live' : 'Reconnecting'}
                    </div>
                    <div className="hidden rounded-xl bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300 md:block">{userId}</div>
                    <ThemeToggle theme={theme} onToggle={onThemeToggle} />
                    <button onClick={onLogout} className="icon-button" type="button" title="Sign out" aria-label="Sign out">
                        <LogoutIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </header>
    );
}

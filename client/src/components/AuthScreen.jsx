import { useState } from 'react';
import Brand from './Brand';
import ThemeToggle from './ThemeToggle';
import { ArrowIcon, ClockIcon, SparkIcon, TicketIcon, UsersIcon } from './Icons';

export default function AuthScreen({ theme, onThemeToggle, onAuthenticate, busy }) {
    const [userId, setUserId] = useState('');
    const [passcode, setPasscode] = useState('');

    function submit(event, mode) {
        event.preventDefault();
        onAuthenticate(mode, { user_id: userId.trim(), passcode });
    }

    return (
        <main className="relative min-h-screen overflow-hidden bg-stone-50 px-5 py-5 text-slate-900 dark:bg-[#0d1117] dark:text-slate-100 sm:px-8">
            <div className="pointer-events-none absolute -left-36 top-1/3 h-96 w-96 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-500/10" />
            <div className="pointer-events-none absolute -right-36 -top-24 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10" />

            <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between">
                <Brand compact />
                <ThemeToggle theme={theme} onToggle={onThemeToggle} />
            </header>

            <div className="relative z-10 mx-auto grid min-h-[calc(100vh-90px)] max-w-6xl items-center gap-12 py-12 lg:grid-cols-[1.08fr_0.92fr] lg:py-8">
                <section className="max-w-2xl">
                    <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Workshop registration is live
                    </div>
                    <h1 className="max-w-xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-slate-950 dark:text-white sm:text-6xl">
                        One room. Twenty seats. <span className="text-amber-500 dark:text-amber-400">No double booking.</span>
                    </h1>
                    <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-400 sm:text-lg">
                        Hold your place, confirm when you are ready, or join a fair first-come waitlist. Every change appears live.
                    </p>
                    <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-3">
                        <Feature icon={TicketIcon} title="20 seats" detail="Strict capacity" />
                        <Feature icon={ClockIcon} title="Timed holds" detail="No stale seats" />
                        <Feature icon={UsersIcon} title="Fair queue" detail="FIFO promotion" />
                    </div>
                </section>

                <section className="mx-auto w-full max-w-md rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
                    <div className="mb-7 flex items-start justify-between gap-4">
                        <div>
                            <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                                <SparkIcon className="h-5 w-5" />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Welcome</h2>
                            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Sign in or create a local workshop account.</p>
                        </div>
                    </div>

                    <form onSubmit={event => submit(event, 'login')} className="space-y-5">
                        <Field label="Campus ID" hint="Letters, numbers, dashes, and underscores">
                            <input
                                value={userId}
                                onChange={event => setUserId(event.target.value)}
                                autoComplete="username"
                                pattern="[a-zA-Z0-9_-]+"
                                maxLength="64"
                                placeholder="e.g. aryan_42"
                                required
                                className="input-control"
                            />
                        </Field>
                        <Field label="Passcode" hint="At least 6 characters">
                            <input
                                value={passcode}
                                onChange={event => setPasscode(event.target.value)}
                                type="password"
                                minLength="6"
                                maxLength="128"
                                autoComplete="current-password"
                                placeholder="Enter your passcode"
                                required
                                className="input-control"
                            />
                        </Field>
                        <button disabled={busy} className="primary-button group w-full" type="submit">
                            {busy ? 'Please wait…' : 'Sign in'}
                            {!busy && <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                        </button>
                        <button
                            disabled={busy}
                            onClick={event => submit(event, 'register')}
                            className="secondary-button w-full"
                            type="button"
                        >
                            Create an account
                        </button>
                    </form>
                    <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-400 dark:border-white/10 dark:text-slate-500">
                        Your passcode is hashed before it is stored. Reservation ownership is checked on every request.
                    </p>
                </section>
            </div>
        </main>
    );
}

function Feature({ icon: Icon, title, detail }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/60 p-3.5 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-600 shadow-sm dark:bg-white/10 dark:text-amber-400 dark:shadow-none">
                <Icon className="h-4 w-4" />
            </div>
            <div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-500">{detail}</div>
            </div>
        </div>
    );
}

function Field({ label, hint, children }) {
    return (
        <label className="block">
            <span className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {label}
                <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">{hint}</span>
            </span>
            {children}
        </label>
    );
}

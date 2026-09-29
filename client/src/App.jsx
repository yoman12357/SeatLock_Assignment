import { useCallback, useEffect, useState } from 'react';
import ActivityFeed from './components/ActivityFeed';
import AuthScreen from './components/AuthScreen';
import AvailabilityPanel from './components/AvailabilityPanel';
import Header from './components/Header';
import ReservationCard from './components/ReservationCard';
import ToastRegion from './components/ToastRegion';
import { useTheme } from './hooks/useTheme';
import { apiRequest, createIdempotencyKey } from './lib/api';

const actionRoutes = {
    hold: '/api/hold',
    confirm: '/api/confirm',
    cancel: '/api/cancel',
    waitlist: '/api/waitlist'
};

export default function App() {
    const { theme, toggleTheme } = useTheme();
    const [session, setSession] = useState({ loading: true, userId: null });
    const [availability, setAvailability] = useState(null);
    const [userStatus, setUserStatus] = useState(null);
    const [activity, setActivity] = useState(null);
    const [connected, setConnected] = useState(false);
    const [authBusy, setAuthBusy] = useState(false);
    const [busyAction, setBusyAction] = useState(null);
    const [toasts, setToasts] = useState([]);

    const dismissToast = useCallback(id => {
        setToasts(current => current.filter(toast => toast.id !== id));
    }, []);

    const notify = useCallback((message, type = 'success') => {
        const id = `${Date.now()}-${Math.random()}`;
        setToasts(current => [...current, { id, message, type }].slice(-4));
        setTimeout(() => dismissToast(id), 4000);
    }, [dismissToast]);

    const loadStatus = useCallback(async () => {
        try {
            const data = await apiRequest('/api/status');
            setAvailability(data.availability);
            setUserStatus(data.user);
        } catch (error) {
            if (error.status === 401) setSession({ loading: false, userId: null });
            else notify('Could not refresh availability.', 'error');
        }
    }, [notify]);

    const loadActivity = useCallback(async () => {
        try {
            const data = await apiRequest('/api/activity?limit=30');
            setActivity(data.logs);
        } catch (error) {
            if (error.status === 401) setSession({ loading: false, userId: null });
        }
    }, []);

    useEffect(() => {
        apiRequest('/api/auth/me')
            .then(data => setSession({ loading: false, userId: data.user_id }))
            .catch(() => setSession({ loading: false, userId: null }));
    }, []);

    useEffect(() => {
        if (!session.userId) return undefined;
        loadStatus();
        loadActivity();

        const events = new EventSource('/api/events');
        events.addEventListener('open', () => setConnected(true));
        events.addEventListener('error', () => setConnected(false));
        events.addEventListener('availability', event => setAvailability(JSON.parse(event.data)));
        events.addEventListener('user_status', event => {
            const data = JSON.parse(event.data);
            if (data.user_id === session.userId) setUserStatus(data);
        });
        events.addEventListener('activity', loadActivity);
        return () => {
            events.close();
            setConnected(false);
        };
    }, [session.userId, loadActivity, loadStatus]);

    async function authenticate(mode, credentials) {
        setAuthBusy(true);
        try {
            const data = await apiRequest(`/api/auth/${mode}`, {
                method: 'POST',
                body: credentials,
                idempotencyKey: mode === 'register' ? createIdempotencyKey('register') : undefined
            });
            setSession({ loading: false, userId: data.user_id });
            notify(mode === 'register' ? 'Account created. Welcome to SeatLock.' : 'Welcome back.');
        } catch (error) {
            notify(error.message, 'error');
        } finally {
            setAuthBusy(false);
        }
    }

    async function logout() {
        try { await apiRequest('/api/auth/logout', { method: 'POST' }); } catch {}
        setSession({ loading: false, userId: null });
        setAvailability(null);
        setUserStatus(null);
        setActivity(null);
    }

    async function runAction(action) {
        setBusyAction(action);
        try {
            const data = await apiRequest(actionRoutes[action], {
                method: 'POST',
                idempotencyKey: createIdempotencyKey(action)
            });
            notify(data.message);
            await Promise.all([loadStatus(), loadActivity()]);
        } catch (error) {
            notify(error.message, 'error');
            await loadStatus();
        } finally {
            setBusyAction(null);
        }
    }

    if (session.loading) {
        return <LoadingScreen theme={theme} onThemeToggle={toggleTheme} />;
    }

    if (!session.userId) {
        return (
            <>
                <AuthScreen theme={theme} onThemeToggle={toggleTheme} onAuthenticate={authenticate} busy={authBusy} />
                <ToastRegion toasts={toasts} onDismiss={dismissToast} />
            </>
        );
    }

    const isFull = availability?.available === 0;
    return (
        <div className="min-h-screen bg-stone-50 text-slate-900 transition-colors dark:bg-[#0d1117] dark:text-slate-100">
            <Header
                userId={session.userId}
                connected={connected}
                theme={theme}
                onThemeToggle={toggleTheme}
                onLogout={logout}
            />
            <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
                <section className="mb-9 flex flex-col justify-between gap-5 border-b border-slate-200 pb-8 dark:border-white/10 md:flex-row md:items-end">
                    <div>
                        <div className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                            isFull
                                ? 'bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
                        }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isFull ? 'bg-violet-500' : 'bg-emerald-500'}`} />
                            {isFull ? 'Waitlist open' : 'Registration open'}
                        </div>
                        <h1 className="text-3xl font-bold tracking-[-0.035em] text-slate-950 dark:text-white sm:text-4xl">Campus Build Workshop</h1>
                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">Reserve one of 20 seats. Holds are temporary until confirmed.</p>
                    </div>
                    <div className="flex gap-7 text-sm">
                        <Meta label="Format" value="In person" />
                        <Meta label="Updates" value="Real time" />
                    </div>
                </section>

                <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)] lg:gap-10">
                    <div className="space-y-9">
                        <AvailabilityPanel availability={availability} />
                        <ReservationCard
                            status={userStatus}
                            availability={availability}
                            busyAction={busyAction}
                            onAction={runAction}
                            onExpire={loadStatus}
                        />
                    </div>
                    <ActivityFeed activity={activity} />
                </div>
            </main>
            <ToastRegion toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
}

function Meta({ label, value }) {
    return <div><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div><div className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{value}</div></div>;
}

function LoadingScreen({ theme, onThemeToggle }) {
    return (
        <div className="grid min-h-screen place-items-center bg-stone-50 dark:bg-[#0d1117]">
            <button className="absolute right-5 top-5 text-xs text-slate-400" onClick={onThemeToggle} type="button">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
            <div className="text-center">
                <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500 dark:border-white/10 dark:border-t-amber-400" />
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Checking your session…</p>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { CheckIcon, ClockIcon, SeatIcon, UsersIcon } from './Icons';

function useCountdown(expiresAt, onExpire) {
    const [remaining, setRemaining] = useState(null);
    useEffect(() => {
        if (!expiresAt) {
            setRemaining(null);
            return undefined;
        }
        let expired = false;
        function tick() {
            const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
            setRemaining(seconds);
            if (seconds === 0 && !expired) {
                expired = true;
                setTimeout(onExpire, 250);
            }
        }
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [expiresAt, onExpire]);
    return remaining;
}

export default function ReservationCard({ status, availability, busyAction, onAction, onExpire }) {
    const state = status?.status || 'none';
    const remaining = useCountdown(state === 'held' ? status.expires_at : null, onExpire);
    const full = availability?.available === 0;

    const content = {
        none: {
            icon: SeatIcon,
            iconStyle: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
            badge: 'No reservation',
            title: full ? 'The workshop is full' : 'A seat is available',
            detail: full ? 'Join the queue and you will receive a timed hold when a seat opens.' : 'Start with a temporary hold. Confirm it before the timer runs out.',
            action: full ? 'waitlist' : 'hold',
            actionLabel: full ? 'Join the waitlist' : 'Hold a seat'
        },
        expired: {
            icon: ClockIcon,
            iconStyle: 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400',
            badge: 'Hold expired',
            title: full ? 'That seat has been reassigned' : 'You can try again',
            detail: 'Your previous hold reached its deadline and was safely released.',
            action: full ? 'waitlist' : 'hold',
            actionLabel: full ? 'Join the waitlist' : 'Hold another seat'
        },
        confirmed: {
            icon: CheckIcon,
            iconStyle: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400',
            badge: 'Confirmed',
            title: 'Your seat is secured',
            detail: 'You are registered for the workshop. If your plans change, cancel so the next person can attend.',
            action: 'cancel',
            actionLabel: 'Cancel reservation'
        },
        waitlisted: {
            icon: UsersIcon,
            iconStyle: 'bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400',
            badge: `Waitlist position #${status?.waitlist_position || '—'}`,
            title: 'You are in the queue',
            detail: 'When a seat opens, it will be held for you automatically and your status will update here.',
            action: 'cancel',
            actionLabel: 'Leave the waitlist'
        }
    };
    const current = state === 'held' ? null : (content[state] || content.none);
    const StateIcon = current?.icon;

    return (
        <section aria-labelledby="reservation-title">
            <p className="eyebrow">Your place</p>
            <h2 id="reservation-title" className="section-heading mb-4">Reservation</h2>
            <div className="surface-card overflow-hidden">
                {state === 'held' ? (
                    <HeldState remaining={remaining} busyAction={busyAction} onAction={onAction} />
                ) : (
                    <div className="p-5 sm:p-6">
                        <div className={`mb-5 grid h-11 w-11 place-items-center rounded-2xl ${current.iconStyle}`}>
                            <StateIcon className="h-5 w-5" />
                        </div>
                        <span className="status-pill">{current.badge}</span>
                        <h3 className="mt-4 text-xl font-bold tracking-tight text-slate-950 dark:text-white">{current.title}</h3>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">{current.detail}</p>
                        <button
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() => onAction(current.action)}
                            className={current.action === 'cancel' ? 'danger-button mt-6' : 'primary-button mt-6'}
                        >
                            {busyAction === current.action ? 'Working…' : current.actionLabel}
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

function HeldState({ remaining, busyAction, onAction }) {
    const minutes = Math.floor((remaining || 0) / 60);
    const seconds = String((remaining || 0) % 60).padStart(2, '0');
    const urgent = remaining !== null && remaining <= 60;
    return (
        <div>
            <div className={`${urgent ? 'bg-rose-500' : 'bg-amber-400'} h-1.5 transition-colors`} />
            <div className="p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                    <div>
                        <div className={`mb-5 grid h-11 w-11 place-items-center rounded-2xl ${urgent ? 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400'}`}>
                            <ClockIcon className="h-5 w-5" />
                        </div>
                        <span className="status-pill">Seat held</span>
                        <h3 className="mt-4 text-xl font-bold tracking-tight text-slate-950 dark:text-white">Confirm before time runs out</h3>
                        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">Only you can confirm this hold. An unconfirmed seat returns to the pool automatically.</p>
                    </div>
                    <div className={`shrink-0 rounded-2xl px-5 py-4 text-center ${urgent ? 'bg-rose-50 dark:bg-rose-400/10' : 'bg-amber-50 dark:bg-amber-400/10'}`}>
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Time left</div>
                        <div className={`mt-1 font-mono text-3xl font-bold tabular-nums ${urgent ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>{minutes}:{seconds}</div>
                    </div>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button disabled={Boolean(busyAction)} onClick={() => onAction('confirm')} className="success-button" type="button">
                        {busyAction === 'confirm' ? 'Confirming…' : 'Confirm reservation'}
                    </button>
                    <button disabled={Boolean(busyAction)} onClick={() => onAction('cancel')} className="danger-button" type="button">
                        {busyAction === 'cancel' ? 'Releasing…' : 'Release seat'}
                    </button>
                </div>
            </div>
        </div>
    );
}

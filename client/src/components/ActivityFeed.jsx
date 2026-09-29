const actionLabels = {
    user_hold: 'held a seat',
    user_confirm: 'confirmed a reservation',
    user_cancel: 'cancelled a reservation',
    user_cancel_waitlist: 'left the waitlist',
    hold_expired_auto: 'had a hold expire',
    hold_expired_on_confirm_attempt: 'missed the confirmation window',
    user_join_waitlist: 'joined the waitlist',
    waitlist_promotion: 'moved from waitlist to hold'
};

const dotStyles = {
    user_hold: 'bg-amber-400',
    user_confirm: 'bg-emerald-500',
    user_cancel: 'bg-rose-500',
    user_cancel_waitlist: 'bg-rose-500',
    hold_expired_auto: 'bg-slate-400',
    hold_expired_on_confirm_attempt: 'bg-slate-400',
    user_join_waitlist: 'bg-violet-500',
    waitlist_promotion: 'bg-sky-500'
};

export default function ActivityFeed({ activity }) {
    return (
        <section aria-labelledby="activity-title">
            <div className="mb-4 flex items-end justify-between">
                <div>
                    <p className="eyebrow">Workshop</p>
                    <h2 id="activity-title" className="section-heading">Recent activity</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-white/5 dark:text-slate-400">Live</span>
            </div>
            <div className="surface-card divide-y divide-slate-100 overflow-hidden dark:divide-white/[0.06]">
                {!activity && <ActivitySkeleton />}
                {activity?.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">No activity yet.</p>}
                {activity?.slice(0, 10).map(item => (
                    <article key={item.id} className="flex gap-3.5 px-5 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.025]">
                        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-slate-100 dark:ring-white/5 ${dotStyles[item.reason] || 'bg-slate-400'}`} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                                <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">{item.user_id}</span>{' '}
                                {actionLabels[item.reason] || item.reason}
                            </p>
                            <time className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">{relativeTime(item.created_at)}</time>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}

function ActivitySkeleton() {
    return Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex animate-pulse gap-3.5 px-5 py-4">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-white/10" />
            <div className="flex-1"><div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-white/10"/><div className="mt-2 h-2.5 w-20 rounded bg-slate-100 dark:bg-white/5"/></div>
        </div>
    ));
}

function relativeTime(value) {
    const normalized = value.endsWith('Z') ? value : `${value}Z`;
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(normalized).getTime()) / 1000));
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(normalized).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

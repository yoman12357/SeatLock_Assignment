import { CheckIcon, ClockIcon, SeatIcon, UsersIcon } from './Icons';

const cards = [
    { key: 'available', label: 'Available', icon: SeatIcon, tone: 'emerald' },
    { key: 'held', label: 'On hold', icon: ClockIcon, tone: 'amber' },
    { key: 'confirmed', label: 'Confirmed', icon: CheckIcon, tone: 'sky' },
    { key: 'waitlist_count', label: 'Waitlist', icon: UsersIcon, tone: 'violet' }
];

const tones = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400'
};

export default function AvailabilityPanel({ availability }) {
    const data = availability || { total: 20, available: 0, held: 0, confirmed: 0, waitlist_count: 0 };
    const occupied = data.held + data.confirmed;
    const confirmedWidth = data.total ? data.confirmed / data.total * 100 : 0;
    const heldWidth = data.total ? data.held / data.total * 100 : 0;

    return (
        <section aria-labelledby="availability-title">
            <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                    <p className="eyebrow">Right now</p>
                    <h2 id="availability-title" className="section-heading">Live availability</h2>
                </div>
                <div className="text-right">
                    <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">{occupied}/{data.total}</span>
                    <span className="ml-1.5 text-xs text-slate-400">occupied</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {cards.map(({ key, label, icon: Icon, tone }) => (
                    <article key={key} className="surface-card p-4 sm:p-5">
                        <div className={`mb-4 grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>
                            <Icon className="h-[18px] w-[18px]" />
                        </div>
                        <div className="font-mono text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                            {availability ? data[key] : '—'}
                        </div>
                        <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
                    </article>
                ))}
            </div>

            <div className="surface-card mt-3 px-5 py-4">
                <div className="mb-3 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Workshop capacity</span>
                    <span className="font-mono text-slate-400">{data.available} seats left</span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <div className="bg-sky-500 transition-[width] duration-500" style={{ width: `${confirmedWidth}%` }} />
                    <div className="bg-amber-400 transition-[width] duration-500" style={{ width: `${heldWidth}%` }} />
                </div>
                <div className="mt-3 flex gap-5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-sky-500" /> Confirmed</span>
                    <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-400" /> On hold</span>
                </div>
            </div>
        </section>
    );
}

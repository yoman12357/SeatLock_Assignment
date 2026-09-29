import { SeatIcon } from './Icons';

export default function Brand({ compact = false }) {
    return (
        <div className="flex items-center gap-3">
            <div className={`${compact ? 'h-9 w-9 rounded-xl' : 'h-12 w-12 rounded-2xl'} grid place-items-center bg-amber-400 text-slate-950 shadow-[0_10px_30px_rgba(245,158,11,0.22)]`}>
                <SeatIcon className={compact ? 'h-5 w-5' : 'h-7 w-7'} />
            </div>
            <div>
                <div className={`${compact ? 'text-base' : 'text-xl'} font-bold tracking-tight text-slate-950 dark:text-white`}>SeatLock</div>
                {!compact && <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Campus workshops</div>}
            </div>
        </div>
    );
}

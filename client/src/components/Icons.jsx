function Icon({ children, className = 'h-5 w-5', viewBox = '0 0 24 24' }) {
    return (
        <svg className={className} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {children}
        </svg>
    );
}

export function SeatIcon({ className }) {
    return <Icon className={className}><path d="M6 11V7a3 3 0 0 1 6 0v4"/><path d="M12 11V7a3 3 0 0 1 6 0v4"/><path d="M4 11h16v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z"/><path d="M7 18v2M17 18v2"/></Icon>;
}
export function SunIcon({ className }) {
    return <Icon className={className}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></Icon>;
}
export function MoonIcon({ className }) {
    return <Icon className={className}><path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z"/></Icon>;
}
export function LogoutIcon({ className }) {
    return <Icon className={className}><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></Icon>;
}
export function TicketIcon({ className }) {
    return <Icon className={className}><path d="M3 7a2 2 0 0 0 2-2h14v4a3 3 0 0 0 0 6v4H5a2 2 0 0 0-2-2V7Z"/><path d="M13 5v2M13 10v4M13 17v2"/></Icon>;
}
export function ClockIcon({ className }) {
    return <Icon className={className}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
}
export function CheckIcon({ className }) {
    return <Icon className={className}><path d="m5 12 4 4L19 6"/></Icon>;
}
export function UsersIcon({ className }) {
    return <Icon className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Icon>;
}
export function ArrowIcon({ className }) {
    return <Icon className={className}><path d="M5 12h14M13 6l6 6-6 6"/></Icon>;
}
export function SparkIcon({ className }) {
    return <Icon className={className}><path d="m12 3-1.2 3.8A6 6 0 0 1 7 10.6L3 12l4 1.4a6 6 0 0 1 3.8 3.8L12 21l1.2-3.8a6 6 0 0 1 3.8-3.8l4-1.4-4-1.4a6 6 0 0 1-3.8-3.8L12 3Z"/></Icon>;
}

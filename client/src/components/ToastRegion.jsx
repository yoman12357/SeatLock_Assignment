export default function ToastRegion({ toasts, onDismiss }) {
    return (
        <div className="fixed bottom-5 right-5 z-50 flex w-[calc(100%-2.5rem)] max-w-sm flex-col gap-2" aria-live="polite">
            {toasts.map(toast => (
                <button
                    key={toast.id}
                    onClick={() => onDismiss(toast.id)}
                    className={`animate-toast-in rounded-2xl border px-4 py-3 text-left text-sm font-medium shadow-xl backdrop-blur-xl ${
                        toast.type === 'error'
                            ? 'border-rose-200 bg-rose-50/95 text-rose-800 dark:border-rose-400/20 dark:bg-rose-950/90 dark:text-rose-200'
                            : 'border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-950/90 dark:text-emerald-200'
                    }`}
                    type="button"
                >
                    {toast.message}
                </button>
            ))}
        </div>
    );
}

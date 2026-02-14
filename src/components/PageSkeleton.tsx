"use client";

interface PageSkeletonProps {
    variant?: "default" | "grid" | "detail";
}

export function PageSkeleton({ variant = "default" }: PageSkeletonProps) {
    if (variant === "grid") {
        return (
            <div className="min-h-screen bg-slate-900 pt-24 pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="animate-pulse">
                        <div className="h-10 bg-slate-800/50 rounded w-1/3 mb-2" />
                        <div className="h-5 bg-slate-800/50 rounded w-1/2 mb-8" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="bg-slate-800/50 rounded-xl overflow-hidden border border-white/10">
                                    <div className="h-48 bg-slate-700/50" />
                                    <div className="p-5 space-y-3">
                                        <div className="h-6 bg-slate-700/50 rounded w-3/4" />
                                        <div className="h-4 bg-slate-700/50 rounded w-1/2" />
                                        <div className="h-4 bg-slate-700/50 rounded w-2/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (variant === "detail") {
        return (
            <div className="min-h-screen bg-slate-900 pt-24 pb-12">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="animate-pulse">
                        <div className="h-64 bg-slate-800/50 rounded-xl mb-8" />
                        <div className="h-10 bg-slate-800/50 rounded w-2/3 mb-4" />
                        <div className="h-6 bg-slate-800/50 rounded w-1/3 mb-8" />
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="h-24 bg-slate-800/50 rounded-lg" />
                            <div className="h-24 bg-slate-800/50 rounded-lg" />
                        </div>
                        <div className="h-48 bg-slate-800/50 rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="animate-pulse">
                    <div className="h-10 bg-slate-800/50 rounded w-1/3 mb-2" />
                    <div className="h-5 bg-slate-800/50 rounded w-1/2 mb-8" />
                    <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-20 bg-slate-800/50 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

export function EventCardSkeleton() {
    return (
        <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-white/10 animate-pulse">
            {/* Image Skeleton */}
            <div className="h-48 bg-slate-700/50" />

            {/* Content Skeleton */}
            <div className="p-5">
                {/* Title */}
                <div className="h-6 bg-slate-700/50 rounded w-3/4 mb-4" />

                {/* Date */}
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 bg-slate-700/50 rounded" />
                    <div className="h-4 bg-slate-700/50 rounded w-1/2" />
                </div>

                {/* Venue */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-4 h-4 bg-slate-700/50 rounded" />
                    <div className="h-4 bg-slate-700/50 rounded w-2/3" />
                </div>

                {/* Price and Availability */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div>
                        <div className="h-3 bg-slate-700/50 rounded w-12 mb-1" />
                        <div className="h-6 bg-slate-700/50 rounded w-20" />
                    </div>
                    <div className="text-right">
                        <div className="h-3 bg-slate-700/50 rounded w-16 mb-1 ml-auto" />
                        <div className="h-6 bg-slate-700/50 rounded w-16" />
                    </div>
                </div>
            </div>
        </div>
    );
}

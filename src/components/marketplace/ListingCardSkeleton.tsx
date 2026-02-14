"use client";

export function ListingCardSkeleton() {
    return (
        <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-white/10 animate-pulse">
            {/* Image Skeleton */}
            <div className="h-32 bg-slate-700/50" />

            {/* Content Skeleton */}
            <div className="p-4">
                {/* Title */}
                <div className="h-6 bg-slate-700/50 rounded w-3/4 mb-4" />

                {/* Details */}
                <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-slate-700/50 rounded" />
                        <div className="h-4 bg-slate-700/50 rounded w-1/2" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-slate-700/50 rounded" />
                        <div className="h-4 bg-slate-700/50 rounded w-2/3" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-slate-700/50 rounded" />
                        <div className="h-4 bg-slate-700/50 rounded w-1/3" />
                    </div>
                </div>

                {/* Price */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <div>
                        <div className="h-3 bg-slate-700/50 rounded w-10 mb-1" />
                        <div className="h-7 bg-slate-700/50 rounded w-20" />
                    </div>
                    <div className="h-3 bg-slate-700/50 rounded w-16" />
                </div>

                {/* Button */}
                <div className="mt-4 h-10 bg-slate-700/50 rounded-lg" />
            </div>
        </div>
    );
}

"use client";

import Link from "next/link";

interface EmptyStateProps {
    title?: string;
    description?: string;
    showCreateButton?: boolean;
}

export function EmptyState({
    title = "No events found",
    description = "Be the first to create an event on the platform!",
    showCreateButton = true,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-24 h-24 mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
                <svg
                    className="w-12 h-12 text-purple-400/50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                    />
                </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
            <p className="text-gray-400 text-center max-w-md mb-6">{description}</p>
            {showCreateButton && (
                <Link
                    href="/events/create"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-full hover:from-purple-500 hover:to-pink-500 transition-all duration-300"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Event
                </Link>
            )}
        </div>
    );
}

"use client";

import Link from "next/link";

export function CTASection() {
    return (
        <section className="py-24 relative overflow-hidden">
            <div className="absolute inset-0 bg-slate-900" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(168,85,247,0.15),transparent)]" />

            <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6 leading-tight">
                    Ready to experience
                    <br />
                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        ticketing done right?
                    </span>
                </h2>
                <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
                    Join thousands of event-goers who never worry about fake tickets,
                    unfair prices, or lost confirmations.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="/events"
                        className="group inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/20"
                    >
                        Browse Events
                        <svg
                            className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </Link>
                    <Link
                        href="/events/create"
                        className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-2xl border border-white/15 hover:bg-white/5 transition-all duration-300"
                    >
                        Start Hosting
                    </Link>
                </div>
            </div>
        </section>
    );
}

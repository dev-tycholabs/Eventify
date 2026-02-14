"use client";

import Link from "next/link";

export function HeroSection() {
    return (
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent" />

            {/* Content */}
            <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight leading-tight">
                    The Future of
                    <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent pb-2">
                        Event Ticketing
                    </span>
                </h1>

                <p className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
                    Secure, transparent, and fraud-proof tickets powered by blockchain technology.
                    Buy, sell, and verify event tickets with confidence.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="/events"
                        className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-full hover:from-purple-500 hover:to-pink-500 transition-all duration-300 shadow-lg hover:shadow-purple-500/25 hover:scale-105"
                    >
                        Explore Events
                    </Link>
                    <Link
                        href="/events/create"
                        className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/30 rounded-full hover:bg-white/10 transition-all duration-300"
                    >
                        Create Event
                    </Link>
                </div>

                <p className="mt-8 text-gray-400 text-sm">
                    Built by{" "}
                    <a
                        href="https://tycholabs.xyz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 font-medium hover:text-purple-300 transition-colors"
                    >
                        Tycho Labs
                    </a>
                </p>
            </div>

            {/* Decorative Elements */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900 to-transparent" />
        </section>
    );
}

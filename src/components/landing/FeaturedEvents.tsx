"use client";

import Link from "next/link";

const mockEvents = [
    {
        id: 1,
        title: "Neon Nights Music Festival",
        date: "Mar 15, 2026",
        location: "Los Angeles, CA",
        price: "0.05 ETH",
        image: "🎵",
        gradient: "from-purple-600 to-indigo-600",
        ticketsLeft: 142,
    },
    {
        id: 2,
        title: "Web3 Builder Summit",
        date: "Apr 2, 2026",
        location: "Berlin, Germany",
        price: "0.02 ETH",
        image: "🚀",
        gradient: "from-pink-600 to-rose-600",
        ticketsLeft: 89,
    },
    {
        id: 3,
        title: "Digital Art Exhibition",
        date: "Mar 28, 2026",
        location: "Tokyo, Japan",
        price: "0.03 ETH",
        image: "🎨",
        gradient: "from-cyan-600 to-blue-600",
        ticketsLeft: 56,
    },
    {
        id: 4,
        title: "Indie Game Showcase",
        date: "Apr 10, 2026",
        location: "Austin, TX",
        price: "0.01 ETH",
        image: "🎮",
        gradient: "from-emerald-600 to-teal-600",
        ticketsLeft: 203,
    },
];

export function FeaturedEvents() {
    return (
        <section className="py-20 bg-slate-900">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-end justify-between mb-12">
                    <div>
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                            Trending Now
                        </h2>
                        <p className="text-gray-400">
                            Events people are grabbing tickets for right now.
                        </p>
                    </div>
                    <Link
                        href="/events"
                        className="hidden sm:inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
                    >
                        View all
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {mockEvents.map((event) => (
                        <Link
                            key={event.id}
                            href="/events"
                            className="group relative bg-slate-800/40 rounded-2xl border border-white/5 overflow-hidden hover:border-purple-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/5 hover:-translate-y-1"
                        >
                            {/* Event image placeholder */}
                            <div
                                className={`h-40 bg-gradient-to-br ${event.gradient} flex items-center justify-center text-5xl`}
                            >
                                {event.image}
                            </div>

                            <div className="p-5">
                                <h3 className="font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors line-clamp-1">
                                    {event.title}
                                </h3>

                                <div className="space-y-1.5 mb-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {event.date}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                        </svg>
                                        {event.location}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                    <span className="text-sm font-medium text-white">
                                        {event.price}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {event.ticketsLeft} left
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Mobile view all link */}
                <div className="mt-8 text-center sm:hidden">
                    <Link
                        href="/events"
                        className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
                    >
                        View all events
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            </div>
        </section>
    );
}

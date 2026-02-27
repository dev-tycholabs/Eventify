"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SupportedChains } from "./SupportedChains";

const headlines = [
    "Concerts",
    "Festivals",
    "Conferences",
    "Comedy",
    "Meetups",
    "Parties",
    "Hackathons",
    "Exhibitions",
];

export function HeroSection() {
    const [currentWord, setCurrentWord] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentWord((prev) => (prev + 1) % headlines.length);
                setIsAnimating(false);
            }, 400);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-slate-950" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(168,85,247,0.3),transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(236,72,153,0.15),transparent)]" />

            {/* Floating orbs */}
            <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-float" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-float-delayed" />

            {/* Subtle grid overlay */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                    backgroundSize: "60px 60px",
                }}
            />

            {/* Content */}
            <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-gray-300">
                        Live on 7 networks — 10,000+ tickets secured
                    </span>
                </div>

                {/* Main headline — experience first, not tech */}
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6 tracking-tight leading-[1.1]">
                    Unforgettable
                    <br />
                    <span className="relative inline-block min-w-[280px] sm:min-w-[360px]">
                        <span
                            className={`inline-block bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent transition-all duration-400 ${isAnimating
                                ? "opacity-0 translate-y-4 blur-sm"
                                : "opacity-100 translate-y-0 blur-0"
                                }`}
                        >
                            {headlines[currentWord]}
                        </span>
                    </span>
                    <br />
                    <span className="text-gray-400 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium">
                        start here.
                    </span>
                </h1>

                <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                    Discover events, grab your tickets, and walk right in.
                    <br className="hidden sm:block" />
                    No fakes. No scalpers. Just real experiences.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="/events"
                        className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/20"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 transition-opacity duration-300" />
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <span className="relative flex items-center gap-2">
                            Explore Events
                            <svg
                                className="w-5 h-5 transition-transform group-hover:translate-x-1"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                                />
                            </svg>
                        </span>
                    </Link>
                    <Link
                        href="/events/create"
                        className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-2xl border border-white/15 hover:bg-white/5 backdrop-blur-sm transition-all duration-300"
                    >
                        Host an Event
                    </Link>
                </div>

                {/* Supported chains — subtle, not the focus */}
                <SupportedChains />

                <p className="mt-6 text-gray-500 text-xs">
                    Built by{" "}
                    <a
                        href="https://tycholabs.xyz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400/70 hover:text-purple-300 transition-colors"
                    >
                        Tycho Labs
                    </a>
                </p>
            </div>

            {/* Bottom fade */}
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-slate-900 to-transparent" />
        </section>
    );
}

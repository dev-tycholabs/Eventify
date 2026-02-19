"use client";

import { useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import type { OrganizerEventFromDB } from "@/hooks/useOrganizerEventsFromDB";
import { useEventResales } from "@/hooks/useEventResales";
import { getNativeCurrencySymbol, SUPPORTED_CHAINS } from "@/config/chains";

interface EventManageCardProps {
    event: OrganizerEventFromDB;
    onManage?: () => void;
    onWithdraw: () => void;
}

export function EventManageCard({ event, onManage, onWithdraw }: EventManageCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const { resaleData } = useEventResales(event.id);
    const currencySymbol = getNativeCurrencySymbol(event.chainId);
    const chainName = SUPPORTED_CHAINS.find(c => c.id === event.chainId)?.name;
    const now = new Date();
    const isToday = event.date.toDateString() === now.toDateString();
    const isPast = !isToday && event.date < now;
    const ticketsRemaining = event.maxSupply - event.soldCount;
    const isSoldOut = ticketsRemaining <= 0;
    const isLowStock = ticketsRemaining > 0 && ticketsRemaining <= 10;
    const soldPercentage = (event.soldCount / event.maxSupply) * 100;
    const hasBalance = event.contractBalance > BigInt(0);

    const formattedDate = event.date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    return (
        <div className="relative h-full">
            {/* Flip Container */}
            <div
                className="relative w-full h-full transition-transform duration-500 ease-in-out"
                style={{
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
            >
                {/* Front Side */}
                <div
                    className="bg-slate-800/50 rounded-xl border border-white/10 overflow-hidden hover:border-purple-500/30 transition-colors"
                    style={{ backfaceVisibility: "hidden" }}
                >
                    {/* Event Image */}
                    <div
                        className="relative h-48 bg-gradient-to-br from-purple-600/20 to-pink-600/20 cursor-pointer"
                        onMouseEnter={() => setIsFlipped(true)}
                        onMouseLeave={() => setIsFlipped(false)}
                    >
                        {event.imageUrl ? (
                            <img
                                src={event.imageUrl}
                                alt={event.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <svg
                                    className="w-16 h-16 text-purple-400/50"
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
                        )}

                        {/* Badges - top left (status + chain) */}
                        <div className="absolute top-3 left-3 flex flex-col gap-2">
                            {isSoldOut ? (
                                <span className="px-2 py-1 bg-red-500/80 text-white text-xs font-semibold rounded">
                                    Sold Out
                                </span>
                            ) : isLowStock ? (
                                <span className="px-2 py-1 bg-orange-500/80 text-white text-xs font-semibold rounded">
                                    {ticketsRemaining} Left
                                </span>
                            ) : isToday ? (
                                <span className="px-2 py-1 bg-pink-500/80 text-white text-xs font-semibold rounded animate-pulse">
                                    Live
                                </span>
                            ) : isPast ? (
                                <span className="px-2 py-1 bg-gray-500/80 text-white text-xs font-semibold rounded">
                                    Past
                                </span>
                            ) : (
                                <span className="px-2 py-1 bg-green-500/80 text-white text-xs font-semibold rounded">
                                    Upcoming
                                </span>
                            )}
                            {chainName && (
                                <span className="px-2 py-1 bg-purple-600/80 text-white text-xs font-semibold rounded">
                                    {chainName}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Header with event details */}
                    <div className="p-5 border-b border-white/10">
                        <h3 className="text-lg font-semibold text-white truncate mb-1">{event.name}</h3>
                        <p className="text-sm text-gray-400 mb-3">{event.venue}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {formattedDate}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-5 flex gap-3">
                        <Link
                            href={`/events/my-events/${event.id}`}
                            className="flex-1 px-4 py-2.5 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors text-center"
                        >
                            Manage
                        </Link>
                        <button
                            onClick={onWithdraw}
                            disabled={!hasBalance}
                            className={`flex-1 px-4 py-2.5 font-medium rounded-lg transition-colors cursor-pointer ${hasBalance
                                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500"
                                : "bg-slate-700/50 text-gray-500 cursor-not-allowed"
                                }`}
                        >
                            Withdraw
                        </button>
                    </div>
                </div>

                {/* Back Side */}
                <div
                    className="absolute inset-0 bg-slate-800/50 rounded-xl border border-white/10 p-5 flex flex-col justify-center"
                    style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                    }}
                >
                    <div className="space-y-4">
                        {/* Ticket Sales Pie Chart */}
                        <div className="flex flex-col items-center">
                            <div className="relative w-24 h-24 mb-3">
                                <svg className="w-full h-full" viewBox="0 0 100 100">
                                    {/* Background circle */}
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
                                    {/* Sold segment */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="45"
                                        fill="none"
                                        stroke="url(#gradientPurplePink)"
                                        strokeWidth="8"
                                        strokeDasharray={`${(soldPercentage / 100) * 282.7} 282.7`}
                                        strokeDashoffset="0"
                                        strokeLinecap="round"
                                        transform="rotate(-90 50 50)"
                                    />
                                    <defs>
                                        <linearGradient id="gradientPurplePink" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#a855f7" />
                                            <stop offset="100%" stopColor="#ec4899" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                {/* Center text */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-lg font-bold text-white">{Math.round(soldPercentage)}%</span>
                                    <span className="text-xs text-gray-400">Sold</span>
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-400 mb-1">Tickets Sold</p>
                                <p className="text-white font-semibold">
                                    {event.soldCount} / {event.maxSupply}
                                </p>
                            </div>
                        </div>

                        {/* Revenue Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Ticket Price</p>
                                <p className="text-white font-semibold">{formatEther(event.ticketPrice)} {currencySymbol}</p>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Available</p>
                                <p className={`font-semibold ${hasBalance ? "text-green-400" : "text-gray-400"}`}>
                                    {formatEther(event.contractBalance)} {currencySymbol}
                                </p>
                            </div>
                        </div>

                        {/* Resale Info */}
                        {resaleData && resaleData.totalResales > 0 && (
                            <div className="border-t border-white/10 pt-3">
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Resales</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Resale Status Pie Chart */}
                                    <div className="flex flex-col items-center">
                                        <div className="relative w-16 h-16 mb-2">
                                            <svg className="w-full h-full" viewBox="0 0 100 100">
                                                {/* Background circle */}
                                                <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="6" />
                                                {/* Sold segment */}
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    r="40"
                                                    fill="none"
                                                    stroke="url(#gradientGreen)"
                                                    strokeWidth="6"
                                                    strokeDasharray={`${(resaleData.soldResales / resaleData.totalResales) * 251.3} 251.3`}
                                                    strokeDashoffset="0"
                                                    strokeLinecap="round"
                                                    transform="rotate(-90 50 50)"
                                                />
                                                <defs>
                                                    <linearGradient id="gradientGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stopColor="#10b981" />
                                                        <stop offset="100%" stopColor="#059669" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                            {/* Center text */}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-sm font-bold text-white">{Math.round((resaleData.soldResales / resaleData.totalResales) * 100)}%</span>
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400">Resale Status</p>
                                            <p className="text-xs text-white font-semibold">
                                                {resaleData.soldResales}/{resaleData.totalResales}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Volume Indicator */}
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400 mb-1">Resale Volume</p>
                                            <p className="text-white font-semibold text-sm">
                                                {formatEther(resaleData.totalResaleVolume)}
                                            </p>
                                            <p className="text-xs text-gray-500">{currencySymbol}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

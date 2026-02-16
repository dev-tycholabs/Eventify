"use client";

import Link from "next/link";
import { formatEther } from "viem";
import type { OrganizerEventFromDB } from "@/hooks/useOrganizerEventsFromDB";
import { getNativeCurrencySymbol, getExplorerUrl } from "@/config/chains";

interface EventManageCardProps {
    event: OrganizerEventFromDB;
    onManage?: () => void;
    onWithdraw: () => void;
}

export function EventManageCard({ event, onManage, onWithdraw }: EventManageCardProps) {
    const explorerUrl = getExplorerUrl(event.chainId);
    const currencySymbol = getNativeCurrencySymbol(event.chainId);
    const isPast = event.date < new Date();
    const soldPercentage = (event.soldCount / event.maxSupply) * 100;
    const hasBalance = event.contractBalance > BigInt(0);

    const formattedDate = event.date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    return (
        <div className="bg-slate-800/50 rounded-xl border border-white/10 overflow-hidden hover:border-purple-500/30 transition-colors">
            {/* Header with status */}
            <div className="p-5 border-b border-white/10">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-white truncate">{event.name}</h3>
                        <p className="text-sm text-gray-400 mt-1">{event.venue}</p>
                    </div>
                    <span
                        className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${isPast
                            ? "bg-gray-500/20 text-gray-400"
                            : "bg-green-500/20 text-green-400"
                            }`}
                    >
                        {isPast ? "Past" : "Active"}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-3 text-sm text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formattedDate}
                </div>
            </div>

            {/* Stats */}
            <div className="p-5 space-y-4">
                {/* Ticket Sales Progress */}
                <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-400">Tickets Sold</span>
                        <span className="text-white font-medium">
                            {event.soldCount} / {event.maxSupply}
                        </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                            style={{ width: `${soldPercentage}%` }}
                        />
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

                {/* Actions */}
                <div className="flex gap-3 pt-2">
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

            {/* Contract Address */}
            <div className="px-5 py-3 bg-slate-900/30 border-t border-white/5">
                <a
                    href={`${explorerUrl}/address/${event.contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-purple-400 font-mono transition-colors"
                >
                    {event.contractAddress.slice(0, 10)}...{event.contractAddress.slice(-8)}
                </a>
            </div>
        </div>
    );
}

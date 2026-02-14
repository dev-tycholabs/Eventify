"use client";

import { useState, useEffect, useCallback } from "react";

interface AttendeeTicket {
    tokenId: string;
    isUsed: boolean;
    isListed: boolean;
    purchasedAt: string | null;
}

interface Attendee {
    ownerAddress: string;
    username: string | null;
    name: string | null;
    avatarUrl: string | null;
    tickets: AttendeeTicket[];
}

interface EventAttendeesPanelProps {
    eventId: string;
}

export function EventAttendeesPanel({ eventId }: EventAttendeesPanelProps) {
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [totalTickets, setTotalTickets] = useState(0);
    const [totalAttendees, setTotalAttendees] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedAddress, setExpandedAddress] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchAttendees = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/events/${eventId}/attendees`);
            if (!res.ok) throw new Error("Failed to fetch attendees");
            const data = await res.json();
            setAttendees(data.attendees || []);
            setTotalTickets(data.totalTickets || 0);
            setTotalAttendees(data.totalAttendees || 0);
        } catch (err) {
            console.error("Failed to fetch attendees:", err);
            setError("Failed to load attendees");
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchAttendees();
    }, [fetchAttendees]);

    const truncateAddress = (address: string) =>
        `${address.slice(0, 6)}...${address.slice(-4)}`;

    const filtered = attendees.filter((a) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            a.ownerAddress.toLowerCase().includes(q) ||
            a.username?.toLowerCase().includes(q) ||
            a.name?.toLowerCase().includes(q)
        );
    });

    const checkedInCount = attendees.reduce(
        (sum, a) => sum + a.tickets.filter((t) => t.isUsed).length,
        0
    );

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-24 bg-slate-800/50 rounded-xl border border-white/10 animate-pulse" />
                    ))}
                </div>
                <div className="h-12 bg-slate-800/50 rounded-xl animate-pulse" />
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 bg-slate-800/50 rounded-xl border border-white/10 animate-pulse" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <p className="text-gray-400 mb-4">{error}</p>
                <button onClick={fetchAttendees} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors cursor-pointer">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Total Attendees</p>
                    <p className="text-2xl font-bold text-white">{totalAttendees}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Total Tickets Held</p>
                    <p className="text-2xl font-bold text-purple-400">{totalTickets}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Checked In</p>
                    <p className="text-2xl font-bold text-green-400">
                        {checkedInCount} <span className="text-sm font-normal text-gray-500">/ {totalTickets}</span>
                    </p>
                </div>
            </div>

            {/* Search */}
            {attendees.length > 0 && (
                <div className="relative">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by address or username..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                    />
                </div>
            )}

            {/* Attendee List */}
            {attendees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">No Attendees Yet</h3>
                    <p className="text-gray-400 text-sm">No tickets have been purchased for this event.</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-gray-400">No attendees match your search.</p>
                </div>
            ) : (
                <div className="bg-slate-800/50 rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5">
                    {filtered.map((attendee) => {
                        const isExpanded = expandedAddress === attendee.ownerAddress;
                        const usedCount = attendee.tickets.filter((t) => t.isUsed).length;
                        const listedCount = attendee.tickets.filter((t) => t.isListed).length;

                        return (
                            <div key={attendee.ownerAddress}>
                                <button
                                    onClick={() => setExpandedAddress(isExpanded ? null : attendee.ownerAddress)}
                                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-700/30 transition-colors cursor-pointer"
                                >
                                    {/* Avatar */}
                                    <div className="flex-shrink-0">
                                        {attendee.avatarUrl ? (
                                            <img src={attendee.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                                                <span className="text-sm font-medium text-purple-300">
                                                    {(attendee.username || attendee.ownerAddress.slice(2, 4)).slice(0, 2).toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center gap-2">
                                            {attendee.username ? (
                                                <p className="text-sm font-medium text-white truncate">@{attendee.username}</p>
                                            ) : (
                                                <p className="text-sm font-medium text-white font-mono">{truncateAddress(attendee.ownerAddress)}</p>
                                            )}
                                            {attendee.name && (
                                                <span className="text-xs text-gray-500 truncate hidden sm:inline">{attendee.name}</span>
                                            )}
                                        </div>
                                        {attendee.username && (
                                            <p className="text-xs text-gray-500 font-mono">{truncateAddress(attendee.ownerAddress)}</p>
                                        )}
                                    </div>

                                    {/* Badges */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400">
                                            {attendee.tickets.length} ticket{attendee.tickets.length !== 1 ? "s" : ""}
                                        </span>
                                        {usedCount > 0 && (
                                            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400">
                                                {usedCount} used
                                            </span>
                                        )}
                                        {listedCount > 0 && (
                                            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-yellow-500/20 text-yellow-400">
                                                {listedCount} listed
                                            </span>
                                        )}
                                    </div>

                                    {/* Expand arrow */}
                                    <svg
                                        className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* Expanded ticket details */}
                                {isExpanded && (
                                    <div className="px-5 pb-4 pt-1">
                                        <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Ticket Details</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {attendee.tickets.map((ticket) => (
                                                    <div
                                                        key={ticket.tokenId}
                                                        className={`flex items-center justify-between p-3 rounded-lg border ${ticket.isUsed
                                                                ? "bg-green-500/5 border-green-500/20"
                                                                : ticket.isListed
                                                                    ? "bg-yellow-500/5 border-yellow-500/20"
                                                                    : "bg-slate-800/50 border-white/10"
                                                            }`}
                                                    >
                                                        <span className="text-sm text-white font-mono">#{ticket.tokenId}</span>
                                                        <div className="flex items-center gap-2">
                                                            {ticket.isUsed && (
                                                                <span className="flex items-center gap-1 text-xs text-green-400">
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                    Used
                                                                </span>
                                                            )}
                                                            {ticket.isListed && !ticket.isUsed && (
                                                                <span className="flex items-center gap-1 text-xs text-yellow-400">
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                                                                    </svg>
                                                                    Listed
                                                                </span>
                                                            )}
                                                            {!ticket.isUsed && !ticket.isListed && (
                                                                <span className="text-xs text-gray-500">Held</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

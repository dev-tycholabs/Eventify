"use client";

import { useState, useEffect } from "react";
import { formatEther } from "viem";
import type { OrganizerEventFromDB } from "@/hooks/useOrganizerEventsFromDB";

interface EventManageModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: OrganizerEventFromDB | null;
    onUpdateURI: (contractAddress: `0x${string}`, newURI: string) => Promise<boolean>;
    onRefresh: () => Promise<void>;
}

export function EventManageModal({ isOpen, onClose, event, onUpdateURI, onRefresh }: EventManageModalProps) {
    const [activeTab, setActiveTab] = useState<"details" | "settings">("details");
    const [newBaseURI, setNewBaseURI] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        // Reset the URI input when modal opens
        if (event) {
            setNewBaseURI("");
        }
    }, [event]);

    if (!isOpen || !event) return null;

    const isPast = event.date < new Date();
    const soldPercentage = (event.soldCount / event.maxSupply) * 100;

    const handleUpdateURI = async () => {
        if (!newBaseURI.trim()) return;

        setIsUpdating(true);
        const success = await onUpdateURI(event.contractAddress, newBaseURI);
        if (success) {
            await onRefresh();
            setNewBaseURI("");
        }
        setIsUpdating(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-slate-900 rounded-2xl border border-white/10 shadow-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div>
                        <h2 className="text-xl font-bold text-white">{event.name}</h2>
                        <p className="text-sm text-gray-400 mt-1">{event.venue}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    <button
                        onClick={() => setActiveTab("details")}
                        className={`flex-1 px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "details" ? "text-white" : "text-gray-400 hover:text-white"
                            }`}
                    >
                        Event Details
                        {activeTab === "details" && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("settings")}
                        className={`flex-1 px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "settings" ? "text-white" : "text-gray-400 hover:text-white"
                            }`}
                    >
                        Settings
                        {activeTab === "settings" && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {activeTab === "details" && (
                        <div className="space-y-6">
                            {/* Status Badge */}
                            <div className="flex items-center gap-3">
                                <span
                                    className={`px-3 py-1 text-sm font-medium rounded-full ${isPast
                                        ? "bg-gray-500/20 text-gray-400"
                                        : "bg-green-500/20 text-green-400"
                                        }`}
                                >
                                    {isPast ? "Event Ended" : "Active Event"}
                                </span>
                                <span className="text-sm text-gray-400">
                                    {event.date.toLocaleDateString("en-US", {
                                        weekday: "long",
                                        month: "long",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                    })}
                                </span>
                            </div>

                            {/* Sales Progress */}
                            <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                                <h3 className="text-sm font-medium text-gray-400 mb-4">Ticket Sales</h3>
                                <div className="flex items-end justify-between mb-3">
                                    <div>
                                        <p className="text-3xl font-bold text-white">{event.soldCount}</p>
                                        <p className="text-sm text-gray-400">tickets sold</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-semibold text-gray-400">{event.remainingTickets}</p>
                                        <p className="text-sm text-gray-500">remaining</p>
                                    </div>
                                </div>
                                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                                        style={{ width: `${soldPercentage}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2 text-right">
                                    {soldPercentage.toFixed(1)}% sold
                                </p>
                            </div>

                            {/* Financial Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Ticket Price</p>
                                    <p className="text-2xl font-bold text-white">{formatEther(event.ticketPrice)} XTZ</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Total Revenue</p>
                                    <p className="text-2xl font-bold text-green-400">
                                        {formatEther(event.ticketPrice * BigInt(event.soldCount))} XTZ
                                    </p>
                                </div>
                            </div>

                            {/* Contract Info */}
                            <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                                <h3 className="text-sm font-medium text-gray-400 mb-3">Contract Information</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">Contract Address</span>
                                        <a
                                            href={`https://shadownet.explorer.etherlink.com/address/${event.contractAddress}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-purple-400 hover:text-purple-300 font-mono"
                                        >
                                            {event.contractAddress.slice(0, 10)}...{event.contractAddress.slice(-8)}
                                        </a>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">Contract Balance</span>
                                        <span className="text-sm text-white font-medium">
                                            {formatEther(event.contractBalance)} XTZ
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">Max Supply</span>
                                        <span className="text-sm text-white font-medium">{event.maxSupply} tickets</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "settings" && (
                        <div className="space-y-6">
                            {/* Metadata URI */}
                            <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                                <h3 className="text-sm font-medium text-white mb-2">Metadata Base URI</h3>
                                <p className="text-xs text-gray-500 mb-4">
                                    Update the base URI for ticket metadata (e.g., IPFS gateway URL)
                                </p>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={newBaseURI}
                                        onChange={(e) => setNewBaseURI(e.target.value)}
                                        placeholder="ipfs://... or https://..."
                                        className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono text-sm"
                                    />
                                    <button
                                        onClick={handleUpdateURI}
                                        disabled={isUpdating || !newBaseURI.trim()}
                                        className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                                    >
                                        {isUpdating ? "Updating..." : "Update Metadata URI"}
                                    </button>
                                </div>
                            </div>

                            {/* Info about immutable fields */}
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
                                <div className="flex gap-3">
                                    <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <h4 className="text-sm font-medium text-amber-400 mb-1">Immutable Event Data</h4>
                                        <p className="text-xs text-amber-400/70">
                                            Event name, venue, date, ticket price, and supply cannot be changed after creation.
                                            This ensures ticket authenticity and prevents fraud.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Ticket Verification Link */}
                            <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                                <h3 className="text-sm font-medium text-white mb-2">Ticket Verification</h3>
                                <p className="text-xs text-gray-500 mb-4">
                                    Use the verification page to check and mark tickets as used at your event
                                </p>
                                <a
                                    href="/verify"
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Go to Verification
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

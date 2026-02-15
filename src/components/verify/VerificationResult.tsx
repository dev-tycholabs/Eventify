"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { EventTicketABI } from "@/hooks/contracts";
import type { VerificationData } from "@/app/verify/page";
import { useChainConfig } from "@/hooks/useChainConfig";

interface VerificationResultProps {
    result: VerificationData;
    onReset: () => void;
}

export function VerificationResult({ result, onReset }: VerificationResultProps) {
    const { isValid, holder, isUsed, eventName, eventVenue, eventDate, tokenId, eventAddress } = result;
    const { address, isConnected } = useAccount();
    const { explorerUrl } = useChainConfig();
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isMarkingUsed, setIsMarkingUsed] = useState(false);
    const [markAsUsedError, setMarkAsUsedError] = useState<string | null>(null);
    const [ticketMarkedUsed, setTicketMarkedUsed] = useState(isUsed);

    // Check if connected user is organizer or owner
    useEffect(() => {
        async function checkAuthorization() {
            if (!isConnected || !address || !publicClient) {
                setIsAuthorized(false);
                return;
            }

            setIsAuthorized(false);
            try {
                const [organizer, owner] = await Promise.all([
                    publicClient.readContract({
                        address: eventAddress,
                        abi: EventTicketABI,
                        functionName: "eventOrganizer",
                    }),
                    publicClient.readContract({
                        address: eventAddress,
                        abi: EventTicketABI,
                        functionName: "owner",
                    }),
                ]);

                const isOrganizerOrOwner =
                    address.toLowerCase() === (organizer as string).toLowerCase() ||
                    address.toLowerCase() === (owner as string).toLowerCase();

                setIsAuthorized(isOrganizerOrOwner);
            } catch (err) {
                console.error("Failed to check authorization:", err);
                setIsAuthorized(false);
            }
        }

        checkAuthorization();
    }, [isConnected, address, publicClient, eventAddress]);

    const syncTicketUsageToSupabase = async (txHash: string) => {
        try {
            // Update ticket status in Supabase
            await fetch("/api/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token_id: tokenId.toString(),
                    event_contract_address: eventAddress,
                    owner_address: holder,
                    action: "use",
                }),
            });

            // Record the transaction for history
            await fetch("/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tx_hash: txHash,
                    tx_type: "use",
                    user_address: address,
                    token_id: tokenId.toString(),
                    event_contract_address: eventAddress,
                    tx_timestamp: new Date().toISOString(),
                }),
            });
        } catch (syncError) {
            // Log but don't fail - blockchain is source of truth
            console.error("Failed to sync ticket usage to Supabase:", syncError);
        }
    };

    const handleMarkAsUsed = async () => {
        if (!walletClient || !publicClient) return;

        setIsMarkingUsed(true);
        setMarkAsUsedError(null);

        try {
            const hash = await walletClient.writeContract({
                address: eventAddress,
                abi: EventTicketABI,
                functionName: "markAsUsed",
                args: [tokenId],
            });

            // Wait for transaction confirmation
            await publicClient.waitForTransactionReceipt({ hash });

            // Sync to Supabase for ticket history
            await syncTicketUsageToSupabase(hash);

            setTicketMarkedUsed(true);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes("TicketAlreadyUsed")) {
                setMarkAsUsedError("This ticket has already been marked as used.");
                setTicketMarkedUsed(true);
            } else if (errorMessage.includes("OnlyOrganizerOrOwner")) {
                setMarkAsUsedError("Only the event organizer or owner can mark tickets as used.");
            } else if (errorMessage.includes("User rejected")) {
                setMarkAsUsedError("Transaction was cancelled.");
            } else {
                setMarkAsUsedError("Failed to mark ticket as used. Please try again.");
            }
            console.error("Mark as used error:", err);
        } finally {
            setIsMarkingUsed(false);
        }
    };

    // Determine the overall status
    // Note: Contract returns isValid=false when ticket is used, so check isUsed first
    const getStatus = () => {
        if (ticketMarkedUsed || isUsed) {
            return {
                type: "used" as const,
                title: "Ticket Already Used",
                message: "This ticket has already been used for event entry.",
                bgColor: "bg-yellow-500/10",
                borderColor: "border-yellow-500/30",
                iconBg: "bg-yellow-500/20",
                iconColor: "text-yellow-400",
            };
        }
        if (!isValid) {
            return {
                type: "invalid" as const,
                title: "Invalid Ticket",
                message: "This ticket does not exist or is not valid.",
                bgColor: "bg-red-500/10",
                borderColor: "border-red-500/30",
                iconBg: "bg-red-500/20",
                iconColor: "text-red-400",
            };
        }
        return {
            type: "valid" as const,
            title: "Valid Ticket",
            message: "This ticket is authentic and ready for use.",
            bgColor: "bg-green-500/10",
            borderColor: "border-green-500/30",
            iconBg: "bg-green-500/20",
            iconColor: "text-green-400",
        };
    };

    const status = getStatus();

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="space-y-6">
            {/* Status Card */}
            <div className={`${status.bgColor} border ${status.borderColor} rounded-2xl p-6 sm:p-8`}>
                <div className="flex flex-col items-center text-center">
                    {/* Status Icon */}
                    <div className={`w-20 h-20 rounded-full ${status.iconBg} flex items-center justify-center mb-4`}>
                        {status.type === "valid" && (
                            <svg
                                className={`w-10 h-10 ${status.iconColor}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        )}
                        {status.type === "used" && (
                            <svg
                                className={`w-10 h-10 ${status.iconColor}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        )}
                        {status.type === "invalid" && (
                            <svg
                                className={`w-10 h-10 ${status.iconColor}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        )}
                    </div>

                    {/* Status Title */}
                    <h2 className="text-2xl font-bold text-white mb-2">{status.title}</h2>
                    <p className="text-gray-400">{status.message}</p>
                </div>
            </div>

            {/* Ticket Details Card - Show for valid or used tickets */}
            {(isValid || isUsed) && (
                <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 sm:p-8">
                    <h3 className="text-lg font-semibold text-white mb-6">Ticket Details</h3>

                    <div className="space-y-4">
                        {/* Event Name */}
                        {eventName && (
                            <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5">
                                <span className="text-gray-400 text-sm">Event</span>
                                <span className="text-white font-medium text-right">{eventName}</span>
                            </div>
                        )}

                        {/* Event Venue */}
                        {eventVenue && (
                            <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5">
                                <span className="text-gray-400 text-sm">Venue</span>
                                <span className="text-white text-right">{eventVenue}</span>
                            </div>
                        )}

                        {/* Event Date */}
                        {eventDate && (
                            <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5">
                                <span className="text-gray-400 text-sm">Date</span>
                                <span className="text-white text-right">{formatDate(eventDate)}</span>
                            </div>
                        )}

                        {/* Token ID */}
                        <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5">
                            <span className="text-gray-400 text-sm">Token ID</span>
                            <span className="text-white font-mono">#{tokenId.toString()}</span>
                        </div>

                        {/* Ticket Holder */}
                        {holder && (
                            <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5">
                                <span className="text-gray-400 text-sm">Holder</span>
                                <span className="text-white font-mono text-sm">{truncateAddress(holder)}</span>
                            </div>
                        )}

                        {/* Event Contract */}
                        <div className="flex items-start justify-between gap-4 py-3">
                            <span className="text-gray-400 text-sm">Contract</span>
                            <a
                                href={`${explorerUrl}/address/${eventAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 font-mono text-sm flex items-center gap-1 transition-colors"
                            >
                                {truncateAddress(eventAddress)}
                                <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                    />
                                </svg>
                            </a>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-start justify-between gap-4 pt-3">
                            <span className="text-gray-400 text-sm">Status</span>
                            <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${ticketMarkedUsed
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : "bg-green-500/20 text-green-400"
                                    }`}
                            >
                                {ticketMarkedUsed ? "Used" : "Valid"}
                            </span>
                        </div>
                    </div>

                    {/* Mark as Used Section - Only for organizers/owners */}
                    {isAuthorized && !ticketMarkedUsed && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <div className="flex items-center gap-2 mb-3">
                                <svg
                                    className="w-5 h-5 text-purple-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                    />
                                </svg>
                                <span className="text-sm font-medium text-purple-400">Organizer Actions</span>
                            </div>

                            {markAsUsedError && (
                                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-3">
                                    <svg
                                        className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    <p className="text-sm text-red-400">{markAsUsedError}</p>
                                </div>
                            )}

                            <button
                                onClick={handleMarkAsUsed}
                                disabled={isMarkingUsed}
                                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isMarkingUsed ? (
                                    <>
                                        <svg
                                            className="animate-spin h-5 w-5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            />
                                        </svg>
                                        Marking as Used...
                                    </>
                                ) : (
                                    <>
                                        <svg
                                            className="w-5 h-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M5 13l4 4L19 7"
                                            />
                                        </svg>
                                        Mark Ticket as Used
                                    </>
                                )}
                            </button>
                            <p className="mt-2 text-xs text-gray-500 text-center">
                                This will mark the ticket as used for event entry
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
                <button
                    onClick={onReset}
                    className="flex-1 py-4 px-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                    <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                    Verify Another Ticket
                </button>
            </div>
        </div>
    );
}

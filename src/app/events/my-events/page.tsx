"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useSupabase } from "@/hooks/useSupabase";
import { useOrganizerEventsFromDB, type OrganizerEventFromDB } from "@/hooks/useOrganizerEventsFromDB";
import { EventManageCard, EventManageModal } from "@/components/events";
import { EventTicketABI } from "@/hooks/contracts";
import { txToast } from "@/utils/toast";
import { useChainConfig } from "@/hooks/useChainConfig";
import { ChainFilter } from "@/components/ui/ChainFilter";
import { Pagination, PageSizeSelector } from "@/components/ui/Pagination";
import type { Tables } from "@/lib/supabase/types";

type Event = Tables<"events">;
type ViewMode = "drafts" | "published";

export default function MyEventsPage() {
    const { address, isConnected } = useAccount();
    const { getEvents, deleteDraft } = useSupabase();
    const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(6);
    const {
        organizerEvents,
        isLoading: isLoadingOnChain,
        refetch: refetchOnChain,
        totalPages,
    } = useOrganizerEventsFromDB({ chainId: selectedChainId, page: currentPage, pageSize });
    const { writeContractAsync } = useWriteContract();
    const { currencySymbol } = useChainConfig();
    const publicClient = usePublicClient();

    const [draftEvents, setDraftEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>("published");
    const [draftCount, setDraftCount] = useState(0);
    const initialFetchDone = useRef(false);

    const [selectedEvent, setSelectedEvent] = useState<OrganizerEventFromDB | null>(null);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);

    const fetchDrafts = useCallback(async () => {
        if (!address) return;
        setIsLoading(true);
        try {
            const data = await getEvents({ organizer: address, status: "draft" });
            setDraftEvents(data);
            setDraftCount(data.length);
        } catch (err) {
            console.error("Failed to fetch drafts:", err);
        } finally {
            setIsLoading(false);
        }
    }, [address, getEvents]);

    useEffect(() => {
        if (isConnected && address && !initialFetchDone.current) {
            initialFetchDone.current = true;
            fetchDrafts();
        }
    }, [isConnected, address, fetchDrafts]);

    const handleDeleteDraft = async (eventId: string) => {
        if (confirm("Are you sure you want to delete this draft?")) {
            const success = await deleteDraft(eventId);
            if (success) {
                setDraftEvents(draftEvents.filter(e => e.id !== eventId));
                setDraftCount(prev => prev - 1);
            }
        }
    };

    const handleManageEvent = (event: OrganizerEventFromDB) => {
        setSelectedEvent(event);
        setIsManageModalOpen(true);
    };

    const handleWithdraw = async (event: OrganizerEventFromDB) => {
        try {
            txToast.pending("Withdrawing funds...");
            const hash = await writeContractAsync({
                address: event.contractAddress,
                abi: EventTicketABI,
                functionName: "withdrawFunds",
            });
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
            }
            txToast.success("Funds withdrawn successfully!");
            await refetchOnChain();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes("NoFundsToWithdraw")) {
                txToast.error("No funds available to withdraw");
            } else if (errorMessage.includes("User rejected") || errorMessage.includes("user rejected")) {
                txToast.error("Transaction was rejected");
            } else {
                txToast.error("Failed to withdraw funds");
            }
        }
    };

    const handleUpdateURI = async (contractAddress: `0x${string}`, newURI: string) => {
        try {
            txToast.pending("Updating metadata URI...");
            await writeContractAsync({
                address: contractAddress,
                abi: EventTicketABI,
                functionName: "setBaseURI",
                args: [newURI],
            });
            txToast.success("Metadata URI updated!");
            await refetchOnChain();
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes("User rejected") || errorMessage.includes("user rejected")) {
                txToast.error("Transaction was rejected");
            } else {
                txToast.error("Failed to update URI");
            }
            return false;
        }
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-slate-900 pt-24 pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                        <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mb-6">
                            <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-3">Connect Your Wallet</h1>
                        <p className="text-gray-400 max-w-md">Please connect your wallet to view and manage your events.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">My Events</h1>
                        <p className="text-gray-400">Manage your created events, drafts, and withdraw earnings</p>
                    </div>
                    <Link href="/events/create" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-full hover:from-purple-500 hover:to-pink-500 transition-all duration-300 whitespace-nowrap">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Event
                    </Link>
                </div>

                <div className="flex items-center justify-between mb-6 border-b border-white/10">
                    <div className="flex gap-2">
                        <button onClick={() => setViewMode("published")} className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${viewMode === "published" ? "text-white" : "text-gray-400 hover:text-white"}`}>
                            Published Events
                            {viewMode === "published" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />}
                        </button>
                        <button onClick={() => setViewMode("drafts")} className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer ${viewMode === "drafts" ? "text-white" : "text-gray-400 hover:text-white"}`}>
                            Drafts ({draftCount})
                            {viewMode === "drafts" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />}
                        </button>
                    </div>
                    <div className="flex items-center gap-3 pb-3">
                        <PageSizeSelector pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }} />
                        <ChainFilter value={selectedChainId} onChange={setSelectedChainId} />
                    </div>
                </div>

                {viewMode === "published" && (
                    <>
                        {isLoadingOnChain && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="bg-slate-800/50 rounded-xl overflow-hidden border border-white/10 animate-pulse">
                                        <div className="p-5 border-b border-white/10">
                                            <div className="h-6 bg-slate-700/50 rounded w-2/3 mb-3" />
                                            <div className="h-4 bg-slate-700/50 rounded w-1/2" />
                                        </div>
                                        <div className="p-5">
                                            <div className="h-4 bg-slate-700/50 rounded w-full mb-4" />
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div className="h-16 bg-slate-700/50 rounded" />
                                                <div className="h-16 bg-slate-700/50 rounded" />
                                            </div>
                                            <div className="h-10 bg-slate-700/50 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!isLoadingOnChain && organizerEvents.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6">
                                    <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">No Published Events</h3>
                                <p className="text-gray-400 max-w-md mb-6">You haven&apos;t published any events on-chain yet.</p>
                                <Link href="/events/create" className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all">Create Your First Event</Link>
                            </div>
                        )}

                        {!isLoadingOnChain && organizerEvents.length > 0 && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {organizerEvents.map((event) => (
                                        <EventManageCard key={event.contractAddress} event={event} onManage={() => handleManageEvent(event)} onWithdraw={() => handleWithdraw(event)} />
                                    ))}
                                </div>
                                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                            </>
                        )}
                    </>
                )}

                {viewMode === "drafts" && (
                    <>
                        {isLoading && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="bg-slate-800/50 rounded-xl overflow-hidden border border-white/10 animate-pulse">
                                        <div className="h-48 bg-slate-700/50" />
                                        <div className="p-5">
                                            <div className="h-6 bg-slate-700/50 rounded w-2/3 mb-3" />
                                            <div className="h-4 bg-slate-700/50 rounded w-1/2 mb-4" />
                                            <div className="h-10 bg-slate-700/50 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!isLoading && draftEvents.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6">
                                    <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">No Drafts</h3>
                                <p className="text-gray-400 max-w-md mb-6">You don&apos;t have any draft events.</p>
                                <Link href="/events/create" className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all">Create New Event</Link>
                            </div>
                        )}

                        {!isLoading && draftEvents.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {draftEvents.map((event) => (
                                    <DraftCard key={event.id} event={event} onDelete={handleDeleteDraft} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <EventManageModal isOpen={isManageModalOpen} onClose={() => { setIsManageModalOpen(false); setSelectedEvent(null); }} event={selectedEvent} onUpdateURI={handleUpdateURI} onRefresh={refetchOnChain} />
        </div>
    );
}

interface DraftCardProps {
    event: Event;
    onDelete: (id: string) => void;
}

function DraftCard({ event, onDelete }: DraftCardProps) {
    const eventDate = event.date ? new Date(event.date) : null;
    const { currencySymbol } = useChainConfig();

    return (
        <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-white/10 hover:border-yellow-500/30 transition-all group">
            <div className="relative h-48 bg-gradient-to-br from-purple-900/50 to-pink-900/50">
                {event.image_url ? (
                    <img src={event.image_url} alt={event.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-16 h-16 text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                )}
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Draft</div>
            </div>
            <div className="p-5">
                <h3 className="text-lg font-semibold text-white mb-2 truncate">{event.name}</h3>
                {eventDate && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                )}
                {event.venue && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{event.venue}</span>
                    </div>
                )}
                {event.ticket_price && (
                    <div className="flex items-center gap-2 text-purple-400 text-sm mb-4">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {event.ticket_price} {currencySymbol}
                    </div>
                )}
                <div className="flex gap-2">
                    <Link href={`/events/create?draft=${event.id}`} className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg text-center transition-colors">Continue Editing</Link>
                    <button onClick={() => onDelete(event.id)} className="py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors cursor-pointer" title="Delete Draft">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

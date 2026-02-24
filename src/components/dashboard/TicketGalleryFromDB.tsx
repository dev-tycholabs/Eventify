"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTicketsFromDB } from "@/hooks/useTicketsFromDB";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useChainConfig } from "@/hooks/useChainConfig";
import { syncListing, syncTicket, syncTransaction, findEventIdByContract } from "@/lib/api/sync";
import { TicketCard } from "./TicketCard";
import { ListTicketModal, TransferTicketModal } from "@/components/marketplace";
import { Pagination } from "@/components/ui/Pagination";

interface UserTicket {
    tokenId: bigint;
    eventContractAddress: `0x${string}`;
    eventName: string;
    eventDate: Date;
    venue: string;
    isUsed: boolean;
    isListed: boolean;
    ticketPrice: bigint;
    maxResalePrice?: bigint;
    eventId?: string;
    listingId?: string;
    listingPrice?: bigint;
    imageUrl?: string;
    chainId: number;
}

interface TicketGalleryFromDBProps {
    address: `0x${string}`;
    filter?: "all" | "unlisted" | "listed";
    chainId?: number | null;
    pageSize?: number;
}

export function TicketGalleryFromDB({ address, filter = "all", chainId, pageSize = 6 }: TicketGalleryFromDBProps) {
    const router = useRouter();
    const { chainId: walletChainId } = useChainConfig();
    const [listingTicket, setListingTicket] = useState<UserTicket | null>(null);
    const [transferTicket, setTransferTicket] = useState<UserTicket | null>(null);
    const [isListingLoading, setIsListingLoading] = useState(false);
    const [isTransferLoading, setIsTransferLoading] = useState(false);
    const [cancellingTicketId, setCancellingTicketId] = useState<string | null>(null);
    const [maxResalePrice, setMaxResalePrice] = useState<bigint | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);

    // Convert filter to isListed parameter for backend
    const isListedFilter = filter === "listed" ? true : filter === "unlisted" ? false : null;

    // Fetch tickets from database with filter
    const { tickets: dbTickets, isLoading, refetch: refetchTickets, totalPages } = useTicketsFromDB({
        owner: address,
        isListed: isListedFilter,
        chainId,
        page: currentPage,
        pageSize,
    });

    const { listTicket, cancelListing, transferTicket: transferTicketOnChain } = useMarketplace();

    // Transform DB tickets to UserTicket format
    const tickets: UserTicket[] = dbTickets.map((t) => ({
        tokenId: t.tokenId,
        eventContractAddress: t.eventContractAddress,
        eventName: t.eventName || "Unknown Event",
        eventDate: t.eventDate || new Date(),
        venue: t.eventVenue || "",
        isUsed: t.isUsed,
        isListed: t.isListed,
        ticketPrice: t.ticketPrice || t.purchasePrice || BigInt(0),
        maxResalePrice: t.maxResalePrice,
        eventId: t.eventId || undefined,
        listingId: t.listingId || undefined,
        listingPrice: t.listingPrice ?? undefined,
        imageUrl: t.eventImageUrl || undefined,
        chainId: t.chainId,
    }));

    const handleListForSale = async (price: bigint) => {
        if (!listingTicket) return;

        setIsListingLoading(true);
        try {
            const result = await listTicket(
                listingTicket.eventContractAddress,
                listingTicket.tokenId,
                price,
                listingTicket.chainId
            );

            if (result !== null) {
                await refetchTickets();
                setListingTicket(null);
            }
        } catch (err) {
            console.error("Error listing ticket:", err);
        } finally {
            setIsListingLoading(false);
        }
    };

    const handleViewTicket = (ticket: UserTicket) => {
        if (ticket.eventId) {
            router.push(`/ticket/${ticket.eventId}/${ticket.tokenId}`);
        } else {
            // Fallback: look up event ID by contract address
            router.push(`/ticket/${ticket.eventContractAddress}/${ticket.tokenId}`);
        }
    };

    const handleOpenListingModal = (ticket: UserTicket) => {
        setListingTicket(ticket);
        // Use max resale price from DB, or default to 110% of ticket price
        const effectiveMaxResalePrice = ticket.maxResalePrice
            ?? (ticket.ticketPrice * BigInt(110) / BigInt(100));
        setMaxResalePrice(effectiveMaxResalePrice);
    };

    const handleOpenTransferModal = (ticket: UserTicket) => {
        setTransferTicket(ticket);
    };

    const handleTransfer = async (toAddress: `0x${string}`) => {
        if (!transferTicket) return;

        setIsTransferLoading(true);
        try {
            const result = await transferTicketOnChain(
                transferTicket.eventContractAddress,
                transferTicket.tokenId,
                toAddress,
                transferTicket.chainId
            );

            if (result.success) {
                await refetchTickets();
                setTransferTicket(null);
            }
        } catch (err) {
            console.error("Error transferring ticket:", err);
        } finally {
            setIsTransferLoading(false);
        }
    };

    const handleCancelListing = async (ticket: UserTicket) => {
        // Use listing ID from the ticket (stored in DB)
        if (!ticket.listingId) {
            console.error("Listing ID not found for ticket");
            return;
        }

        const listingId = BigInt(ticket.listingId);
        const ticketKey = `${ticket.eventContractAddress}-${ticket.tokenId}`;
        setCancellingTicketId(ticketKey);

        try {
            const result = await cancelListing(listingId, ticket.chainId);

            if (result.success) {
                // Sync to database
                const eventId = await findEventIdByContract(ticket.eventContractAddress);

                await syncListing({
                    listing_id: ticket.listingId,
                    token_id: ticket.tokenId.toString(),
                    event_contract_address: ticket.eventContractAddress,
                    event_id: eventId || undefined,
                    seller_address: address,
                    price: (ticket.listingPrice || ticket.ticketPrice).toString(),
                    action: "cancel",
                    chain_id: walletChainId,
                });

                if (result.txHash) {
                    await syncTransaction({
                        tx_hash: result.txHash,
                        tx_type: "cancel",
                        user_address: address,
                        token_id: ticket.tokenId.toString(),
                        event_contract_address: ticket.eventContractAddress,
                        event_id: eventId || undefined,
                        listing_id: ticket.listingId,
                        tx_timestamp: new Date().toISOString(),
                        chain_id: walletChainId,
                    });
                }

                await syncTicket({
                    token_id: ticket.tokenId.toString(),
                    event_contract_address: ticket.eventContractAddress,
                    event_id: eventId || undefined,
                    owner_address: address,
                    is_listed: false,
                    action: "unlist",
                    chain_id: walletChainId,
                });

                await refetchTickets();
            }
        } catch (err) {
            console.error("Error cancelling listing:", err);
        } finally {
            setCancellingTicketId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                    <div
                        key={i}
                        className="bg-slate-800/50 rounded-xl overflow-hidden border border-white/10 animate-pulse"
                    >
                        <div className="h-40 bg-slate-700/50" />
                        <div className="p-4 space-y-3">
                            <div className="h-5 bg-slate-700/50 rounded w-3/4" />
                            <div className="h-4 bg-slate-700/50 rounded w-1/2" />
                            <div className="h-4 bg-slate-700/50 rounded w-2/3" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (tickets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6">
                    <svg
                        className="w-10 h-10 text-gray-500"
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
                <h3 className="text-xl font-semibold text-white mb-2">No Tickets Yet</h3>
                <p className="text-gray-400 max-w-md mb-6">
                    You don&apos;t have any tickets yet. Browse events to purchase your first NFT ticket!
                </p>
                <a
                    href="/events"
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all"
                >
                    Browse Events
                </a>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {tickets.map((ticket) => {
                    const ticketKey = `${ticket.eventContractAddress}-${ticket.tokenId}`;
                    return (
                        <TicketCard
                            key={ticketKey}
                            ticket={ticket}
                            onClick={() => handleViewTicket(ticket)}
                            onListForSale={() => handleOpenListingModal(ticket)}
                            onTransfer={() => handleOpenTransferModal(ticket)}
                            onCancelListing={() => handleCancelListing(ticket)}
                            isCancelling={cancellingTicketId === ticketKey}
                        />
                    );
                })}
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

            {/* List Ticket Modal */}
            <ListTicketModal
                isOpen={!!listingTicket}
                onClose={() => setListingTicket(null)}
                onSubmit={handleListForSale}
                tokenId={listingTicket?.tokenId ?? BigInt(0)}
                eventName={listingTicket?.eventName ?? ""}
                originalPrice={listingTicket?.ticketPrice}
                maxResalePrice={maxResalePrice}
                isLoading={isListingLoading}
                chainId={listingTicket?.chainId}
            />

            {/* Transfer Ticket Modal */}
            <TransferTicketModal
                isOpen={!!transferTicket}
                onClose={() => setTransferTicket(null)}
                onSubmit={handleTransfer}
                tokenId={transferTicket?.tokenId ?? BigInt(0)}
                eventName={transferTicket?.eventName ?? ""}
                isLoading={isTransferLoading}
            />
        </>
    );
}

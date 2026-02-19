"use client";

import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useMarketplaceListings } from "@/hooks/useMarketplaceListings";
import { syncListing, syncTransaction, syncTicket, findEventIdByContract } from "@/lib/api/sync";
import { useChainConfig } from "@/hooks/useChainConfig";
import {
    ListingGrid,
    BuyTicketModal,
    MarketplaceEmptyState,
} from "@/components/marketplace";
import type { MarketplaceListing } from "@/types/ticket";
import { ChainFilter } from "@/components/ui/ChainFilter";

export default function MarketplacePage() {
    const { address, isConnected } = useAccount();
    const { chainId } = useChainConfig();
    const { switchChainAsync } = useSwitchChain();
    const [selectedChainId, setSelectedChainId] = useState<number | null>(null);

    // Get listings from database (not blockchain)
    const { listings, eventInfoMap, isLoading, error, refetch } = useMarketplaceListings({ status: "active", chainId: selectedChainId });

    // Only use blockchain hook for write operations
    const { buyTicket, cancelListing } = useMarketplace();

    const [processingListingId, setProcessingListingId] = useState<bigint | null>(null);

    // Buy modal state
    const [buyModalOpen, setBuyModalOpen] = useState(false);
    const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);

    // Handle buy button click
    const handleBuyClick = (listing: MarketplaceListing) => {
        setSelectedListing(listing);
        setBuyModalOpen(true);
    };

    // Handle buy confirmation
    const handleBuyConfirm = async () => {
        if (!selectedListing || !address) return;

        // Prompt wallet to switch chain if needed
        if (selectedListing.chainId && selectedListing.chainId !== chainId) {
            try {
                await switchChainAsync({ chainId: selectedListing.chainId });
            } catch {
                return;
            }
            // Chain switched — wagmi re-renders. User needs to confirm again.
            return;
        }

        setProcessingListingId(selectedListing.listingId);
        const result = await buyTicket(selectedListing.listingId, selectedListing.price);

        if (result.success && result.txHash) {
            const eventId = await findEventIdByContract(selectedListing.eventContractAddress);

            await syncListing({
                listing_id: selectedListing.listingId.toString(),
                token_id: selectedListing.tokenId.toString(),
                event_contract_address: selectedListing.eventContractAddress,
                event_id: eventId || undefined,
                seller_address: selectedListing.seller,
                price: selectedListing.price.toString(),
                buyer_address: address,
                action: "buy",
                chain_id: selectedListing.chainId ?? chainId,
            });

            // Record purchase transaction for buyer
            await syncTransaction({
                tx_hash: result.txHash,
                tx_type: "purchase",
                user_address: address,
                token_id: selectedListing.tokenId.toString(),
                event_contract_address: selectedListing.eventContractAddress,
                event_id: eventId || undefined,
                listing_id: selectedListing.listingId.toString(),
                amount: selectedListing.price.toString(),
                from_address: selectedListing.seller,
                to_address: address,
                tx_timestamp: new Date().toISOString(),
                chain_id: selectedListing.chainId ?? chainId,
            });

            // Record sale transaction for seller
            await syncTransaction({
                tx_hash: result.txHash,
                tx_type: "sale",
                user_address: selectedListing.seller,
                token_id: selectedListing.tokenId.toString(),
                event_contract_address: selectedListing.eventContractAddress,
                event_id: eventId || undefined,
                listing_id: selectedListing.listingId.toString(),
                amount: selectedListing.price.toString(),
                from_address: selectedListing.seller,
                to_address: address,
                tx_timestamp: new Date().toISOString(),
                chain_id: selectedListing.chainId ?? chainId,
            });

            await syncTicket({
                token_id: selectedListing.tokenId.toString(),
                event_contract_address: selectedListing.eventContractAddress,
                event_id: eventId || undefined,
                owner_address: address,
                is_listed: false,
                action: "transfer",
                chain_id: selectedListing.chainId ?? chainId,
            });

            setBuyModalOpen(false);
            setSelectedListing(null);
            await refetch();
        } else if (result.success) {
            console.warn("Buy transaction succeeded but no txHash returned - skipping transaction record");
            setBuyModalOpen(false);
            setSelectedListing(null);
            await refetch();
        }

        setProcessingListingId(null);
    };

    // Handle cancel listing
    const handleCancelListing = async (listing: MarketplaceListing) => {
        if (!address) return;

        // Prompt wallet to switch chain if needed
        if (listing.chainId && listing.chainId !== chainId) {
            try {
                await switchChainAsync({ chainId: listing.chainId });
            } catch {
                return;
            }
            return;
        }

        setProcessingListingId(listing.listingId);
        const result = await cancelListing(listing.listingId);

        if (result.success) {
            const eventId = await findEventIdByContract(listing.eventContractAddress);

            await syncListing({
                listing_id: listing.listingId.toString(),
                token_id: listing.tokenId.toString(),
                event_contract_address: listing.eventContractAddress,
                event_id: eventId || undefined,
                seller_address: listing.seller,
                price: listing.price.toString(),
                action: "cancel",
                chain_id: listing.chainId ?? chainId,
            });

            if (result.txHash) {
                await syncTransaction({
                    tx_hash: result.txHash,
                    tx_type: "cancel",
                    user_address: address,
                    token_id: listing.tokenId.toString(),
                    event_contract_address: listing.eventContractAddress,
                    event_id: eventId || undefined,
                    listing_id: listing.listingId.toString(),
                    tx_timestamp: new Date().toISOString(),
                    chain_id: listing.chainId ?? chainId,
                });
            }

            await syncTicket({
                token_id: listing.tokenId.toString(),
                event_contract_address: listing.eventContractAddress,
                event_id: eventId || undefined,
                owner_address: address,
                is_listed: false,
                action: "unlist",
                chain_id: listing.chainId ?? chainId,
            });

            await refetch();
        }

        setProcessingListingId(null);
    };

    // Get event info for selected listing
    const selectedEventInfo = selectedListing
        ? eventInfoMap.get(selectedListing.eventContractAddress.toLowerCase())
        : undefined;

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Ticket Marketplace</h1>
                        <p className="text-gray-400">
                            Buy and sell tickets securely with blockchain verification
                        </p>
                    </div>
                    <ChainFilter value={selectedChainId} onChange={setSelectedChainId} />
                </div>

                {/* Wallet Connection Notice */}
                {!isConnected && (
                    <div className="mb-8 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-purple-300">Connect your wallet to buy tickets from the marketplace</p>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-red-400">{error.message}</p>
                            <button
                                onClick={() => refetch()}
                                className="ml-auto text-sm text-red-400 hover:text-red-300 underline"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && listings.length === 0 && (
                    <MarketplaceEmptyState />
                )}

                {/* Listings Grid */}
                {(isLoading || listings.length > 0) && (
                    <ListingGrid
                        listings={listings}
                        eventInfoMap={eventInfoMap}
                        isLoading={isLoading}
                        currentUserAddress={address}
                        onBuy={handleBuyClick}
                        onCancel={handleCancelListing}
                        processingListingId={processingListingId}
                    />
                )}
            </div>

            {/* Buy Confirmation Modal */}
            <BuyTicketModal
                isOpen={buyModalOpen}
                onClose={() => {
                    setBuyModalOpen(false);
                    setSelectedListing(null);
                }}
                onConfirm={handleBuyConfirm}
                listing={selectedListing}
                eventName={selectedEventInfo?.name}
                eventDate={selectedEventInfo?.date}
                venue={selectedEventInfo?.venue}
                isLoading={processingListingId !== null}
            />
        </div>
    );
}

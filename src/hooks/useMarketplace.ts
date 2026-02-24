"use client";

import { useState, useCallback } from "react";
import { useWriteContract, useAccount, usePublicClient, useSwitchChain } from "wagmi";
import { TicketMarketplaceABI, EventTicketABI } from "./contracts";
import { useChainConfig } from "./useChainConfig";
import { ErrorCode, type AppError } from "@/types/errors";
import { txToast } from "@/utils/toast";
import { syncListing, syncTicket, syncTransaction, findEventIdByContract } from "@/lib/api/sync";

// Native currency address (special ETH address used by the marketplace contract)
const NATIVE_CURRENCY = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa" as const;

export function useMarketplace() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<AppError | null>(null);
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const { contracts, currencySymbol, chainId } = useChainConfig();

    const { writeContractAsync } = useWriteContract();
    const { switchChainAsync } = useSwitchChain();

    /**
     * Prompt the wallet to switch chain if needed.
     * Returns true if we're now on the right chain, false if user rejected.
     * If a switch happened, returns 'switched' so callers know to bail
     * and let wagmi re-render before retrying.
     */
    const ensureChain = useCallback(
        async (targetChainId?: number): Promise<"ok" | "switched" | "rejected"> => {
            if (!targetChainId || targetChainId === chainId) return "ok";
            try {
                await switchChainAsync({ chainId: targetChainId });
                return "switched";
            } catch {
                return "rejected";
            }
        },
        [chainId, switchChainAsync]
    );


    // Check price cap for a listing
    const checkPriceCap = useCallback(
        async (
            nftAddress: `0x${string}`,
            tokenId: bigint,
            price: bigint
        ): Promise<{ valid: boolean; maxPrice: bigint } | null> => {
            if (!publicClient) return null;

            try {
                const result = await publicClient.readContract({
                    address: contracts!.TicketMarketplace,
                    abi: TicketMarketplaceABI,
                    functionName: "checkPriceCap",
                    args: [nftAddress, tokenId, price],
                });

                const [valid, maxPrice] = result as [boolean, bigint];
                return { valid, maxPrice };
            } catch {
                return null;
            }
        },
        [publicClient, contracts]
    );

    // List a ticket for sale
    const listTicket = useCallback(
        async (
            eventContractAddress: `0x${string}`,
            tokenId: bigint,
            price: bigint,
            targetChainId?: number
        ): Promise<bigint | null> => {
            if (!isConnected || !address) {
                setError({
                    code: ErrorCode.WALLET_NOT_CONNECTED,
                    message: "Please connect your wallet to list a ticket",
                });
                return null;
            }

            const chainResult = await ensureChain(targetChainId);
            if (chainResult === "rejected") return null;
            if (chainResult === "switched") return null; // re-render needed

            if (!publicClient) {
                setError({
                    code: ErrorCode.CONTRACT_ERROR,
                    message: "Unable to connect to the network",
                });
                return null;
            }

            setIsLoading(true);
            setError(null);

            try {
                // Check price cap first
                const priceCheck = await checkPriceCap(eventContractAddress, tokenId, price);
                if (priceCheck && !priceCheck.valid) {
                    const maxPriceFormatted = (Number(priceCheck.maxPrice) / 1e18).toFixed(4);
                    const appError: AppError = {
                        code: ErrorCode.PRICE_EXCEEDS_CAP,
                        message: `Price exceeds maximum allowed (${maxPriceFormatted} ${currencySymbol})`,
                    };
                    setError(appError);
                    txToast.error(appError);
                    return null;
                }

                txToast.pending("Approving marketplace...");

                // First, approve the marketplace to transfer this specific NFT
                const approvalHash = await writeContractAsync({
                    address: eventContractAddress,
                    abi: EventTicketABI,
                    functionName: "approve",
                    args: [contracts!.TicketMarketplace, tokenId],
                });

                // Wait for approval transaction to be confirmed
                await publicClient.waitForTransactionReceipt({ hash: approvalHash });

                txToast.pending("Listing ticket...");

                // Then create the listing
                const listingHash = await writeContractAsync({
                    address: contracts!.TicketMarketplace,
                    abi: TicketMarketplaceABI,
                    functionName: "listTicket",
                    args: [eventContractAddress, tokenId, price, NATIVE_CURRENCY],
                });

                // Wait for listing transaction and get receipt
                const receipt = await publicClient.waitForTransactionReceipt({ hash: listingHash });

                // Parse ListingCreated event to get the real listing ID
                // Event: ListingCreated(uint256 indexed listingId, address indexed nftAddress, uint256 indexed tokenId, address seller, uint256 price)
                // keccak256("ListingCreated(uint256,address,uint256,address,uint256)")
                const listingCreatedSignature = "0x5424fbee1c8f403254bd729bf71af07aa944120992dfa4f67cd0e7846ef7b8de";

                let listingId: bigint | null = null;

                // Try to parse from logs
                for (const log of receipt.logs) {
                    if (
                        log.address.toLowerCase() === contracts!.TicketMarketplace.toLowerCase() &&
                        log.topics[0]?.toLowerCase() === listingCreatedSignature.toLowerCase()
                    ) {
                        // Listing ID is the first indexed topic
                        listingId = BigInt(log.topics[1] || "0");
                        break;
                    }
                }

                // Fallback: if we couldn't parse the event, query blockchain directly
                if (!listingId) {
                    // Small delay to ensure data is updated
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Re-read listings from contract to find our listing
                    const freshListings = await publicClient.readContract({
                        address: contracts!.TicketMarketplace,
                        abi: TicketMarketplaceABI,
                        functionName: "getActiveListings",
                        args: [BigInt(0), BigInt(100)],
                    }) as readonly [readonly {
                        id: bigint;
                        tokenId: bigint;
                        nftAddress: `0x${string}`;
                        seller: `0x${string}`;
                        active: boolean;
                    }[], bigint];

                    if (freshListings) {
                        const [rawListings] = freshListings;
                        const ourListing = rawListings.find(
                            (l) =>
                                l.nftAddress.toLowerCase() === eventContractAddress.toLowerCase() &&
                                l.tokenId === tokenId &&
                                l.seller.toLowerCase() === address.toLowerCase() &&
                                l.active
                        );
                        if (ourListing) {
                            listingId = ourListing.id;
                        }
                    }
                }

                txToast.success("Ticket listed successfully!");

                // Sync to database - listing_id is optional if we couldn't retrieve it
                const eventId = await findEventIdByContract(eventContractAddress);

                try {
                    // Only sync listing record if we have the listing ID
                    if (listingId) {
                        await syncListing({
                            listing_id: listingId.toString(),
                            token_id: tokenId.toString(),
                            event_contract_address: eventContractAddress,
                            event_id: eventId || undefined,
                            seller_address: address,
                            price: price.toString(),
                            tx_hash: listingHash,
                            action: "list",
                            chain_id: chainId,
                        });
                    }

                    // Always sync ticket status (mark as listed)
                    await syncTicket({
                        token_id: tokenId.toString(),
                        event_contract_address: eventContractAddress,
                        event_id: eventId || undefined,
                        owner_address: address,
                        is_listed: true,
                        listing_id: listingId?.toString(),
                        action: "list",
                        chain_id: chainId,
                    });

                    // Always sync transaction with real tx hash
                    await syncTransaction({
                        tx_hash: listingHash,
                        tx_type: "listing",
                        user_address: address,
                        token_id: tokenId.toString(),
                        event_contract_address: eventContractAddress,
                        event_id: eventId || undefined,
                        listing_id: listingId?.toString(),
                        amount: price.toString(),
                        tx_timestamp: new Date().toISOString(),
                        chain_id: chainId,
                    });
                } catch (syncErr) {
                    console.error("Failed to sync listing to database:", syncErr);
                }

                return listingId;
            } catch (err) {
                const appError = handleError(err);
                setError(appError);
                txToast.error(appError);
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [isConnected, address, publicClient, writeContractAsync, checkPriceCap, contracts, chainId, ensureChain]
    );


    // Buy a listed ticket
    const buyTicket = useCallback(
        async (listingId: bigint, price: bigint, targetChainId?: number): Promise<{ success: boolean; txHash?: `0x${string}` }> => {
            if (!isConnected || !address) {
                setError({
                    code: ErrorCode.WALLET_NOT_CONNECTED,
                    message: "Please connect your wallet to buy a ticket",
                });
                return { success: false };
            }

            const chainResult = await ensureChain(targetChainId);
            if (chainResult === "rejected") return { success: false };
            if (chainResult === "switched") return { success: false }; // re-render needed

            if (!publicClient) {
                setError({
                    code: ErrorCode.CONTRACT_ERROR,
                    message: "Unable to connect to the network",
                });
                return { success: false };
            }

            setIsLoading(true);
            setError(null);

            try {
                txToast.pending("Purchasing ticket...");

                const txHash = await writeContractAsync({
                    address: contracts!.TicketMarketplace,
                    abi: TicketMarketplaceABI,
                    functionName: "buyTicket",
                    args: [listingId, BigInt(0)], // amountFromBalance = 0, pay full price
                    value: price,
                });

                // Wait for transaction confirmation
                await publicClient.waitForTransactionReceipt({ hash: txHash });

                txToast.success("Ticket purchased successfully!");

                return { success: true, txHash };
            } catch (err) {
                const appError = handleError(err);
                setError(appError);
                txToast.error(appError);
                return { success: false };
            } finally {
                setIsLoading(false);
            }
        },
        [isConnected, address, publicClient, writeContractAsync, ensureChain]
    );

    // Cancel a listing
    const cancelListing = useCallback(
        async (listingId: bigint, targetChainId?: number): Promise<{ success: boolean; txHash?: `0x${string}` }> => {
            if (!isConnected || !address) {
                setError({
                    code: ErrorCode.WALLET_NOT_CONNECTED,
                    message: "Please connect your wallet to cancel a listing",
                });
                return { success: false };
            }

            const chainResult = await ensureChain(targetChainId);
            if (chainResult === "rejected") return { success: false };
            if (chainResult === "switched") return { success: false };

            if (!publicClient) {
                setError({
                    code: ErrorCode.CONTRACT_ERROR,
                    message: "Unable to connect to the network",
                });
                return { success: false };
            }

            setIsLoading(true);
            setError(null);

            try {
                txToast.pending("Cancelling listing...");

                const txHash = await writeContractAsync({
                    address: contracts!.TicketMarketplace,
                    abi: TicketMarketplaceABI,
                    functionName: "cancelListing",
                    args: [listingId],
                });

                // Wait for transaction confirmation
                await publicClient.waitForTransactionReceipt({ hash: txHash });

                txToast.success("Listing cancelled successfully!");

                return { success: true, txHash };
            } catch (err) {
                const appError = handleError(err);
                setError(appError);
                txToast.error(appError);
                return { success: false };
            } finally {
                setIsLoading(false);
            }
        },
        [isConnected, address, publicClient, writeContractAsync]
    );

    // Transfer a ticket to another address
    const transferTicket = useCallback(
        async (
            eventContractAddress: `0x${string}`,
            tokenId: bigint,
            toAddress: `0x${string}`,
            targetChainId?: number
        ): Promise<{ success: boolean; txHash?: `0x${string}` }> => {
            if (!isConnected || !address) {
                setError({
                    code: ErrorCode.WALLET_NOT_CONNECTED,
                    message: "Please connect your wallet to transfer a ticket",
                });
                return { success: false };
            }

            const chainResult = await ensureChain(targetChainId);
            if (chainResult === "rejected") return { success: false };
            if (chainResult === "switched") return { success: false };

            if (!publicClient) {
                setError({
                    code: ErrorCode.CONTRACT_ERROR,
                    message: "Unable to connect to the network",
                });
                return { success: false };
            }

            if (toAddress.toLowerCase() === address.toLowerCase()) {
                setError({
                    code: ErrorCode.CONTRACT_ERROR,
                    message: "Cannot transfer to yourself",
                });
                return { success: false };
            }

            setIsLoading(true);
            setError(null);

            try {
                txToast.pending("Transferring ticket...");

                const txHash = await writeContractAsync({
                    address: eventContractAddress,
                    abi: EventTicketABI,
                    functionName: "safeTransferFrom",
                    args: [address, toAddress, tokenId],
                });

                // Wait for transaction confirmation
                await publicClient.waitForTransactionReceipt({ hash: txHash });

                txToast.success("Ticket transferred successfully!");

                // Sync to database
                const eventId = await findEventIdByContract(eventContractAddress);

                try {
                    // Update ticket ownership in DB
                    await syncTicket({
                        token_id: tokenId.toString(),
                        event_contract_address: eventContractAddress,
                        event_id: eventId || undefined,
                        owner_address: toAddress,
                        action: "transfer",
                        chain_id: chainId,
                    });

                    // Record transaction for sender
                    await syncTransaction({
                        tx_hash: txHash,
                        tx_type: "transfer",
                        user_address: address,
                        token_id: tokenId.toString(),
                        event_contract_address: eventContractAddress,
                        event_id: eventId || undefined,
                        from_address: address,
                        to_address: toAddress,
                        tx_timestamp: new Date().toISOString(),
                        chain_id: chainId,
                    });
                } catch (syncErr) {
                    console.error("Failed to sync transfer to database:", syncErr);
                }

                return { success: true, txHash };
            } catch (err) {
                const appError = handleError(err);
                setError(appError);
                txToast.error(appError);
                return { success: false };
            } finally {
                setIsLoading(false);
            }
        },
        [isConnected, address, publicClient, writeContractAsync]
    );


    // Get claimable balance for a user
    const getClaimableBalance = useCallback(
        async (userAddress?: `0x${string}`): Promise<bigint> => {
            if (!publicClient) return BigInt(0);

            const addressToCheck = userAddress || address;
            if (!addressToCheck) return BigInt(0);

            try {
                const balance = await publicClient.readContract({
                    address: contracts!.TicketMarketplace,
                    abi: TicketMarketplaceABI,
                    functionName: "claimableFunds",
                    args: [addressToCheck, NATIVE_CURRENCY],
                });

                return balance as bigint;
            } catch {
                return BigInt(0);
            }
        },
        [publicClient, address, contracts]
    );

    // Claim funds from marketplace sales
    const claimFunds = useCallback(
        async (): Promise<{ success: boolean; txHash?: `0x${string}` }> => {
            if (!isConnected || !address) {
                setError({
                    code: ErrorCode.WALLET_NOT_CONNECTED,
                    message: "Please connect your wallet to claim funds",
                });
                return { success: false };
            }

            if (!publicClient) {
                setError({
                    code: ErrorCode.CONTRACT_ERROR,
                    message: "Unable to connect to the network",
                });
                return { success: false };
            }

            setIsLoading(true);
            setError(null);

            try {
                // Check if there are funds to claim
                const claimableBalance = await getClaimableBalance();
                if (claimableBalance === BigInt(0)) {
                    setError({
                        code: ErrorCode.CONTRACT_ERROR,
                        message: "No funds available to claim",
                    });
                    return { success: false };
                }

                txToast.pending("Claiming funds...");

                const txHash = await writeContractAsync({
                    address: contracts!.TicketMarketplace,
                    abi: TicketMarketplaceABI,
                    functionName: "claimFunds",
                    args: [NATIVE_CURRENCY],
                });

                // Wait for transaction confirmation
                await publicClient.waitForTransactionReceipt({ hash: txHash });

                txToast.success("Funds claimed successfully!");

                return { success: true, txHash };
            } catch (err) {
                const appError = handleError(err);
                setError(appError);
                txToast.error(appError);
                return { success: false };
            } finally {
                setIsLoading(false);
            }
        },
        [isConnected, address, publicClient, writeContractAsync, getClaimableBalance, contracts]
    );

    return {
        listTicket,
        buyTicket,
        cancelListing,
        transferTicket,
        checkPriceCap,
        claimFunds,
        getClaimableBalance,
        isLoading,
        error,
    };
}

function handleError(err: unknown): AppError {
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (errorMessage.includes("User rejected") || errorMessage.includes("user rejected")) {
        return { code: ErrorCode.TRANSACTION_REJECTED, message: "Transaction was rejected" };
    }
    if (errorMessage.includes("insufficient funds")) {
        return { code: ErrorCode.INSUFFICIENT_FUNDS, message: "Insufficient funds for transaction" };
    }
    if (errorMessage.includes("PriceExceedsCap")) {
        return { code: ErrorCode.PRICE_EXCEEDS_CAP, message: "Price exceeds the maximum allowed" };
    }
    if (errorMessage.includes("ListingNotActive")) {
        return { code: ErrorCode.CONTRACT_ERROR, message: "This listing is no longer active" };
    }
    if (errorMessage.includes("CannotBuyOwnListing")) {
        return { code: ErrorCode.CONTRACT_ERROR, message: "You cannot buy your own listing" };
    }
    if (errorMessage.includes("TicketAlreadyUsed")) {
        return { code: ErrorCode.TICKET_ALREADY_USED, message: "This ticket has already been used" };
    }
    if (errorMessage.includes("OnlySellerOrOwner")) {
        return { code: ErrorCode.UNAUTHORIZED, message: "Only the seller can cancel this listing" };
    }

    return {
        code: ErrorCode.TRANSACTION_FAILED,
        message: "Transaction failed",
        details: errorMessage,
    };
}

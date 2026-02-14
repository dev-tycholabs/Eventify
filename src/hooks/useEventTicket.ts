"use client";

import { useState, useCallback } from "react";
import { useWriteContract, useReadContract, useAccount, usePublicClient } from "wagmi";
import { EventTicketABI } from "./contracts";
import type { NFTTicket } from "@/types/ticket";
import { ErrorCode, type AppError } from "@/types/errors";
import { txToast } from "@/utils/toast";

export interface VerificationResult {
    isValid: boolean;
    holder: `0x${string}` | null;
    isUsed: boolean;
}

export interface EventDetails {
    name: string;
    venue: string;
    date: bigint;
    price: bigint;
    supply: bigint;
    sold: bigint;
    organizer: `0x${string}`;
}

// Purchase result type
export interface PurchaseResult {
    tokenIds: bigint[];
    txHash: `0x${string}`;
}

export function useEventTicket(eventContractAddress?: `0x${string}`) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<AppError | null>(null);
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();

    const { writeContractAsync } = useWriteContract();

    // Fetch ticket price
    const { data: ticketPrice } = useReadContract({
        address: eventContractAddress,
        abi: EventTicketABI,
        functionName: "ticketPrice",
        query: { enabled: !!eventContractAddress },
    });

    // Fetch remaining tickets
    const { data: remainingTickets, refetch: refetchRemaining } = useReadContract({
        address: eventContractAddress,
        abi: EventTicketABI,
        functionName: "remainingTickets",
        query: { enabled: !!eventContractAddress },
    });

    // Fetch event details
    const { data: eventDetails, refetch: refetchDetails } = useReadContract({
        address: eventContractAddress,
        abi: EventTicketABI,
        functionName: "getEventDetails",
        query: { enabled: !!eventContractAddress },
    });


    // Purchase a single ticket
    const purchaseTicket = useCallback(
        async (quantity: number = 1): Promise<PurchaseResult | null> => {
            if (!isConnected || !address) {
                setError({
                    code: ErrorCode.WALLET_NOT_CONNECTED,
                    message: "Please connect your wallet to purchase tickets",
                });
                return null;
            }

            if (!eventContractAddress || !ticketPrice || !publicClient) {
                setError({
                    code: ErrorCode.CONTRACT_ERROR,
                    message: "Event contract not available",
                });
                return null;
            }

            setIsLoading(true);
            setError(null);

            try {
                const totalPrice = ticketPrice * BigInt(quantity);

                txToast.pending("Purchasing ticket...");

                let hash: `0x${string}`;

                if (quantity === 1) {
                    hash = await writeContractAsync({
                        address: eventContractAddress,
                        abi: EventTicketABI,
                        functionName: "purchaseTicket",
                        value: totalPrice,
                    });
                } else {
                    hash = await writeContractAsync({
                        address: eventContractAddress,
                        abi: EventTicketABI,
                        functionName: "purchaseTickets",
                        args: [BigInt(quantity)],
                        value: totalPrice,
                    });
                }

                // Wait for transaction receipt to get the token IDs from Transfer events
                const receipt = await publicClient.waitForTransactionReceipt({ hash });

                // Parse Transfer events to get token IDs
                // Transfer event signature: Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
                const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

                const tokenIds: bigint[] = [];
                for (const log of receipt.logs) {
                    if (
                        log.address.toLowerCase() === eventContractAddress.toLowerCase() &&
                        log.topics[0] === transferEventSignature &&
                        log.topics[2]?.toLowerCase() === `0x000000000000000000000000${address.slice(2).toLowerCase()}`
                    ) {
                        // Token ID is the third topic (indexed)
                        const tokenId = BigInt(log.topics[3] || "0");
                        tokenIds.push(tokenId);
                    }
                }

                txToast.success(quantity === 1 ? "Ticket purchased successfully!" : `${quantity} tickets purchased successfully!`);

                await refetchRemaining();
                await refetchDetails();

                // Return actual token IDs and transaction hash
                return tokenIds.length > 0 ? { tokenIds, txHash: hash } : null;
            } catch (err) {
                const appError = handleError(err);
                setError(appError);
                txToast.error(appError);
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [
            isConnected,
            address,
            eventContractAddress,
            ticketPrice,
            publicClient,
            writeContractAsync,
            refetchRemaining,
            refetchDetails,
        ]
    );


    // Verify ticket authenticity
    const verifyTicket = useCallback(
        async (tokenId: bigint): Promise<VerificationResult | null> => {
            if (!eventContractAddress || !publicClient) {
                setError({
                    code: ErrorCode.CONTRACT_ERROR,
                    message: "Event contract not available",
                });
                return null;
            }

            setIsLoading(true);
            setError(null);

            try {
                const result = await publicClient.readContract({
                    address: eventContractAddress,
                    abi: EventTicketABI,
                    functionName: "verifyTicket",
                    args: [tokenId],
                });

                const [isValid, holder, used] = result as [boolean, `0x${string}`, boolean];

                return {
                    isValid,
                    holder: isValid ? holder : null,
                    isUsed: used,
                };
            } catch (err) {
                const appError = handleError(err);
                setError(appError);
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [eventContractAddress, publicClient]
    );

    // Get tickets owned by a specific address
    const getTicketsByOwner = useCallback(
        async (ownerAddress: `0x${string}`): Promise<bigint[] | null> => {
            if (!eventContractAddress || !publicClient) {
                return null;
            }

            try {
                const tokenIds = await publicClient.readContract({
                    address: eventContractAddress,
                    abi: EventTicketABI,
                    functionName: "getTicketsByOwner",
                    args: [ownerAddress],
                });

                return tokenIds as bigint[];
            } catch (err) {
                console.error("Failed to fetch tickets:", err);
                return null;
            }
        },
        [eventContractAddress, publicClient]
    );

    // Get user's tickets for this event
    const getUserTickets = useCallback(async (): Promise<bigint[] | null> => {
        if (!address) return null;
        return getTicketsByOwner(address);
    }, [address, getTicketsByOwner]);

    // Check if a ticket is used
    const isTicketUsed = useCallback(
        async (tokenId: bigint): Promise<boolean | null> => {
            if (!eventContractAddress || !publicClient) return null;

            try {
                const used = await publicClient.readContract({
                    address: eventContractAddress,
                    abi: EventTicketABI,
                    functionName: "ticketUsed",
                    args: [tokenId],
                });

                return used as boolean;
            } catch {
                return null;
            }
        },
        [eventContractAddress, publicClient]
    );


    // Parse event details into a more usable format
    const parsedEventDetails: EventDetails | null = eventDetails
        ? {
            name: (eventDetails as [string, string, bigint, bigint, bigint, bigint, `0x${string}`])[0],
            venue: (eventDetails as [string, string, bigint, bigint, bigint, bigint, `0x${string}`])[1],
            date: (eventDetails as [string, string, bigint, bigint, bigint, bigint, `0x${string}`])[2],
            price: (eventDetails as [string, string, bigint, bigint, bigint, bigint, `0x${string}`])[3],
            supply: (eventDetails as [string, string, bigint, bigint, bigint, bigint, `0x${string}`])[4],
            sold: (eventDetails as [string, string, bigint, bigint, bigint, bigint, `0x${string}`])[5],
            organizer: (eventDetails as [string, string, bigint, bigint, bigint, bigint, `0x${string}`])[6],
        }
        : null;

    return {
        purchaseTicket,
        verifyTicket,
        getTicketsByOwner,
        getUserTickets,
        isTicketUsed,
        ticketPrice: ticketPrice as bigint | undefined,
        remainingTickets: remainingTickets as bigint | undefined,
        eventDetails: parsedEventDetails,
        isLoading,
        error,
        refetch: async () => {
            await refetchRemaining();
            await refetchDetails();
        },
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
    if (errorMessage.includes("SoldOut")) {
        return { code: ErrorCode.TICKET_SOLD_OUT, message: "Tickets are sold out" };
    }
    if (errorMessage.includes("TicketAlreadyUsed")) {
        return { code: ErrorCode.TICKET_ALREADY_USED, message: "This ticket has already been used" };
    }
    if (errorMessage.includes("TicketDoesNotExist")) {
        return { code: ErrorCode.INVALID_TICKET, message: "Ticket does not exist" };
    }
    if (errorMessage.includes("EventAlreadyPassed")) {
        return { code: ErrorCode.CONTRACT_ERROR, message: "This event has already passed" };
    }
    if (errorMessage.includes("IncorrectPayment")) {
        return { code: ErrorCode.CONTRACT_ERROR, message: "Incorrect payment amount" };
    }

    return {
        code: ErrorCode.TRANSACTION_FAILED,
        message: "Transaction failed",
        details: errorMessage,
    };
}

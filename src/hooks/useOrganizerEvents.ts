"use client";

import { useState, useCallback, useEffect } from "react";
import {
    useWriteContract,
    useReadContract,
    useAccount,
    usePublicClient,
} from "wagmi";
import { CONTRACT_ADDRESSES, EventFactoryABI, EventTicketABI } from "./contracts";
import { ErrorCode, type AppError } from "@/types/errors";
import { txToast } from "@/utils/toast";

export interface OrganizerEvent {
    id: string;
    contractAddress: `0x${string}`;
    name: string;
    venue: string;
    date: Date;
    ticketPrice: bigint;
    maxSupply: number;
    soldCount: number;
    remainingTickets: number;
    contractBalance: bigint;
    baseTokenURI: string;
}

export function useOrganizerEvents() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<AppError | null>(null);
    const [organizerEvents, setOrganizerEvents] = useState<OrganizerEvent[]>([]);
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();

    const { writeContractAsync } = useWriteContract();

    // Fetch events by organizer
    const { data: eventAddresses, refetch: refetchAddresses } = useReadContract({
        address: CONTRACT_ADDRESSES.EventFactory,
        abi: EventFactoryABI,
        functionName: "getEventsByOrganizer",
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });

    // Fetch detailed info for organizer's events
    const fetchOrganizerEvents = useCallback(async () => {
        if (!publicClient || !eventAddresses || eventAddresses.length === 0) {
            setOrganizerEvents([]);
            return;
        }

        setIsLoading(true);
        try {
            const events: OrganizerEvent[] = [];

            for (let i = 0; i < eventAddresses.length; i++) {
                const addr = eventAddresses[i];
                try {
                    const [eventDetails, remaining, balance, baseURI] = await Promise.all([
                        publicClient.readContract({
                            address: addr,
                            abi: EventTicketABI,
                            functionName: "getEventDetails",
                        }),
                        publicClient.readContract({
                            address: addr,
                            abi: EventTicketABI,
                            functionName: "remainingTickets",
                        }),
                        publicClient.getBalance({ address: addr }),
                        publicClient.readContract({
                            address: addr,
                            abi: EventTicketABI,
                            functionName: "baseTokenURI",
                        }),
                    ]);

                    const [name, venue, date, price, supply, sold] = eventDetails as [
                        string, string, bigint, bigint, bigint, bigint, `0x${string}`
                    ];

                    events.push({
                        id: (i + 1).toString(),
                        contractAddress: addr,
                        name,
                        venue,
                        date: new Date(Number(date) * 1000),
                        ticketPrice: price,
                        maxSupply: Number(supply),
                        soldCount: Number(sold),
                        remainingTickets: Number(remaining),
                        contractBalance: balance,
                        baseTokenURI: baseURI as string,
                    });
                } catch (err) {
                    console.error(`Failed to fetch event ${addr}:`, err);
                }
            }

            setOrganizerEvents(events);
        } catch (err) {
            console.error("Failed to fetch organizer events:", err);
        } finally {
            setIsLoading(false);
        }
    }, [publicClient, eventAddresses]);

    useEffect(() => {
        fetchOrganizerEvents();
    }, [fetchOrganizerEvents]);

    // Withdraw funds from an event contract
    const withdrawFunds = useCallback(
        async (eventContractAddress: `0x${string}`): Promise<boolean> => {
            if (!isConnected || !address) {
                setError({
                    code: ErrorCode.WALLET_NOT_CONNECTED,
                    message: "Please connect your wallet",
                });
                return false;
            }

            setIsLoading(true);
            setError(null);

            try {
                txToast.pending("Withdrawing funds...");

                await writeContractAsync({
                    address: eventContractAddress,
                    abi: EventTicketABI,
                    functionName: "withdrawFunds",
                });

                txToast.success("Funds withdrawn successfully!");
                await fetchOrganizerEvents();
                return true;
            } catch (err) {
                const appError = handleError(err);
                setError(appError);
                txToast.error(appError);
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [isConnected, address, writeContractAsync, fetchOrganizerEvents]
    );

    // Update base URI for an event
    const updateBaseURI = useCallback(
        async (eventContractAddress: `0x${string}`, newBaseURI: string): Promise<boolean> => {
            if (!isConnected || !address) {
                setError({
                    code: ErrorCode.WALLET_NOT_CONNECTED,
                    message: "Please connect your wallet",
                });
                return false;
            }

            setIsLoading(true);
            setError(null);

            try {
                txToast.pending("Updating metadata URI...");

                await writeContractAsync({
                    address: eventContractAddress,
                    abi: EventTicketABI,
                    functionName: "setBaseURI",
                    args: [newBaseURI],
                });

                txToast.success("Metadata URI updated!");
                await fetchOrganizerEvents();
                return true;
            } catch (err) {
                const appError = handleError(err);
                setError(appError);
                txToast.error(appError);
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [isConnected, address, writeContractAsync, fetchOrganizerEvents]
    );

    // Mark a single ticket as used
    const markTicketUsed = useCallback(
        async (eventContractAddress: `0x${string}`, tokenId: bigint): Promise<boolean> => {
            if (!isConnected || !address) {
                setError({
                    code: ErrorCode.WALLET_NOT_CONNECTED,
                    message: "Please connect your wallet",
                });
                return false;
            }

            setIsLoading(true);
            setError(null);

            try {
                txToast.pending("Marking ticket as used...");

                await writeContractAsync({
                    address: eventContractAddress,
                    abi: EventTicketABI,
                    functionName: "markAsUsed",
                    args: [tokenId],
                });

                txToast.success("Ticket marked as used!");
                return true;
            } catch (err) {
                const appError = handleError(err);
                setError(appError);
                txToast.error(appError);
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [isConnected, address, writeContractAsync]
    );

    // Batch mark tickets as used
    const batchMarkTicketsUsed = useCallback(
        async (eventContractAddress: `0x${string}`, tokenIds: bigint[]): Promise<boolean> => {
            if (!isConnected || !address) {
                setError({
                    code: ErrorCode.WALLET_NOT_CONNECTED,
                    message: "Please connect your wallet",
                });
                return false;
            }

            setIsLoading(true);
            setError(null);

            try {
                txToast.pending(`Marking ${tokenIds.length} tickets as used...`);

                await writeContractAsync({
                    address: eventContractAddress,
                    abi: EventTicketABI,
                    functionName: "batchMarkAsUsed",
                    args: [tokenIds],
                });

                txToast.success(`${tokenIds.length} tickets marked as used!`);
                return true;
            } catch (err) {
                const appError = handleError(err);
                setError(appError);
                txToast.error(appError);
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [isConnected, address, writeContractAsync]
    );

    const refetch = useCallback(async () => {
        await refetchAddresses();
        await fetchOrganizerEvents();
    }, [refetchAddresses, fetchOrganizerEvents]);

    return {
        organizerEvents,
        isLoading,
        error,
        withdrawFunds,
        updateBaseURI,
        markTicketUsed,
        batchMarkTicketsUsed,
        refetch,
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
    if (errorMessage.includes("OnlyOrganizerOrOwner")) {
        return { code: ErrorCode.CONTRACT_ERROR, message: "Only the event organizer can perform this action" };
    }
    if (errorMessage.includes("NoFundsToWithdraw")) {
        return { code: ErrorCode.CONTRACT_ERROR, message: "No funds available to withdraw" };
    }
    if (errorMessage.includes("TicketAlreadyUsed")) {
        return { code: ErrorCode.TICKET_ALREADY_USED, message: "This ticket has already been used" };
    }
    if (errorMessage.includes("TicketDoesNotExist")) {
        return { code: ErrorCode.INVALID_TICKET, message: "Ticket does not exist" };
    }

    return {
        code: ErrorCode.TRANSACTION_FAILED,
        message: "Transaction failed",
        details: errorMessage,
    };
}

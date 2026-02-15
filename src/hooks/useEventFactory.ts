"use client";

import { useState, useCallback, useEffect } from "react";
import {
    useWriteContract,
    useReadContract,
    useAccount,
    usePublicClient,
} from "wagmi";
import { parseEther } from "viem";
import { EventFactoryABI, EventTicketABI } from "./contracts";
import { useChainConfig } from "./useChainConfig";
import type { Event, EventCreationForm } from "@/types/event";
import { ErrorCode, type AppError } from "@/types/errors";
import { txToast } from "@/utils/toast";

interface EventInfo {
    id: bigint;
    contractAddress: `0x${string}`;
    organizer: `0x${string}`;
    name: string;
    venue: string;
    eventDate: bigint;
    ticketPrice: bigint;
    maxSupply: bigint;
    createdAt: bigint;
}

export function useEventFactory() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<AppError | null>(null);
    const [soldCounts, setSoldCounts] = useState<Record<string, number>>({});
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const { contracts } = useChainConfig();

    const { writeContractAsync } = useWriteContract();

    // Fetch all event addresses
    const {
        data: eventAddresses,
        refetch: refetchEventAddresses,
        isLoading: isLoadingAddresses,
    } = useReadContract({
        address: contracts?.EventFactory,
        abi: EventFactoryABI,
        functionName: "getEvents",
    });

    // Fetch event info for all addresses
    const {
        data: eventInfos,
        refetch: refetchEventInfos,
        isLoading: isLoadingInfos,
    } = useReadContract({
        address: contracts?.EventFactory,
        abi: EventFactoryABI,
        functionName: "getMultipleEventInfo",
        args: eventAddresses && eventAddresses.length > 0 ? [eventAddresses] : undefined,
        query: {
            enabled: !!eventAddresses && eventAddresses.length > 0,
        },
    });

    // Fetch sold counts for all events
    useEffect(() => {
        async function fetchSoldCounts() {
            if (!eventAddresses || eventAddresses.length === 0 || !publicClient) return;

            try {
                const counts: Record<string, number> = {};

                // Fetch sold counts individually (multicall3 not available on this chain)
                const promises = eventAddresses.map(async (addr) => {
                    try {
                        const result = await publicClient.readContract({
                            address: addr,
                            abi: EventTicketABI,
                            functionName: "getEventDetails",
                        });
                        const [, , , , , sold] = result as [string, string, bigint, bigint, bigint, bigint, `0x${string}`];
                        counts[addr] = Number(sold);
                    } catch (err) {
                        console.error(`Failed to fetch sold count for ${addr}:`, err);
                    }
                });

                await Promise.all(promises);
                setSoldCounts(counts);
            } catch (err) {
                console.error("Failed to fetch sold counts:", err);
            }
        }

        fetchSoldCounts();
    }, [eventAddresses, publicClient]);


    // Create a new event
    const createEvent = useCallback(
        async (form: EventCreationForm): Promise<{ txHash: `0x${string}`; contractAddress: `0x${string}`; royaltySplitterAddress: `0x${string}` | null } | null> => {
            if (!isConnected || !address || !publicClient || !contracts) {
                setError({
                    code: ErrorCode.WALLET_NOT_CONNECTED,
                    message: "Please connect your wallet to create an event",
                });
                return null;
            }

            setIsLoading(true);
            setError(null);

            try {
                // Convert date with timezone to Unix timestamp
                const eventDate = getUnixTimestampWithTimezone(form.date, form.timezone);
                console.clear();
                console.log("event date logged :", eventDate);
                const ticketPrice = parseEther(form.ticketPrice);
                const symbol = form.symbol || form.name.substring(0, 4).toUpperCase().replace(/\s/g, "");
                const baseURI = form.imageUrl || ""; // Use IPFS image URL as base URI

                // Convert royalty percentage to basis points (5% = 500 basis points)
                const royaltyBasisPoints = Math.round(parseFloat(form.royaltyPercent || "5") * 100);

                // Build royalty recipient arrays for on-chain splitting
                // If recipients are provided, convert their percentages to basis points (total must be 10000)
                // If no recipients, pass empty arrays (organizer gets all royalties directly)
                const royaltyRecipients: `0x${string}`[] = [];
                const royaltyShares: bigint[] = [];

                if (form.royaltyRecipients.length > 0) {
                    for (const r of form.royaltyRecipients) {
                        if (r.address && /^0x[a-fA-F0-9]{40}$/.test(r.address)) {
                            royaltyRecipients.push(r.address as `0x${string}`);
                            // Convert recipient percentage (out of 100) to basis points (out of 10000)
                            royaltyShares.push(BigInt(Math.round(parseFloat(r.percentage) * 100)));
                        }
                    }
                }

                txToast.pending("Creating event...");

                let hash: `0x${string}`;

                // Check if custom max resale price is provided
                if (form.maxResalePrice && parseFloat(form.maxResalePrice) > 0) {
                    // Calculate max resale percentage from the provided price
                    // maxResalePrice is in native currency, ticketPrice is in native currency
                    // percentage = (maxResalePrice / ticketPrice) * 100
                    const maxResalePercent = Math.round(
                        (parseFloat(form.maxResalePrice) / parseFloat(form.ticketPrice)) * 100
                    );

                    // Ensure minimum 100% (can't be less than original price)
                    const finalMaxResalePercent = Math.max(maxResalePercent, 100);

                    // Use createEventAdvanced with custom max resale percentage and royalty
                    hash = await writeContractAsync({
                        address: contracts.EventFactory,
                        abi: EventFactoryABI,
                        functionName: "createEventAdvanced",
                        args: [
                            form.name,
                            symbol,
                            form.venue,
                            BigInt(eventDate),
                            ticketPrice,
                            BigInt(form.totalSupply),
                            BigInt(form.maxTicketsPerWallet || 0),
                            BigInt(finalMaxResalePercent),
                            baseURI,
                            BigInt(royaltyBasisPoints),
                            royaltyRecipients,
                            royaltyShares,
                        ],
                    });
                } else {
                    // Use createEventAdvanced with default 110% max resale but custom royalty
                    hash = await writeContractAsync({
                        address: contracts.EventFactory,
                        abi: EventFactoryABI,
                        functionName: "createEventAdvanced",
                        args: [
                            form.name,
                            symbol,
                            form.venue,
                            BigInt(eventDate),
                            ticketPrice,
                            BigInt(form.totalSupply),
                            BigInt(form.maxTicketsPerWallet || 0),
                            BigInt(110), // Default 110% max resale
                            baseURI,
                            BigInt(royaltyBasisPoints),
                            royaltyRecipients,
                            royaltyShares,
                        ],
                    });
                }

                // Wait for transaction to be confirmed
                await publicClient.waitForTransactionReceipt({ hash });

                // Fetch the latest event contract address from the factory
                // This is the most reliable way since the factory tracks all created events
                const addresses = await publicClient.readContract({
                    address: contracts.EventFactory,
                    abi: EventFactoryABI,
                    functionName: "getEventsByOrganizer",
                    args: [address],
                });

                if (!addresses || addresses.length === 0) {
                    throw new Error("Failed to get deployed contract address");
                }

                // The latest event is the one we just created
                const contractAddress = addresses[addresses.length - 1];

                // Read the royalty splitter address from the factory
                let royaltySplitterAddress: `0x${string}` | null = null;
                try {
                    const splitter = await publicClient.readContract({
                        address: contracts.EventFactory,
                        abi: EventFactoryABI,
                        functionName: "eventSplitter",
                        args: [contractAddress],
                    });
                    if (splitter && splitter !== "0x0000000000000000000000000000000000000000") {
                        royaltySplitterAddress = splitter;
                    }
                } catch (err) {
                    console.error("Failed to read splitter address:", err);
                }

                txToast.success("Event created successfully!");

                // Refetch events after creation
                await refetchEventAddresses();
                await refetchEventInfos();

                return { txHash: hash, contractAddress, royaltySplitterAddress };
            } catch (err) {
                const appError = handleError(err);
                setError(appError);
                txToast.error(appError);
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [isConnected, address, publicClient, writeContractAsync, refetchEventAddresses, refetchEventInfos, contracts]
    );

    // Transform contract data to Event type
    const getEvents = useCallback((): Event[] => {
        if (!eventInfos || !Array.isArray(eventInfos)) return [];

        return (eventInfos as EventInfo[]).map((info) => ({
            id: info.id.toString(),
            contractAddress: info.contractAddress,
            name: info.name,
            description: "",
            date: new Date(Number(info.eventDate) * 1000),
            venue: info.venue,
            imageUrl: "",
            ticketPrice: info.ticketPrice,
            totalSupply: Number(info.maxSupply),
            soldCount: soldCounts[info.contractAddress] ?? 0,
            organizer: info.organizer,
        }));
    }, [eventInfos, soldCounts]);

    // Refetch all event data
    const refetch = useCallback(async () => {
        await refetchEventAddresses();
        await refetchEventInfos();
    }, [refetchEventAddresses, refetchEventInfos]);

    return {
        createEvent,
        getEvents,
        events: getEvents(),
        eventAddresses: eventAddresses ?? [],
        isLoading: isLoading || isLoadingAddresses || isLoadingInfos,
        error,
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
    if (errorMessage.includes("InvalidEventDate")) {
        return { code: ErrorCode.CONTRACT_ERROR, message: "Event date must be in the future" };
    }
    if (errorMessage.includes("InvalidTicketPrice")) {
        return { code: ErrorCode.CONTRACT_ERROR, message: "Invalid ticket price" };
    }
    if (errorMessage.includes("InvalidMaxSupply")) {
        return { code: ErrorCode.CONTRACT_ERROR, message: "Invalid ticket supply" };
    }

    return {
        code: ErrorCode.TRANSACTION_FAILED,
        message: "Transaction failed",
        details: errorMessage,
    };
}

/**
 * Convert a datetime-local value with a GMT offset to Unix timestamp
 *
 * Uses ISO 8601 format parsing which is more robust and handles edge cases.
 * The browser's Date parser correctly interprets the offset.
 *
 * @param dateTimeLocal - The datetime-local input value (e.g., "2026-03-15T20:00")
 * @param gmtOffset - The GMT offset (e.g., "+05:30", "-04:00")
 * @returns Unix timestamp in seconds
 */
function getUnixTimestampWithTimezone(dateTimeLocal: string, gmtOffset: string): number {
    // Ensure we only have date and time (no seconds from input)
    // datetime-local format is "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss"
    const dtNormalized = dateTimeLocal.length === 16 ? dateTimeLocal : dateTimeLocal.slice(0, 16);

    // Build ISO 8601 string: "2026-03-15T20:00:00+05:30"
    // The Date parser will correctly convert this to UTC
    const iso = `${dtNormalized}:00${gmtOffset}`;
    const d = new Date(iso);

    if (Number.isNaN(d.getTime())) {
        console.error("Invalid datetime or GMT offset:", dateTimeLocal, gmtOffset);
        throw new Error("Invalid datetime or GMT offset");
    }

    return Math.floor(d.getTime() / 1000);
}

"use client";

import { useState, useCallback } from "react";
import { usePublicClient, useWalletClient, useSwitchChain } from "wagmi";
import { isAddress } from "viem";
import { EventTicketABI } from "@/hooks/contracts";
import { QRScanner } from "@/components/verify/QRScanner";
import { WalletQRScanner } from "./WalletQRScanner";
import { txToast } from "@/utils/toast";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useChainConfig } from "@/hooks/useChainConfig";

interface EventTicketScannerProps {
    eventContractAddress: `0x${string}`;
    eventName: string;
    eventChainId: number; // Add chain ID prop
}

interface ScannedTicket {
    tokenId: bigint;
    holder: `0x${string}`;
    isUsed: boolean;
    isValid: boolean;
    scannedAddress: string;
}

interface UserTickets {
    walletAddress: `0x${string}`;
    tickets: {
        tokenId: bigint;
        isUsed: boolean;
    }[];
}

export function EventTicketScanner({ eventContractAddress, eventName, eventChainId }: EventTicketScannerProps) {
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();
    const { switchChainAsync } = useSwitchChain();
    const { chainId: connectedChainId } = useChainConfig();

    const [mode, setMode] = useState<"scan" | "lookup">("scan");
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scannedTicket, setScannedTicket] = useState<ScannedTicket | null>(null);
    const [userTickets, setUserTickets] = useState<UserTickets | null>(null);
    const [lookupAddress, setLookupAddress] = useState("");
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [isMarkingUsed, setIsMarkingUsed] = useState(false);
    const [showWalletScanner, setShowWalletScanner] = useState(false);

    // Verify a single ticket from QR scan (DATABASE-FIRST)
    const verifyTicket = useCallback(async (scannedContract: string, tokenIdStr: string) => {
        // Check if the scanned QR is for this event
        if (scannedContract.toLowerCase() !== eventContractAddress.toLowerCase()) {
            setError(`This ticket is for a different event. Expected contract: ${eventContractAddress.slice(0, 10)}...`);
            setIsVerifying(false);
            return;
        }

        setIsVerifying(true);
        setError(null);
        setScannedTicket(null);

        try {
            const tokenId = BigInt(tokenIdStr);
            const supabase = getSupabaseClient();

            // Try database first (fast path)
            const { data: ticket, error: dbError } = await supabase
                .from("user_tickets")
                .select("token_id, owner_address, is_used")
                .eq("token_id", tokenIdStr)
                .eq("event_contract_address", eventContractAddress.toLowerCase())
                .single();

            if (ticket && !dbError) {
                // Found in database - use cached data
                setScannedTicket({
                    tokenId,
                    holder: ticket.owner_address as `0x${string}`,
                    isUsed: ticket.is_used,
                    isValid: true,
                    scannedAddress: scannedContract,
                });
            } else {
                // Not in database or error - fallback to blockchain
                if (!publicClient) {
                    setError("Please connect your wallet first");
                    return;
                }

                const verifyResult = await publicClient.readContract({
                    address: eventContractAddress,
                    abi: EventTicketABI,
                    functionName: "verifyTicket",
                    args: [tokenId],
                });

                const [isValid, holder, isUsed] = verifyResult as [boolean, `0x${string}`, boolean];

                setScannedTicket({
                    tokenId,
                    holder: isValid ? holder : "0x0000000000000000000000000000000000000000",
                    isUsed,
                    isValid,
                    scannedAddress: scannedContract,
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes("TicketDoesNotExist") || errorMessage.includes("ERC721NonexistentToken")) {
                setError("Ticket does not exist for this event.");
            } else {
                setError("Failed to verify ticket. Please try again.");
            }
        } finally {
            setIsVerifying(false);
        }
    }, [publicClient, eventContractAddress]);


    // Look up all tickets owned by a wallet address or username (DATABASE-FIRST)
    const lookupUserTickets = useCallback(async (addressOrUsername?: string) => {
        const input = addressOrUsername || lookupAddress;
        if (!input.trim()) return;

        setIsLookingUp(true);
        setError(null);
        setUserTickets(null);

        try {
            const supabase = getSupabaseClient();
            let walletAddr: `0x${string}`;

            // Check if input is a valid address or a username
            if (isAddress(input)) {
                walletAddr = input as `0x${string}`;
            } else {
                // Treat as username and look up the address
                const res = await fetch(`/api/users?username=${encodeURIComponent(input.replace(/^@/, ""))}`);
                const data = await res.json();
                if (!data.user || !data.user.wallet_address) {
                    setError("User not found. Please check the username.");
                    setIsLookingUp(false);
                    return;
                }
                walletAddr = data.user.wallet_address as `0x${string}`;
            }

            // Query database for tickets (fast path)
            const { data: tickets, error: dbError } = await supabase
                .from("user_tickets")
                .select("token_id, is_used")
                .eq("owner_address", walletAddr.toLowerCase())
                .eq("event_contract_address", eventContractAddress.toLowerCase());

            if (!dbError && tickets) {
                // Found in database - use cached data
                const ticketsWithStatus = tickets.map(t => ({
                    tokenId: BigInt(t.token_id),
                    isUsed: t.is_used
                }));

                setUserTickets({
                    walletAddress: walletAddr,
                    tickets: ticketsWithStatus,
                });
            } else {
                // Fallback to blockchain if database query fails
                if (!publicClient) {
                    setError("Please connect your wallet to verify tickets");
                    setIsLookingUp(false);
                    return;
                }

                const ticketIds = await publicClient.readContract({
                    address: eventContractAddress,
                    abi: EventTicketABI,
                    functionName: "getTicketsByOwner",
                    args: [walletAddr],
                }) as bigint[];

                if (ticketIds.length === 0) {
                    setUserTickets({
                        walletAddress: walletAddr,
                        tickets: [],
                    });
                    return;
                }

                // Check usage status for each ticket
                const ticketsWithStatus = await Promise.all(
                    ticketIds.map(async (tokenId) => {
                        try {
                            const isUsed = await publicClient.readContract({
                                address: eventContractAddress,
                                abi: EventTicketABI,
                                functionName: "ticketUsed",
                                args: [tokenId],
                            }) as boolean;
                            return { tokenId, isUsed };
                        } catch {
                            return { tokenId, isUsed: false };
                        }
                    })
                );

                setUserTickets({
                    walletAddress: walletAddr,
                    tickets: ticketsWithStatus,
                });
            }
        } catch (err) {
            console.error("Failed to lookup tickets:", err);
            setError("Failed to look up tickets. Please try again.");
        } finally {
            setIsLookingUp(false);
        }
    }, [publicClient, lookupAddress, eventContractAddress]);

    // Mark a ticket as used (BLOCKCHAIN WRITE + DATABASE UPDATE)
    const markTicketAsUsed = useCallback(async (tokenId: bigint) => {
        if (!walletClient || !publicClient) return;

        // Check if we're on the wrong chain
        const isWrongChain = connectedChainId !== eventChainId;

        if (isWrongChain) {
            try {
                txToast.pending("Switching network...");
                await switchChainAsync({ chainId: eventChainId });
                txToast.success("Network switched! Please click Check In again.");
                return; // User needs to click again after switch
            } catch (err) {
                txToast.error("Network switch rejected");
                return;
            }
        }

        setIsMarkingUsed(true);
        try {
            txToast.pending("Marking ticket as used...");

            // 1. Write to blockchain (source of truth)
            const hash = await walletClient.writeContract({
                address: eventContractAddress,
                abi: EventTicketABI,
                functionName: "markAsUsed",
                args: [tokenId],
            });

            // 2. Wait for transaction confirmation
            await publicClient.waitForTransactionReceipt({ hash });

            txToast.success("Ticket marked as used!");

            // 3. Update database cache for fast future reads
            const supabase = getSupabaseClient();
            const { error: updateError } = await supabase
                .from("user_tickets")
                .update({
                    is_used: true,
                    used_at: new Date().toISOString()
                })
                .eq("token_id", tokenId.toString())
                .eq("event_contract_address", eventContractAddress.toLowerCase());

            if (updateError) {
                console.error("Failed to update database cache:", updateError);
                // Don't show error to user - blockchain is source of truth
            }

            // 4. Update local state
            if (scannedTicket && scannedTicket.tokenId === tokenId) {
                setScannedTicket({ ...scannedTicket, isUsed: true });
            }
            if (userTickets) {
                setUserTickets({
                    ...userTickets,
                    tickets: userTickets.tickets.map((t) =>
                        t.tokenId === tokenId ? { ...t, isUsed: true } : t
                    ),
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes("TicketAlreadyUsed")) {
                txToast.error("Ticket has already been used");
            } else if (errorMessage.includes("User rejected")) {
                txToast.error("Transaction was rejected");
            } else {
                txToast.error("Failed to mark ticket as used");
            }
        } finally {
            setIsMarkingUsed(false);
        }
    }, [walletClient, publicClient, eventContractAddress, scannedTicket, userTickets, connectedChainId, eventChainId, switchChainAsync]);

    const handleQRScanSuccess = useCallback((contract: string, tokenId: string) => {
        verifyTicket(contract, tokenId);
    }, [verifyTicket]);

    const handleQRError = useCallback((errorMsg: string) => {
        setError(errorMsg);
    }, []);

    const resetScan = () => {
        setScannedTicket(null);
        setError(null);
    };

    const resetLookup = () => {
        setUserTickets(null);
        setLookupAddress("");
        setError(null);
        setShowWalletScanner(false);
    };

    const handleWalletQRSuccess = useCallback((walletAddress: string) => {
        setLookupAddress(walletAddress);
        setShowWalletScanner(false);
        setError(null);
        // Automatically trigger lookup
        lookupUserTickets(walletAddress);
    }, [lookupUserTickets]);

    const handleWalletQRError = useCallback((errorMsg: string) => {
        setError(errorMsg);
    }, []);

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Ticket Scanner</h2>
                        <p className="text-sm text-gray-400">Verify and check-in attendees for {eventName}</p>
                    </div>
                </div>
            </div>

            {/* Mode Tabs */}
            <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl">
                <button
                    onClick={() => { setMode("scan"); resetLookup(); }}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === "scan"
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-slate-700/50"
                        }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Scan QR Code
                </button>
                <button
                    onClick={() => { setMode("lookup"); resetScan(); }}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === "lookup"
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-slate-700/50"
                        }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Lookup User
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {/* Scan Mode */}
            {mode === "scan" && !scannedTicket && (
                <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
                    <QRScanner
                        onScanSuccess={handleQRScanSuccess}
                        onError={handleQRError}
                        isVerifying={isVerifying}
                    />
                    {isVerifying && (
                        <div className="mt-6 flex items-center justify-center gap-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                            <svg className="animate-spin h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="text-purple-400 font-medium">Verifying ticket...</span>
                        </div>
                    )}
                </div>
            )}


            {/* Scanned Ticket Result */}
            {mode === "scan" && scannedTicket && (
                <div className="space-y-4">
                    <div className={`rounded-2xl p-6 border ${scannedTicket.isUsed
                        ? "bg-yellow-500/10 border-yellow-500/30"
                        : scannedTicket.isValid
                            ? "bg-green-500/10 border-green-500/30"
                            : "bg-red-500/10 border-red-500/30"
                        }`}>
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${scannedTicket.isUsed
                                ? "bg-yellow-500/20"
                                : scannedTicket.isValid
                                    ? "bg-green-500/20"
                                    : "bg-red-500/20"
                                }`}>
                                {scannedTicket.isUsed ? (
                                    <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                ) : scannedTicket.isValid ? (
                                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1">
                                {scannedTicket.isUsed
                                    ? "Ticket Already Used"
                                    : scannedTicket.isValid
                                        ? "Valid Ticket"
                                        : "Invalid Ticket"}
                            </h3>
                            <p className={`text-sm ${scannedTicket.isUsed
                                ? "text-yellow-400/70"
                                : scannedTicket.isValid
                                    ? "text-green-400/70"
                                    : "text-red-400/70"
                                }`}>
                                {scannedTicket.isUsed
                                    ? "This ticket has already been checked in"
                                    : scannedTicket.isValid
                                        ? "Ready for check-in"
                                        : "This ticket is not valid"}
                            </p>
                        </div>

                        {/* Ticket Details */}
                        <div className="space-y-3 bg-slate-900/50 rounded-xl p-4">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-400">Token ID</span>
                                <span className="text-sm text-white font-mono">#{scannedTicket.tokenId.toString()}</span>
                            </div>
                            {scannedTicket.isValid && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-400">Holder</span>
                                    <span className="text-sm text-white font-mono">{truncateAddress(scannedTicket.holder)}</span>
                                </div>
                            )}
                        </div>

                        {/* Mark as Used Button */}
                        {scannedTicket.isValid && !scannedTicket.isUsed && (
                            <button
                                onClick={() => markTicketAsUsed(scannedTicket.tokenId)}
                                disabled={isMarkingUsed}
                                className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isMarkingUsed ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Checking In...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Check In Attendee
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <button
                        onClick={resetScan}
                        className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Scan Another Ticket
                    </button>
                </div>
            )}


            {/* Lookup Mode */}
            {mode === "lookup" && !userTickets && (
                <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
                    <div className="space-y-4">
                        {/* Wallet QR Scanner */}
                        {showWalletScanner ? (
                            <WalletQRScanner
                                onScanSuccess={handleWalletQRSuccess}
                                onError={handleWalletQRError}
                                onClose={() => setShowWalletScanner(false)}
                            />
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Username or Wallet Address
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={lookupAddress}
                                            onChange={(e) => setLookupAddress(e.target.value)}
                                            placeholder="@username or 0x..."
                                            className="flex-1 px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm"
                                        />
                                        <button
                                            onClick={() => setShowWalletScanner(true)}
                                            className="px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:border-purple-500/50 transition-all cursor-pointer"
                                            title="Scan Profile QR"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                            </svg>
                                        </button>
                                    </div>
                                    <p className="mt-1.5 text-xs text-gray-500">
                                        Enter username, wallet address, or scan profile QR code
                                    </p>
                                </div>
                                <button
                                    onClick={() => lookupUserTickets()}
                                    disabled={isLookingUp || !lookupAddress.trim()}
                                    className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {isLookingUp ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Looking Up...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            Look Up Tickets
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* User Tickets Result */}
            {mode === "lookup" && userTickets && (
                <div className="space-y-4">
                    <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Tickets Found</h3>
                                <p className="text-sm text-gray-400 font-mono">{truncateAddress(userTickets.walletAddress)}</p>
                            </div>
                            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm font-medium rounded-full">
                                {userTickets.tickets.length} ticket{userTickets.tickets.length !== 1 ? "s" : ""}
                            </span>
                        </div>

                        {userTickets.tickets.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                    </svg>
                                </div>
                                <p className="text-gray-400">No tickets found for this wallet</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {userTickets.tickets.map((ticket) => (
                                    <div
                                        key={ticket.tokenId.toString()}
                                        className={`flex items-center justify-between p-4 rounded-xl border ${ticket.isUsed
                                            ? "bg-yellow-500/5 border-yellow-500/20"
                                            : "bg-green-500/5 border-green-500/20"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ticket.isUsed ? "bg-yellow-500/20" : "bg-green-500/20"
                                                }`}>
                                                {ticket.isUsed ? (
                                                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">Ticket #{ticket.tokenId.toString()}</p>
                                                <p className={`text-xs ${ticket.isUsed ? "text-yellow-400" : "text-green-400"}`}>
                                                    {ticket.isUsed ? "Already checked in" : "Ready for check-in"}
                                                </p>
                                            </div>
                                        </div>
                                        {!ticket.isUsed && (
                                            <button
                                                onClick={() => markTicketAsUsed(ticket.tokenId)}
                                                disabled={isMarkingUsed}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                                            >
                                                Check In
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={resetLookup}
                        className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Look Up Another Wallet
                    </button>
                </div>
            )}
        </div>
    );
}

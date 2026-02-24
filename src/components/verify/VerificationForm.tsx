"use client";

import { useState, useCallback, useEffect } from "react";
import { isAddress } from "viem";
import { verifyTicketMultiChain } from "@/lib/multichain-verify";
import type { VerificationData } from "@/app/verify/page";
import { QRScanner } from "./QRScanner";

interface QueryParams {
    contract: string | null;
    tokenId: string | null;
    event: string | null;
    chainId: string | null;
}

interface VerificationFormProps {
    onVerificationComplete: (result: VerificationData | null) => void;
    isVerifying: boolean;
    setIsVerifying: (value: boolean) => void;
    initialParams?: QueryParams | null;
}

type VerifyMode = "manual" | "scan";

export function VerificationForm({
    onVerificationComplete,
    isVerifying,
    setIsVerifying,
    initialParams,
}: VerificationFormProps) {
    const [mode, setMode] = useState<VerifyMode>("scan");
    const [eventAddress, setEventAddress] = useState("");
    const [tokenId, setTokenId] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [hasAutoVerified, setHasAutoVerified] = useState(false);

    const validateInputs = useCallback((): boolean => {
        setError(null);

        if (!eventAddress.trim()) {
            setError("Please enter an event contract address");
            return false;
        }

        if (!isAddress(eventAddress)) {
            setError("Invalid event contract address format");
            return false;
        }

        if (!tokenId.trim()) {
            setError("Please enter a ticket token ID");
            return false;
        }

        const tokenIdNum = parseInt(tokenId, 10);
        if (isNaN(tokenIdNum) || tokenIdNum < 0) {
            setError("Token ID must be a valid non-negative number");
            return false;
        }

        return true;
    }, [eventAddress, tokenId]);

    const verifyTicket = useCallback(async (address: string, token: string, hintChainId?: number) => {
        if (!isAddress(address)) {
            setError("Invalid event contract address format");
            return;
        }

        setIsVerifying(true);
        setError(null);

        try {
            const tokenIdBigInt = BigInt(token);
            const contractAddress = address as `0x${string}`;

            const result = await verifyTicketMultiChain(contractAddress, tokenIdBigInt, hintChainId);

            onVerificationComplete({
                isValid: result.isValid,
                holder: result.isValid ? result.holder : null,
                isUsed: result.isUsed,
                eventName: result.eventName,
                eventVenue: result.eventVenue,
                eventDate: result.eventDate,
                tokenId: tokenIdBigInt,
                eventAddress: contractAddress,
                chainId: result.chainId,
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);

            if (errorMessage.includes("TicketNotFoundOnAnyChain")) {
                setError("Ticket not found on any supported chain. Please check the contract address and token ID.");
            } else if (errorMessage.includes("TicketDoesNotExist") || errorMessage.includes("ERC721NonexistentToken")) {
                setError("Ticket does not exist. Please check the token ID.");
            } else if (errorMessage.includes("execution reverted")) {
                setError("Invalid contract or ticket. Please verify the event address.");
            } else {
                setError("Verification failed. Please check your inputs and try again.");
            }
            setIsVerifying(false);
        }
    }, [setIsVerifying, onVerificationComplete]);

    const handleVerify = useCallback(async () => {
        if (!validateInputs()) return;
        await verifyTicket(eventAddress, tokenId);
    }, [validateInputs, verifyTicket, eventAddress, tokenId]);

    // Auto-verify when initialParams are provided (from QR code URL)
    useEffect(() => {
        if (initialParams && initialParams.contract && initialParams.tokenId && !hasAutoVerified) {
            setEventAddress(initialParams.contract);
            setTokenId(initialParams.tokenId);
            setMode("manual"); // Switch to manual mode to show the filled form
            setHasAutoVerified(true);
            const hintChainId = initialParams.chainId ? parseInt(initialParams.chainId, 10) : undefined;
            verifyTicket(initialParams.contract, initialParams.tokenId, hintChainId);
        }
    }, [initialParams, hasAutoVerified, verifyTicket]);

    const handleQRScanSuccess = useCallback((contract: string, scannedTokenId: string, chainId?: number) => {
        setEventAddress(contract);
        setTokenId(scannedTokenId);
        verifyTicket(contract, scannedTokenId, chainId);
    }, [verifyTicket]);

    const handleQRError = useCallback((errorMsg: string) => {
        setError(errorMsg);
    }, []);

    return (
        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 sm:p-8">
            {/* Mode Tabs */}
            <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl mb-6">
                <button
                    onClick={() => setMode("scan")}
                    disabled={isVerifying}
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
                    onClick={() => setMode("manual")}
                    disabled={isVerifying}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === "manual"
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-slate-700/50"
                        }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Manual Entry
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
                    <svg
                        className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
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
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {/* QR Scanner Mode */}
            {mode === "scan" && (
                <QRScanner
                    onScanSuccess={handleQRScanSuccess}
                    onError={handleQRError}
                    isVerifying={isVerifying}
                />
            )}

            {/* Manual Entry Mode */}
            {mode === "manual" && (
                <div className="space-y-6">
                    {/* Event Contract Address Input */}
                    <div>
                        <label
                            htmlFor="eventAddress"
                            className="block text-sm font-medium text-gray-300 mb-2"
                        >
                            Event Contract Address
                        </label>
                        <input
                            id="eventAddress"
                            type="text"
                            value={eventAddress}
                            onChange={(e) => setEventAddress(e.target.value)}
                            placeholder="0x..."
                            className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all font-mono text-sm"
                            disabled={isVerifying}
                        />
                        <p className="mt-1.5 text-xs text-gray-500">
                            The smart contract address of the event
                        </p>
                    </div>

                    {/* Token ID Input */}
                    <div>
                        <label
                            htmlFor="tokenId"
                            className="block text-sm font-medium text-gray-300 mb-2"
                        >
                            Ticket Token ID
                        </label>
                        <input
                            id="tokenId"
                            type="text"
                            value={tokenId}
                            onChange={(e) => setTokenId(e.target.value)}
                            placeholder="Enter token ID (e.g., 1, 2, 3...)"
                            className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                            disabled={isVerifying}
                        />
                        <p className="mt-1.5 text-xs text-gray-500">
                            The unique token ID of the NFT ticket
                        </p>
                    </div>

                    {/* Verify Button */}
                    <button
                        onClick={handleVerify}
                        disabled={isVerifying}
                        className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {isVerifying ? (
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
                                Verifying...
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
                                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                    />
                                </svg>
                                Verify Ticket
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Loading Overlay for QR Scan */}
            {isVerifying && mode === "scan" && (
                <div className="mt-6 flex items-center justify-center gap-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                    <svg
                        className="animate-spin h-5 w-5 text-purple-400"
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
                    <span className="text-purple-400 font-medium">Verifying ticket...</span>
                </div>
            )}
        </div>
    );
}

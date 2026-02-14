"use client";

import { useState, useEffect } from "react";
import { isAddress } from "viem";
import { WalletQRScanner } from "@/components/events/WalletQRScanner";

interface TransferTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (toAddress: `0x${string}`) => Promise<void>;
    tokenId: bigint;
    eventName: string;
    isLoading: boolean;
}

type InputMode = "manual" | "qr";
type ManualInputType = "address" | "username";

export function TransferTicketModal({
    isOpen,
    onClose,
    onSubmit,
    tokenId,
    eventName,
    isLoading,
}: TransferTicketModalProps) {
    const [inputMode, setInputMode] = useState<InputMode>("manual");
    const [manualInputType, setManualInputType] = useState<ManualInputType>("address");
    const [toAddress, setToAddress] = useState("");
    const [username, setUsername] = useState("");
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isResolvingUsername, setIsResolvingUsername] = useState(false);
    const [scannedAddress, setScannedAddress] = useState<string | null>(null);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setInputMode("manual");
            setManualInputType("address");
            setToAddress("");
            setUsername("");
            setResolvedAddress(null);
            setScannedAddress(null);
            setError(null);
        }
    }, [isOpen]);

    // Resolve username to address with debounce
    useEffect(() => {
        if (manualInputType !== "username" || !username.trim()) {
            setResolvedAddress(null);
            return;
        }

        const timer = setTimeout(async () => {
            setIsResolvingUsername(true);
            setError(null);
            try {
                const res = await fetch(`/api/users?username=${encodeURIComponent(username.trim().toLowerCase())}`);
                const data = await res.json();
                if (data.user?.wallet_address) {
                    const addr = data.user.wallet_address;
                    // Ensure address has proper format (0x prefix)
                    const formattedAddr = addr.startsWith("0x") ? addr : `0x${addr}`;
                    setResolvedAddress(formattedAddr);
                } else {
                    setResolvedAddress(null);
                    setError("Username not found");
                }
            } catch {
                setError("Failed to lookup username");
                setResolvedAddress(null);
            } finally {
                setIsResolvingUsername(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [username, manualInputType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        let finalAddress: string | null = null;

        if (manualInputType === "address") {
            if (!toAddress.trim()) {
                setError("Please enter a wallet address");
                return;
            }
            if (!isAddress(toAddress)) {
                setError("Please enter a valid Ethereum address");
                return;
            }
            finalAddress = toAddress;
        } else {
            if (!resolvedAddress) {
                setError("Please enter a valid username");
                return;
            }
            if (!isAddress(resolvedAddress)) {
                setError("Invalid address resolved from username");
                return;
            }
            finalAddress = resolvedAddress;
        }

        await onSubmit(finalAddress as `0x${string}`);
    };

    const handleQRScanSuccess = (walletAddress: string) => {
        setScannedAddress(walletAddress);
        setError(null);
    };

    const handleQRTransfer = async () => {
        if (!scannedAddress || !isAddress(scannedAddress)) {
            setError("Invalid address from QR code");
            return;
        }
        await onSubmit(scannedAddress as `0x${string}`);
    };

    const handleClearScannedAddress = () => {
        setScannedAddress(null);
        setError(null);
    };

    const handleQRError = (errorMsg: string) => {
        setError(errorMsg);
    };

    const handleClose = () => {
        onClose();
    };

    if (!isOpen) return null;

    const canSubmit = (): boolean => {
        if (isLoading) return false;
        if (manualInputType === "address") {
            return Boolean(toAddress.trim()) && isAddress(toAddress);
        }
        return Boolean(resolvedAddress) && isAddress(resolvedAddress as string);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer z-10"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Transfer Ticket</h2>
                            <p className="text-gray-400 text-sm">{eventName} • #{tokenId.toString()}</p>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
                        <div className="flex gap-3">
                            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-amber-200 text-sm">
                                This action is irreversible. Make sure you select the correct recipient.
                            </p>
                        </div>
                    </div>

                    {/* Input Mode Tabs */}
                    <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl mb-6">
                        <button
                            onClick={() => setInputMode("manual")}
                            className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${inputMode === "manual"
                                ? "bg-purple-600 text-white"
                                : "text-gray-400 hover:text-white hover:bg-slate-700/50"
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Manual
                        </button>
                        <button
                            onClick={() => setInputMode("qr")}
                            className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${inputMode === "qr"
                                ? "bg-purple-600 text-white"
                                : "text-gray-400 hover:text-white hover:bg-slate-700/50"
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            Scan QR
                        </button>
                    </div>

                    {/* Manual Input Mode */}
                    {inputMode === "manual" && (
                        <form onSubmit={handleSubmit}>
                            {/* Address/Username Toggle */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setManualInputType("address");
                                        setError(null);
                                    }}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${manualInputType === "address"
                                        ? "bg-slate-700 text-white border border-purple-500/50"
                                        : "bg-slate-800/50 text-gray-400 border border-transparent hover:text-white"
                                        }`}
                                >
                                    Wallet Address
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setManualInputType("username");
                                        setError(null);
                                    }}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${manualInputType === "username"
                                        ? "bg-slate-700 text-white border border-purple-500/50"
                                        : "bg-slate-800/50 text-gray-400 border border-transparent hover:text-white"
                                        }`}
                                >
                                    Username
                                </button>
                            </div>

                            {/* Address Input */}
                            {manualInputType === "address" && (
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Recipient Address
                                    </label>
                                    <input
                                        type="text"
                                        value={toAddress}
                                        onChange={(e) => {
                                            setToAddress(e.target.value);
                                            setError(null);
                                        }}
                                        placeholder="0x..."
                                        className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono text-sm"
                                        disabled={isLoading}
                                    />
                                </div>
                            )}

                            {/* Username Input */}
                            {manualInputType === "username" && (
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Recipient Username
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => {
                                                setUsername(e.target.value);
                                                setError(null);
                                                setResolvedAddress(null);
                                            }}
                                            placeholder="username"
                                            className="w-full pl-10 pr-12 py-3 bg-slate-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                                            disabled={isLoading}
                                        />
                                        {isResolvingUsername && (
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2">
                                                <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                            </span>
                                        )}
                                        {!isResolvingUsername && resolvedAddress && (
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2">
                                                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </span>
                                        )}
                                    </div>
                                    {resolvedAddress && (
                                        <p className="mt-2 text-xs text-gray-400 font-mono truncate">
                                            → {resolvedAddress}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Error Display */}
                            {error && (
                                <p className="mb-4 text-sm text-red-400">{error}</p>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isLoading}
                                    className="flex-1 py-3 px-4 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!canSubmit()}
                                    className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Transferring...
                                        </>
                                    ) : (
                                        "Transfer"
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* QR Scan Mode */}
                    {inputMode === "qr" && (
                        <div className="bg-slate-800/30 rounded-xl p-4">
                            {scannedAddress ? (
                                /* Scanned Address Confirmation */
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-white">QR Code Scanned</h3>
                                        <button
                                            onClick={handleClearScannedAddress}
                                            className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Success indicator */}
                                    <div className="flex items-center justify-center py-4">
                                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                                            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Scanned Address Display */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">
                                            Recipient Address
                                        </label>
                                        <div className="px-4 py-3 bg-slate-900 border border-white/10 rounded-lg">
                                            <p className="text-white font-mono text-sm break-all">{scannedAddress}</p>
                                        </div>
                                    </div>

                                    {error && (
                                        <p className="text-sm text-red-400 text-center">{error}</p>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={handleClearScannedAddress}
                                            disabled={isLoading}
                                            className="flex-1 py-3 px-4 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            Scan Again
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleQRTransfer}
                                            disabled={isLoading || !isAddress(scannedAddress)}
                                            className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    Transferring...
                                                </>
                                            ) : (
                                                "Transfer"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* QR Scanner */
                                <>
                                    <WalletQRScanner
                                        onScanSuccess={handleQRScanSuccess}
                                        onError={handleQRError}
                                        onClose={() => setInputMode("manual")}
                                    />
                                    {error && (
                                        <p className="mt-3 text-sm text-red-400 text-center">{error}</p>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

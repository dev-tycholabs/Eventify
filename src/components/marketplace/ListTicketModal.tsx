"use client";

import { useState, useEffect } from "react";
import { formatEther, parseEther } from "viem";

interface ListTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (price: bigint) => Promise<void>;
    tokenId: bigint;
    eventName: string;
    originalPrice?: bigint;
    maxResalePrice?: bigint;
    isLoading?: boolean;
}

export function ListTicketModal({
    isOpen,
    onClose,
    onSubmit,
    tokenId,
    eventName,
    originalPrice,
    maxResalePrice,
    isLoading = false,
}: ListTicketModalProps) {
    const [priceInput, setPriceInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [showPriceCapWarning, setShowPriceCapWarning] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setPriceInput("");
            setError(null);
            setShowPriceCapWarning(false);
        }
    }, [isOpen]);

    // Validate price against cap
    useEffect(() => {
        if (!priceInput || !maxResalePrice) {
            setShowPriceCapWarning(false);
            return;
        }

        try {
            const priceWei = parseEther(priceInput);
            setShowPriceCapWarning(priceWei > maxResalePrice);
        } catch {
            setShowPriceCapWarning(false);
        }
    }, [priceInput, maxResalePrice]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!priceInput || parseFloat(priceInput) <= 0) {
            setError("Please enter a valid price");
            return;
        }

        try {
            const priceWei = parseEther(priceInput);

            if (maxResalePrice && priceWei > maxResalePrice) {
                setError(`Price exceeds maximum allowed (${formatEther(maxResalePrice)} XTZ)`);
                return;
            }

            await onSubmit(priceWei);
        } catch {
            setError("Invalid price format");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white mb-1">List Ticket for Sale</h2>
                    <p className="text-gray-400 text-sm">Set your price and list on the marketplace</p>
                </div>

                {/* Ticket Info */}
                <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600/30 to-pink-600/30 flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-white font-medium">{eventName}</p>
                            <p className="text-gray-400 text-sm">Ticket #{tokenId.toString()}</p>
                        </div>
                    </div>
                    {originalPrice && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-xs text-gray-500">Original Price</p>
                            <p className="text-white font-medium">{formatEther(originalPrice)} XTZ</p>
                        </div>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="price" className="block text-sm font-medium text-gray-300 mb-2">
                            Listing Price (XTZ)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                id="price"
                                step="0.001"
                                min="0"
                                value={priceInput}
                                onChange={(e) => setPriceInput(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                                disabled={isLoading}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                                XTZ
                            </span>
                        </div>
                    </div>

                    {/* Price Cap Warning */}
                    {showPriceCapWarning && maxResalePrice && (
                        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                            <div className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <p className="text-orange-400 text-sm font-medium">Price exceeds cap</p>
                                    <p className="text-orange-400/80 text-xs mt-0.5">
                                        Maximum allowed: {formatEther(maxResalePrice)} XTZ
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Info */}
                    <div className="mb-6 text-xs text-gray-500">
                        <p>By listing, you approve the marketplace to transfer this ticket when sold.</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 py-3 px-4 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || showPriceCapWarning}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Listing...
                                </span>
                            ) : (
                                "List for Sale"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { formatEther } from "viem";
import {
    CONTRACT_ADDRESSES,
    RoyaltySplitterABI,
    TicketMarketplaceABI,
} from "@/hooks/contracts";
import { txToast } from "@/utils/toast";

const NATIVE_CURRENCY = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa" as const;

interface RoyaltyRecipientData {
    id: string;
    recipient_address: string;
    recipient_name: string | null;
    percentage: number;
    royalty_earned: string;
    royalty_claimed: string;
}

interface DistributionLog {
    id: string;
    tx_hash: string;
    action: string;
    total_distributed: string;
    triggered_by: string;
    recipients: { address: string; percentage: number; amount_distributed: string }[];
    created_at: string;
}

interface RoyaltySplitterPanelProps {
    eventId: string;
    eventContractAddress: `0x${string}`;
    organizerAddress: string;
    splitterAddress: string | null;
    recipients: RoyaltyRecipientData[];
    onDistributionSynced?: () => void;
}

// Sub-component for direct organizer claim (no splitter)
function DirectClaimPanel({
    eventId,
    organizerAddress,
    onDistributionSynced,
}: {
    eventId: string;
    organizerAddress: string;
    onDistributionSynced?: () => void;
}) {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();

    const [marketplaceClaimable, setMarketplaceClaimable] = useState<bigint>(BigInt(0));
    const [isClaiming, setIsClaiming] = useState(false);
    const [isLoadingChain, setIsLoadingChain] = useState(false);
    const [distributions, setDistributions] = useState<DistributionLog[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [totalClaimed, setTotalClaimed] = useState<bigint>(BigInt(0));

    const organizerAddr = organizerAddress as `0x${string}`;

    // Fetch claimable balance from marketplace for the organizer
    const fetchClaimable = useCallback(async () => {
        if (!publicClient) return;

        setIsLoadingChain(true);
        try {
            let claimable = BigInt(0);
            try {
                claimable = await publicClient.readContract({
                    address: CONTRACT_ADDRESSES.TicketMarketplace,
                    abi: TicketMarketplaceABI,
                    functionName: "claimableFunds",
                    args: [organizerAddr, NATIVE_CURRENCY],
                }) as bigint;
            } catch {
                // No claimable funds
            }
            setMarketplaceClaimable(claimable);
        } catch (err) {
            console.error("Failed to fetch claimable balance:", err);
        } finally {
            setIsLoadingChain(false);
        }
    }, [publicClient, organizerAddr]);

    // Fetch distribution history and total claimed from Supabase
    const fetchDistributions = useCallback(async () => {
        if (!eventId) return;
        try {
            const res = await fetch(`/api/events/${eventId}/royalties`);
            if (res.ok) {
                const { distributions: data } = await res.json();
                setDistributions(data || []);
                // Sum up total_distributed from all direct_claim entries
                const total = (data || [])
                    .filter((d: DistributionLog) => d.action === "direct_claim")
                    .reduce((sum: bigint, d: DistributionLog) => sum + BigInt(d.total_distributed), BigInt(0));
                setTotalClaimed(total);
            }
        } catch (err) {
            console.error("Failed to fetch distribution history:", err);
        }
    }, [eventId]);

    useEffect(() => {
        fetchClaimable();
    }, [fetchClaimable]);

    useEffect(() => {
        fetchDistributions();
    }, [fetchDistributions]);

    const handleDirectClaim = async () => {
        if (!address) return;

        setIsClaiming(true);
        try {
            // Snapshot the claimable amount before the tx
            const claimedAmount = marketplaceClaimable;

            txToast.pending("Claiming royalties from marketplace...");
            const hash = await writeContractAsync({
                address: CONTRACT_ADDRESSES.TicketMarketplace,
                abi: TicketMarketplaceABI,
                functionName: "claimFunds",
                args: [NATIVE_CURRENCY],
            });

            // Wait for confirmation
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
            }

            // Sync to Supabase
            try {
                await fetch(`/api/events/${eventId}/royalties`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tx_hash: hash,
                        action: "direct_claim",
                        triggered_by: address,
                        organizer_address: organizerAddress,
                        claimed_amount: claimedAmount.toString(),
                    }),
                });
            } catch (err) {
                console.error("Failed to sync to Supabase:", err);
                txToast.error("Claim succeeded on-chain but failed to sync to database");
            }

            txToast.success("Royalties claimed successfully!");
            await fetchClaimable();
            await fetchDistributions();
            onDistributionSynced?.();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("User rejected") || msg.includes("user rejected")) {
                txToast.error("Transaction was rejected");
            } else {
                txToast.error("Failed to claim royalties");
                console.error(err);
            }
        } finally {
            setIsClaiming(false);
        }
    };

    const hasMarketplaceFunds = marketplaceClaimable > BigInt(0);
    const totalEarned = marketplaceClaimable + totalClaimed;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Unclaimed in Marketplace</p>
                    <p className={`text-lg font-semibold ${hasMarketplaceFunds ? "text-yellow-400" : "text-gray-400"}`}>
                        {isLoadingChain ? (
                            <span className="inline-block w-20 h-5 bg-slate-700/50 rounded animate-pulse" />
                        ) : (
                            `${formatEther(marketplaceClaimable)} XTZ`
                        )}
                    </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Total Earned</p>
                    <p className="text-lg font-semibold text-green-400">
                        {isLoadingChain ? (
                            <span className="inline-block w-20 h-5 bg-slate-700/50 rounded animate-pulse" />
                        ) : (
                            `${formatEther(totalEarned)} XTZ`
                        )}
                    </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Total Claimed</p>
                    <p className="text-lg font-semibold text-cyan-400">
                        {formatEther(totalClaimed)} XTZ
                    </p>
                </div>
            </div>

            {/* Recipient Info */}
            <div className="bg-slate-800/50 rounded-xl border border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                    <h3 className="text-sm font-medium text-white">Royalty Recipient</h3>
                </div>
                <div className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-mono truncate">{organizerAddress}</p>
                        <p className="text-xs text-gray-500 mt-1">
                            Share: 100% (Organizer)
                        </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-green-400">
                            {isLoadingChain ? (
                                <span className="inline-block w-16 h-4 bg-slate-700/50 rounded animate-pulse" />
                            ) : (
                                `${formatEther(totalEarned)} XTZ`
                            )}
                            <span className="text-xs text-gray-500 ml-1">earned</span>
                        </p>
                        <p className="text-xs text-cyan-400">
                            {formatEther(totalClaimed)} XTZ
                            <span className="text-gray-500 ml-1">claimed</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Claim Button */}
            <button
                onClick={handleDirectClaim}
                disabled={isClaiming || !hasMarketplaceFunds}
                className={`w-full px-6 py-3 font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${hasMarketplaceFunds
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500"
                    : "bg-slate-700/50 text-gray-500 cursor-not-allowed"
                    } disabled:opacity-50`}
            >
                {isClaiming ? (
                    <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Claiming...
                    </>
                ) : (
                    "Claim Royalties from Marketplace"
                )}
            </button>

            {/* Distribution History */}
            {distributions.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl border border-white/10 overflow-hidden">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition-colors"
                    >
                        <h3 className="text-sm font-medium text-white">
                            Claim History ({distributions.length})
                        </h3>
                        <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {showHistory && (
                        <div className="divide-y divide-white/5">
                            {distributions.map((d) => (
                                <div key={d.id} className="px-6 py-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-gray-500">
                                            {new Date(d.created_at).toLocaleString()}
                                        </span>
                                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                                            Direct Claim
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <a
                                            href={`https://shadownet.explorer.etherlink.com/tx/${d.tx_hash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-purple-400 hover:text-purple-300 font-mono"
                                        >
                                            {d.tx_hash.slice(0, 10)}...{d.tx_hash.slice(-8)}
                                        </a>
                                        <span className="text-sm font-semibold text-green-400">
                                            {formatEther(BigInt(d.total_distributed))} XTZ
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* How it works info */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-5">
                <div className="flex gap-3">
                    <svg className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h4 className="text-sm font-medium text-purple-400 mb-1">How direct royalty claims work</h4>
                        <p className="text-xs text-purple-400/70">
                            Since no royalty split is configured, all secondary sale royalties accumulate in the marketplace
                            under your organizer address. Click the claim button to withdraw them directly to your wallet.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function RoyaltySplitterPanel({
    eventId,
    eventContractAddress,
    organizerAddress,
    splitterAddress,
    recipients,
    onDistributionSynced,
}: RoyaltySplitterPanelProps) {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();

    const [marketplaceClaimable, setMarketplaceClaimable] = useState<bigint>(BigInt(0));
    const [splitterBalance, setSplitterBalance] = useState<bigint>(BigInt(0));
    const [isClaiming, setIsClaiming] = useState(false);
    const [isDistributing, setIsDistributing] = useState(false);
    const [isLoadingChain, setIsLoadingChain] = useState(false);
    const [distributions, setDistributions] = useState<DistributionLog[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    const hasSplitter = !!splitterAddress && splitterAddress !== "0x0000000000000000000000000000000000000000";
    const splitterAddr = splitterAddress as `0x${string}` | null;

    // Fetch on-chain balances
    const fetchOnChainBalances = useCallback(async () => {
        if (!publicClient || !hasSplitter || !splitterAddr) return;

        setIsLoadingChain(true);
        try {
            const balance = await publicClient.getBalance({ address: splitterAddr });
            setSplitterBalance(balance);

            let claimable = BigInt(0);
            try {
                claimable = await publicClient.readContract({
                    address: CONTRACT_ADDRESSES.TicketMarketplace,
                    abi: [
                        {
                            inputs: [
                                { internalType: "address", name: "user", type: "address" },
                                { internalType: "address", name: "currency", type: "address" },
                            ],
                            name: "claimableFunds",
                            outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
                            stateMutability: "view",
                            type: "function",
                        },
                    ],
                    functionName: "claimableFunds",
                    args: [splitterAddr, NATIVE_CURRENCY],
                }) as bigint;
            } catch {
                // Marketplace might not have any claimable funds
            }
            setMarketplaceClaimable(claimable);
        } catch (err) {
            console.error("Failed to fetch on-chain balances:", err);
        } finally {
            setIsLoadingChain(false);
        }
    }, [publicClient, hasSplitter, splitterAddr]);

    // Fetch distribution history from Supabase
    const fetchDistributions = useCallback(async () => {
        if (!eventId) return;
        try {
            const res = await fetch(`/api/events/${eventId}/royalties`);
            if (res.ok) {
                const { distributions: data } = await res.json();
                setDistributions(data || []);
            }
        } catch (err) {
            console.error("Failed to fetch distribution history:", err);
        }
    }, [eventId]);

    useEffect(() => {
        fetchOnChainBalances();
    }, [fetchOnChainBalances]);

    useEffect(() => {
        if (hasSplitter) fetchDistributions();
    }, [hasSplitter, fetchDistributions]);

    // Wait for tx confirmation, read released() for each recipient, and sync to Supabase
    const syncDistributionToSupabase = async (txHash: `0x${string}`, action: "claim_and_distribute" | "distribute") => {
        if (!publicClient || !splitterAddr || !address) return;

        try {
            // Wait for the transaction to be mined before reading updated state
            await publicClient.waitForTransactionReceipt({ hash: txHash });

            // Read released(address) for each recipient from the splitter contract
            const recipientReleased = await Promise.all(
                recipients.map(async (r) => {
                    const released = await publicClient.readContract({
                        address: splitterAddr,
                        abi: RoyaltySplitterABI,
                        functionName: "released",
                        args: [r.recipient_address as `0x${string}`],
                    }) as bigint;
                    return { address: r.recipient_address, released: released.toString() };
                })
            );

            await fetch(`/api/events/${eventId}/royalties`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tx_hash: txHash,
                    action,
                    triggered_by: address,
                    splitter_address: splitterAddr,
                    recipients: recipientReleased,
                }),
            });

            // Refresh distribution history and notify parent
            await fetchDistributions();
            onDistributionSynced?.();
        } catch (err) {
            console.error("Failed to sync distribution to Supabase:", err);
            txToast.error("Distribution succeeded on-chain but failed to sync to database");
        }
    };

    const handleClaimAndDistribute = async () => {
        if (!splitterAddr) return;

        setIsClaiming(true);
        try {
            txToast.pending("Claiming royalties from marketplace and distributing...");
            const hash = await writeContractAsync({
                address: splitterAddr,
                abi: RoyaltySplitterABI,
                functionName: "claimAndDistribute",
                args: [CONTRACT_ADDRESSES.TicketMarketplace, NATIVE_CURRENCY],
            });

            // Sync on-chain state to Supabase (waits for tx confirmation internally)
            await syncDistributionToSupabase(hash, "claim_and_distribute");
            txToast.success("Royalties claimed and distributed!");
            await fetchOnChainBalances();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("User rejected") || msg.includes("user rejected")) {
                txToast.error("Transaction was rejected");
            } else {
                txToast.error("Failed to claim and distribute");
                console.error(err);
            }
        } finally {
            setIsClaiming(false);
        }
    };

    const handleDistribute = async () => {
        if (!splitterAddr) return;

        setIsDistributing(true);
        try {
            txToast.pending("Distributing royalties to recipients...");
            const hash = await writeContractAsync({
                address: splitterAddr,
                abi: RoyaltySplitterABI,
                functionName: "distribute",
            });

            // Sync on-chain state to Supabase (waits for tx confirmation internally)
            await syncDistributionToSupabase(hash, "distribute");
            txToast.success("Royalties distributed!");
            await fetchOnChainBalances();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("User rejected") || msg.includes("user rejected")) {
                txToast.error("Transaction was rejected");
            } else {
                txToast.error("Failed to distribute");
                console.error(err);
            }
        } finally {
            setIsDistributing(false);
        }
    };

    // No splitter — organizer claims directly from marketplace
    if (!hasSplitter || recipients.length === 0) {
        return (
            <DirectClaimPanel
                eventId={eventId}
                organizerAddress={organizerAddress}
                onDistributionSynced={onDistributionSynced}
            />
        );
    }

    // Compute totals from DB data
    const totalRoyaltyEarned = recipients.reduce(
        (sum, r) => sum + BigInt(r.royalty_earned || "0"),
        BigInt(0)
    );
    const totalRoyaltyClaimed = recipients.reduce(
        (sum, r) => sum + BigInt(r.royalty_claimed || "0"),
        BigInt(0)
    );
    const hasMarketplaceFunds = marketplaceClaimable > BigInt(0);
    const hasSplitterBalance = splitterBalance > BigInt(0);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Unclaimed in Marketplace</p>
                    <p className={`text-lg font-semibold ${hasMarketplaceFunds ? "text-yellow-400" : "text-gray-400"}`}>
                        {isLoadingChain ? (
                            <span className="inline-block w-20 h-5 bg-slate-700/50 rounded animate-pulse" />
                        ) : (
                            `${formatEther(marketplaceClaimable)} XTZ`
                        )}
                    </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Splitter Balance</p>
                    <p className={`text-lg font-semibold ${hasSplitterBalance ? "text-purple-400" : "text-gray-400"}`}>
                        {isLoadingChain ? (
                            <span className="inline-block w-20 h-5 bg-slate-700/50 rounded animate-pulse" />
                        ) : (
                            `${formatEther(splitterBalance)} XTZ`
                        )}
                    </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Total Earned</p>
                    <p className="text-lg font-semibold text-green-400">
                        {formatEther(totalRoyaltyEarned)} XTZ
                    </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Total Claimed</p>
                    <p className="text-lg font-semibold text-cyan-400">
                        {formatEther(totalRoyaltyClaimed)} XTZ
                    </p>
                </div>
            </div>

            {/* Recipients Table */}
            <div className="bg-slate-800/50 rounded-xl border border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                    <h3 className="text-sm font-medium text-white">Royalty Recipients</h3>
                </div>
                <div className="divide-y divide-white/5">
                    {recipients.map((r) => (
                        <div key={r.id} className="px-6 py-4 flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm text-white font-mono truncate">{r.recipient_address}</p>
                                    {r.recipient_name && (
                                        <span className="text-xs text-gray-500 bg-slate-700/50 px-2 py-0.5 rounded">
                                            {r.recipient_name}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Share: {r.percentage}%
                                </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-sm font-semibold text-green-400">
                                    {formatEther(BigInt(r.royalty_earned || "0"))} XTZ
                                    <span className="text-xs text-gray-500 ml-1">earned</span>
                                </p>
                                <p className="text-xs text-cyan-400">
                                    {formatEther(BigInt(r.royalty_claimed || "0"))} XTZ
                                    <span className="text-gray-500 ml-1">claimed</span>
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Splitter Contract Info */}
            {splitterAddr && (
                <div className="bg-slate-800/50 rounded-xl p-5 border border-white/10">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Splitter Contract</span>
                        <a
                            href={`https://shadownet.explorer.etherlink.com/address/${splitterAddr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-purple-400 hover:text-purple-300 font-mono flex items-center gap-1"
                        >
                            {splitterAddr.slice(0, 10)}...{splitterAddr.slice(-8)}
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    onClick={handleClaimAndDistribute}
                    disabled={isClaiming || !hasMarketplaceFunds}
                    className={`flex-1 px-6 py-3 font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${hasMarketplaceFunds
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500"
                        : "bg-slate-700/50 text-gray-500 cursor-not-allowed"
                        } disabled:opacity-50`}
                >
                    {isClaiming ? (
                        <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Claiming...
                        </>
                    ) : (
                        "Claim & Distribute from Marketplace"
                    )}
                </button>
                <button
                    onClick={handleDistribute}
                    disabled={isDistributing || !hasSplitterBalance}
                    className={`flex-1 px-6 py-3 font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${hasSplitterBalance
                        ? "bg-slate-700 text-white hover:bg-slate-600"
                        : "bg-slate-700/50 text-gray-500 cursor-not-allowed"
                        } disabled:opacity-50`}
                >
                    {isDistributing ? (
                        <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Distributing...
                        </>
                    ) : (
                        "Distribute Splitter Balance"
                    )}
                </button>
            </div>

            {/* Distribution History */}
            {distributions.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl border border-white/10 overflow-hidden">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition-colors"
                    >
                        <h3 className="text-sm font-medium text-white">
                            Distribution History ({distributions.length})
                        </h3>
                        <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {showHistory && (
                        <div className="divide-y divide-white/5">
                            {distributions.map((d) => (
                                <div key={d.id} className="px-6 py-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-gray-500">
                                            {new Date(d.created_at).toLocaleString()}
                                        </span>
                                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                                            {d.action === "claim_and_distribute" ? "Claim & Distribute" : "Distribute"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <a
                                            href={`https://shadownet.explorer.etherlink.com/tx/${d.tx_hash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-purple-400 hover:text-purple-300 font-mono"
                                        >
                                            {d.tx_hash.slice(0, 10)}...{d.tx_hash.slice(-8)}
                                        </a>
                                        <span className="text-sm font-semibold text-green-400">
                                            {formatEther(BigInt(d.total_distributed))} XTZ
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* How it works info */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-5">
                <div className="flex gap-3">
                    <svg className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h4 className="text-sm font-medium text-purple-400 mb-1">How royalty splitting works</h4>
                        <p className="text-xs text-purple-400/70">
                            When tickets are resold on the marketplace, royalties accumulate under the splitter contract.
                            Anyone can trigger distribution — funds are automatically split based on each recipient&apos;s configured share percentage.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useSupabase } from "@/hooks/useSupabase";
import { useMarketplace } from "@/hooks/useMarketplace";
import { QRCodeModal } from "./QRCodeModal";
import { notify } from "@/utils/toast";

interface ProfileData {
    name: string;
    email: string;
    contact_number: string;
    username: string;
}

export function ProfileForm() {
    const { address, isConnected } = useAccount();
    const { getUser, saveUser, isLoading } = useSupabase();
    const { claimFunds, getClaimableBalance, isLoading: isClaimLoading } = useMarketplace();

    const [formData, setFormData] = useState<ProfileData>({
        name: "",
        email: "",
        contact_number: "",
        username: "",
    });
    const [originalUsername, setOriginalUsername] = useState("");
    const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
    const [showQR, setShowQR] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [claimableBalance, setClaimableBalance] = useState<bigint>(BigInt(0));
    const [loadingBalance, setLoadingBalance] = useState(false);

    // Load claimable balance
    const loadClaimableBalance = useCallback(async () => {
        if (!address) return;
        setLoadingBalance(true);
        try {
            const balance = await getClaimableBalance();
            setClaimableBalance(balance);
        } catch (err) {
            console.error("Failed to load claimable balance:", err);
        } finally {
            setLoadingBalance(false);
        }
    }, [address, getClaimableBalance]);

    useEffect(() => {
        if (isConnected && address) {
            loadClaimableBalance();
        }
    }, [isConnected, address, loadClaimableBalance]);

    // Load existing profile
    useEffect(() => {
        async function loadProfile() {
            if (!address) {
                setLoadingProfile(false);
                return;
            }

            const user = await getUser(address);
            if (user) {
                setFormData({
                    name: user.name || "",
                    email: user.email || "",
                    contact_number: user.contact_number || "",
                    username: user.username || "",
                });
                setOriginalUsername(user.username || "");
            }
            setLoadingProfile(false);
        }
        loadProfile();
    }, [address, getUser]);

    // Check username availability with debounce
    const checkUsername = useCallback(async (username: string) => {
        if (!username || username === originalUsername) {
            setUsernameStatus("idle");
            return;
        }

        setUsernameStatus("checking");
        try {
            const res = await fetch(
                `/api/users/check-username?username=${encodeURIComponent(username)}&currentAddress=${address}`
            );
            const data = await res.json();
            setUsernameStatus(data.available ? "available" : "taken");
        } catch {
            setUsernameStatus("idle");
        }
    }, [address, originalUsername]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (formData.username && formData.username !== originalUsername) {
                checkUsername(formData.username);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [formData.username, checkUsername, originalUsername]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleClaimFunds = async () => {
        const result = await claimFunds();
        if (result.success) {
            // Refresh balance after successful claim
            await loadClaimableBalance();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (usernameStatus === "taken") {
            notify.error("Username is already taken");
            return;
        }

        const user = await saveUser({
            username: formData.username || undefined,
            email: formData.email || undefined,
            name: formData.name || undefined,
            contact_number: formData.contact_number || undefined,
        });

        if (user) {
            notify.success("Profile saved successfully!");
            setOriginalUsername(formData.username);
            setUsernameStatus("idle");
        }
    };

    if (!isConnected) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
                    <p className="text-gray-400">Please connect your wallet to view and edit your profile</p>
                </div>
            </div>
        );
    }

    if (loadingProfile) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header with QR Button */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">My Profile</h1>
                    <p className="text-gray-400 mt-1">Manage your personal information</p>
                </div>
                <button
                    onClick={() => setShowQR(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-300 border border-white/10 cursor-pointer"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Show My QR
                </button>
            </div>

            {/* Wallet Address Display */}
            <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/10">
                <label className="block text-sm font-medium text-gray-400 mb-2">Wallet Address</label>
                <div className="flex items-center gap-3">
                    <code className="flex-1 text-white font-mono text-sm bg-black/30 px-4 py-2 rounded-lg truncate">
                        {address}
                    </code>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(address || "");
                            notify.success("Address copied!");
                        }}
                        className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Claimable Funds Section */}
            <div className="mb-8 p-6 bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-xl border border-green-500/20">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Marketplace Earnings
                        </h3>
                        <p className="text-gray-400 text-sm mt-1">
                            Funds from your ticket sales on the marketplace
                        </p>
                    </div>
                    <div className="text-right">
                        {loadingBalance ? (
                            <div className="animate-pulse bg-white/10 h-8 w-24 rounded" />
                        ) : (
                            <p className="text-2xl font-bold text-green-400">
                                {(Number(claimableBalance) / 1e18).toFixed(4)} XTZ
                            </p>
                        )}
                    </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                    <button
                        onClick={handleClaimFunds}
                        disabled={isClaimLoading || claimableBalance === BigInt(0)}
                        className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {isClaimLoading ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Claiming...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Claim Funds
                            </>
                        )}
                    </button>
                    <button
                        onClick={loadClaimableBalance}
                        disabled={loadingBalance}
                        className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-300 cursor-pointer"
                        title="Refresh balance"
                    >
                        <svg className={`w-5 h-5 ${loadingBalance ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
                {claimableBalance === BigInt(0) && !loadingBalance && (
                    <p className="text-gray-500 text-sm mt-3 text-center">
                        No funds to claim. Sell tickets on the marketplace to earn!
                    </p>
                )}
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Username */}
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                        Username
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="your_username"
                            className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                        {usernameStatus !== "idle" && (
                            <span className="absolute right-4 top-1/2 -translate-y-1/2">
                                {usernameStatus === "checking" && (
                                    <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                )}
                                {usernameStatus === "available" && (
                                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                {usernameStatus === "taken" && (
                                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </span>
                        )}
                    </div>
                    {usernameStatus === "taken" && (
                        <p className="mt-1 text-sm text-red-400">This username is already taken</p>
                    )}
                    {usernameStatus === "available" && (
                        <p className="mt-1 text-sm text-green-400">Username is available!</p>
                    )}
                </div>

                {/* Name */}
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                        Full Name
                    </label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="John Doe"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                </div>

                {/* Email */}
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                        Email Address
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="john@example.com"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                </div>

                {/* Contact Number */}
                <div>
                    <label htmlFor="contact_number" className="block text-sm font-medium text-gray-300 mb-2">
                        Contact Number
                    </label>
                    <input
                        type="tel"
                        id="contact_number"
                        name="contact_number"
                        value={formData.contact_number}
                        onChange={handleChange}
                        placeholder="+1 234 567 8900"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading || usernameStatus === "taken"}
                    className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-purple-500/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                    {isLoading ? (
                        <>
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Saving...
                        </>
                    ) : (
                        "Save Profile"
                    )}
                </button>
            </form>

            {/* QR Code Modal */}
            <QRCodeModal
                isOpen={showQR}
                onClose={() => setShowQR(false)}
                walletAddress={address || ""}
                username={formData.username}
            />
        </div>
    );
}

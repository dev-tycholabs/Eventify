"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useCircleAuth } from "./providers/CircleAuthProvider";
import { notify } from "@/utils/toast";

interface CircleLoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Step = "email" | "otp" | "wallet" | "done";

export function CircleLoginModal({ isOpen, onClose }: CircleLoginModalProps) {
    const [email, setEmail] = useState("");
    const [step, setStep] = useState<Step>("email");
    const [loading, setLoading] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    const {
        circleUserToken,
        loginWithEmail,
        verifyOtp,
        createWallet,
        executeChallenge,
        circleLogin,
    } = useCircleAuth();

    useEffect(() => {
        if (circleUserToken && step === "otp") {
            setStep("wallet");
        }
    }, [circleUserToken, step]);

    const handleSendOtp = useCallback(async () => {
        if (!email) return;
        setLoading(true);
        try {
            await loginWithEmail(email);
            setStep("otp");
            notify.success("OTP sent! Check your email.");
        } catch {
            notify.error("Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [email, loginWithEmail]);

    const handleVerifyOtp = useCallback(() => {
        verifyOtp();
    }, [verifyOtp]);

    const pollLogin = useCallback(async (maxAttempts = 10, interval = 3000): Promise<boolean> => {
        for (let i = 0; i < maxAttempts; i++) {
            const success = await circleLogin();
            if (success) return true;
            if (i < maxAttempts - 1) {
                await new Promise((r) => setTimeout(r, interval));
            }
        }
        return false;
    }, [circleLogin]);

    const handleCreateWallet = useCallback(async () => {
        setLoading(true);
        try {
            const challengeId = await createWallet();
            if (challengeId) {
                executeChallenge(challengeId);
                // Poll for wallet readiness instead of a fixed timeout
                const success = await pollLogin(10, 3000);
                if (success) {
                    setStep("done");
                    notify.success("Wallet created! You're logged in.");
                    onClose();
                } else {
                    notify.error("Wallet setup is taking longer than expected. Please try signing in again.");
                }
                setLoading(false);
            } else {
                // No challengeId means wallet already exists, just login
                const success = await circleLogin();
                if (success) {
                    setStep("done");
                    notify.success("Logged in with Circle wallet!");
                    onClose();
                }
                setLoading(false);
            }
        } catch {
            notify.error("Failed to create wallet.");
            setLoading(false);
        }
    }, [createWallet, executeChallenge, circleLogin, pollLogin, onClose]);

    const handleTryLogin = useCallback(async () => {
        setLoading(true);
        try {
            const success = await circleLogin();
            if (success) {
                setStep("done");
                notify.success("Logged in with Circle wallet!");
                onClose();
            } else {
                handleCreateWallet();
            }
        } catch {
            setLoading(false);
        }
    }, [circleLogin, onClose, handleCreateWallet]);

    useEffect(() => {
        if (step === "wallet" && circleUserToken) {
            handleTryLogin();
        }
    }, [step, circleUserToken, handleTryLogin]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setStep("email");
            setEmail("");
            setLoading(false);
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
        >
            {/* Backdrop */}
            <div
                onClick={onClose}
                aria-hidden="true"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
            />

            {/* Modal container */}
            <div
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
            >
                <div
                    ref={modalRef}
                    className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden"
                >
                    {/* Gradient accent bar */}
                    <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />

                    <div className="p-6">
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            aria-label="Close modal"
                        >
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Icon */}
                        <div className="flex justify-center mb-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                </svg>
                            </div>
                        </div>

                        {/* Header */}
                        <div className="text-center mb-6">
                            <h2 id="modal-title" className="text-lg font-semibold text-white mb-1">
                                {step === "email" && "Sign in with Email"}
                                {step === "otp" && "Verify your email"}
                                {step === "wallet" && "Setting up wallet"}
                                {step === "done" && "You're in!"}
                            </h2>
                            <p className="text-sm text-gray-400">
                                {step === "email" && "Enter your email to receive a one-time code."}
                                {step === "otp" && "We sent a verification code to your email."}
                                {step === "wallet" && "Please wait while we set up your wallet..."}
                                {step === "done" && "You're all set!"}
                            </p>
                        </div>

                        {/* Email step */}
                        {step === "email" && (
                            <div className="space-y-3">
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                                        autoFocus
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                                    />
                                </div>
                                <button
                                    onClick={handleSendOtp}
                                    disabled={!email || loading}
                                    className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Sending...
                                        </span>
                                    ) : "Send Code"}
                                </button>
                            </div>
                        )}

                        {/* OTP step */}
                        {step === "otp" && (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-300 text-center">
                                    Code sent to <span className="text-white font-medium">{email}</span>
                                </p>
                                <button
                                    onClick={handleVerifyOtp}
                                    disabled={loading}
                                    className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-purple-500/20"
                                >
                                    Enter Verification Code
                                </button>
                            </div>
                        )}

                        {/* Wallet setup step */}
                        {step === "wallet" && (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <svg
                                    className="w-8 h-8 text-purple-400 animate-spin"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <p className="text-sm text-gray-300">Setting up your wallet...</p>
                            </div>
                        )}

                        {/* Footer hint */}
                        {step === "email" && (
                            <p className="mt-4 text-xs text-gray-500 text-center">
                                Powered by Circle · No password needed
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

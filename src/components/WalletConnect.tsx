"use client";

import { useState } from "react";
import { CircleLoginModal } from "./CircleLoginModal";
import { useCircleAuth } from "./providers/CircleAuthProvider";

export function WalletConnect() {
    const [showCircleLogin, setShowCircleLogin] = useState(false);
    const { isCircleAuthenticated, circleWallets, circleLogout } = useCircleAuth();

    return (
        <>
            {isCircleAuthenticated && circleWallets.length > 0 ? (
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-white/10 rounded-full">
                        <span className="w-2 h-2 bg-green-400 rounded-full" />
                        {circleWallets[0].address.slice(0, 6)}...{circleWallets[0].address.slice(-4)}
                    </span>
                    <button
                        onClick={circleLogout}
                        type="button"
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-300 bg-white/10 rounded-full hover:bg-white/20 transition-all duration-300 cursor-pointer"
                    >
                        Sign Out
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setShowCircleLogin(true)}
                    type="button"
                    className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-full hover:from-purple-500 hover:to-pink-500 transition-all duration-300 shadow-lg hover:shadow-purple-500/25 cursor-pointer"
                >
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Sign In
                </button>
            )}

            <CircleLoginModal
                isOpen={showCircleLogin}
                onClose={() => setShowCircleLogin(false)}
            />
        </>
    );
}

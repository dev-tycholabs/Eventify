"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { VerificationForm } from "@/components/verify/VerificationForm";
import { VerificationResult } from "@/components/verify/VerificationResult";

export interface VerificationData {
    isValid: boolean;
    holder: `0x${string}` | null;
    isUsed: boolean;
    eventName?: string;
    eventVenue?: string;
    eventDate?: Date;
    tokenId: bigint;
    eventAddress: `0x${string}`;
    chainId: number;
}

interface QueryParams {
    contract: string | null;
    tokenId: string | null;
    event: string | null;
    chainId: string | null;
}

function VerifyPageContent() {
    const searchParams = useSearchParams();
    const [verificationResult, setVerificationResult] = useState<VerificationData | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [initialParams, setInitialParams] = useState<QueryParams | null>(null);

    // Extract query params on mount
    useEffect(() => {
        const contract = searchParams.get("contract");
        const tokenId = searchParams.get("tokenId");
        const event = searchParams.get("event");
        const chainId = searchParams.get("chainId");

        if (contract && tokenId) {
            setInitialParams({ contract, tokenId, event, chainId });
        }
    }, [searchParams]);

    const handleVerificationComplete = (result: VerificationData | null) => {
        setVerificationResult(result);
        setIsVerifying(false);
    };

    const handleReset = () => {
        setVerificationResult(null);
        setInitialParams(null);
    };

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Page Header */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                        <svg
                            className="w-8 h-8 text-purple-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Verify Ticket
                    </h1>
                    <p className="text-gray-400">
                        Scan a ticket QR code or enter details manually to verify authenticity
                    </p>
                </div>

                {/* Verification Content */}
                {verificationResult ? (
                    <VerificationResult
                        result={verificationResult}
                        onReset={handleReset}
                    />
                ) : (
                    <VerificationForm
                        onVerificationComplete={handleVerificationComplete}
                        isVerifying={isVerifying}
                        setIsVerifying={setIsVerifying}
                        initialParams={initialParams}
                    />
                )}
            </div>
        </div>
    );
}

export default function VerifyPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-900 pt-24 pb-12 flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
            </div>
        }>
            <VerifyPageContent />
        </Suspense>
    );
}

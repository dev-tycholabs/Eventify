"use client";

import { useEffect } from "react";
import { useWaitForTransactionReceipt } from "wagmi";
import { txToast } from "@/utils/toast";

interface TransactionStatusProps {
    hash: `0x${string}` | undefined;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
    pendingMessage?: string;
    successMessage?: string;
}

export function TransactionStatus({
    hash,
    onSuccess,
    onError,
    pendingMessage = "Transaction pending...",
    successMessage = "Transaction successful!",
}: TransactionStatusProps) {
    const { isLoading, isSuccess, isError, error } = useWaitForTransactionReceipt({
        hash,
    });

    useEffect(() => {
        if (hash && isLoading) {
            txToast.pending(pendingMessage);
        }
    }, [hash, isLoading, pendingMessage]);

    useEffect(() => {
        if (isSuccess) {
            txToast.success(successMessage);
            onSuccess?.();
        }
    }, [isSuccess, successMessage, onSuccess]);

    useEffect(() => {
        if (isError && error) {
            txToast.error(error.message || "Transaction failed");
            onError?.(error);
        }
    }, [isError, error, onError]);

    return null;
}

interface TransactionStatusDisplayProps {
    status: "idle" | "pending" | "success" | "error";
    hash?: `0x${string}`;
    error?: string;
    explorerUrl?: string;
}

export function TransactionStatusDisplay({
    status,
    hash,
    error,
    explorerUrl,
}: TransactionStatusDisplayProps) {
    if (status === "idle") return null;

    return (
        <div className={`p-4 rounded-lg ${status === "pending" ? "bg-yellow-50 border border-yellow-200" :
                status === "success" ? "bg-green-50 border border-green-200" :
                    "bg-red-50 border border-red-200"
            }`}>
            <div className="flex items-center gap-3">
                {status === "pending" && (
                    <>
                        <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-yellow-700">Transaction pending...</span>
                    </>
                )}
                {status === "success" && (
                    <>
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-700">Transaction successful!</span>
                    </>
                )}
                {status === "error" && (
                    <>
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-red-700">{error || "Transaction failed"}</span>
                    </>
                )}
            </div>
            {hash && explorerUrl && (
                <a
                    href={`${explorerUrl}/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-sm text-purple-600 hover:underline block"
                >
                    View on Explorer →
                </a>
            )}
        </div>
    );
}

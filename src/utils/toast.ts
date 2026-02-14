import toast from "react-hot-toast";
import { ErrorCode, type AppError } from "@/types/errors";

export const txToast = {
    pending: (message = "Transaction pending...") => {
        return toast.loading(message, {
            id: "tx-pending",
        });
    },

    success: (message = "Transaction successful!") => {
        toast.dismiss("tx-pending");
        return toast.success(message);
    },

    error: (error: AppError | string) => {
        toast.dismiss("tx-pending");
        const message = typeof error === "string" ? error : error.message;
        return toast.error(message);
    },

    dismiss: () => {
        toast.dismiss("tx-pending");
    },
};

export const notify = {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast(message, { icon: "ℹ️" }),
    warning: (message: string) => toast(message, { icon: "⚠️" }),
};

export function getErrorMessage(error: unknown): string {
    if (typeof error === "string") return error;

    if (error && typeof error === "object") {
        if ("message" in error && typeof error.message === "string") {
            const msg = error.message;

            // User rejection
            if (msg.includes("User rejected") || msg.includes("user rejected")) {
                return "Transaction was cancelled";
            }

            // Insufficient funds
            if (msg.includes("insufficient funds")) {
                return "Insufficient funds for this transaction";
            }

            // Network errors
            if (msg.includes("network") || msg.includes("Network")) {
                return "Network error. Please check your connection";
            }

            return msg;
        }
    }

    return "An unexpected error occurred";
}

export function handleTransactionError(error: unknown): AppError {
    const message = getErrorMessage(error);

    if (message.includes("cancelled") || message.includes("rejected")) {
        return { code: ErrorCode.TRANSACTION_REJECTED, message };
    }

    if (message.includes("Insufficient funds")) {
        return { code: ErrorCode.INSUFFICIENT_FUNDS, message };
    }

    if (message.includes("Network")) {
        return { code: ErrorCode.NETWORK_ERROR, message };
    }

    return { code: ErrorCode.TRANSACTION_FAILED, message };
}

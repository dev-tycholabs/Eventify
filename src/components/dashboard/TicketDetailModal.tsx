"use client";

import { useEffect, useState, useRef } from "react";
import { formatEther } from "viem";
import { downloadTicketAsPNG, downloadTicketAsPDF } from "@/utils/ticketDownload";
import toast from "react-hot-toast";
import QRCode from "qrcode";
import { TicketHistoryModal } from "./TicketHistoryModal";
import { useChainConfig } from "@/hooks/useChainConfig";

interface UserTicket {
    tokenId: bigint;
    eventContractAddress: `0x${string}`;
    eventName: string;
    eventDate: Date;
    venue: string;
    isUsed: boolean;
    isListed: boolean;
    ticketPrice: bigint;
}

interface TicketDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: UserTicket | null;
    onListForSale: () => void;
}

export function TicketDetailModal({
    isOpen,
    onClose,
    ticket,
    onListForSale,
}: TicketDetailModalProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
    const [showHistory, setShowHistory] = useState(false);
    const ticketRef = useRef<HTMLDivElement>(null);
    const { currencySymbol } = useChainConfig();

    // Generate real QR code using the qrcode library - contains URL to verify page
    useEffect(() => {
        if (!ticket) {
            setQrCodeDataUrl("");
            return;
        }

        const generateQR = async () => {
            // Build verify URL with query params for direct scanning
            const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
            const verifyUrl = `${baseUrl}/verify?contract=${ticket.eventContractAddress}&tokenId=${ticket.tokenId.toString()}&event=${encodeURIComponent(ticket.eventName)}`;

            try {
                const dataUrl = await QRCode.toDataURL(verifyUrl, {
                    width: 200,
                    margin: 1,
                    color: { dark: "#1e1b4b", light: "#ffffff" },
                });
                setQrCodeDataUrl(dataUrl);
            } catch (error) {
                console.error("Error generating QR code:", error);
            }
        };

        generateQR();
    }, [ticket]);

    const handleDownloadPNG = async () => {
        if (!ticket) return;
        setIsDownloading(true);
        try {
            const fileName = `ticket-${ticket.eventName.replace(/\s+/g, "-")}-${ticket.tokenId}`;
            await downloadTicketAsPNG("downloadable-ticket", fileName);
            toast.success("Ticket downloaded as PNG!");
        } catch (error) {
            console.error("Error downloading PNG:", error);
            toast.error("Failed to download ticket as PNG");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!ticket) return;
        setIsDownloading(true);
        try {
            const fileName = `ticket-${ticket.eventName.replace(/\s+/g, "-")}-${ticket.tokenId}`;
            await downloadTicketAsPDF("downloadable-ticket", fileName);
            toast.success("Ticket downloaded as PDF!");
        } catch (error) {
            console.error("Error downloading PDF:", error);
            toast.error("Failed to download ticket as PDF");
        } finally {
            setIsDownloading(false);
        }
    };

    if (!isOpen || !ticket) return null;

    const formattedDate = ticket.eventDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    const formattedTime = ticket.eventDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
    });

    const isPastEvent = ticket.eventDate < new Date();
    const canList = !ticket.isUsed && !ticket.isListed && !isPastEvent;

    const getStatusInfo = () => {
        if (ticket.isUsed) {
            return { label: "Used", color: "bg-gray-500", textColor: "text-gray-400" };
        }
        if (ticket.isListed) {
            return { label: "Listed for Sale", color: "bg-orange-500", textColor: "text-orange-400" };
        }
        if (isPastEvent) {
            return { label: "Event Passed", color: "bg-red-500", textColor: "text-red-400" };
        }
        return { label: "Valid", color: "bg-green-500", textColor: "text-green-400" };
    };

    const status = getStatusInfo();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg mx-4 shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Downloadable Ticket Section */}
                <div id="downloadable-ticket" ref={ticketRef} className="bg-slate-900">
                    {/* Header with gradient */}
                    <div className="relative h-32 bg-gradient-to-br from-purple-600/30 to-pink-600/30 flex items-center justify-center">
                        <svg
                            className="w-16 h-16 text-purple-400/70"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                            />
                        </svg>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Status Badge */}
                        <div className="flex items-center gap-2 mb-4">
                            <span className={`w-2 h-2 rounded-full ${status.color}`} />
                            <span className={`text-sm font-medium ${status.textColor}`}>
                                {status.label}
                            </span>
                        </div>

                        {/* Event Name */}
                        <h2 className="text-2xl font-bold text-white mb-1">{ticket.eventName}</h2>
                        <p className="text-gray-400 text-sm mb-6">Ticket #{ticket.tokenId.toString()}</p>

                        {/* Event Details */}
                        <div className="space-y-4 mb-6">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Date & Time</p>
                                    <p className="text-white font-medium">{formattedDate}</p>
                                    <p className="text-gray-400 text-sm">{formattedTime}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Venue</p>
                                    <p className="text-white font-medium">{ticket.venue}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Original Price</p>
                                    <p className="text-white font-medium">{formatEther(ticket.ticketPrice)} {currencySymbol}</p>
                                </div>
                            </div>
                        </div>

                        {/* QR Code for Event Entry */}
                        {!ticket.isUsed && !isPastEvent && qrCodeDataUrl && (
                            <div className="bg-white rounded-xl p-4 mb-6">
                                <div className="flex flex-col items-center">
                                    <img
                                        src={qrCodeDataUrl}
                                        alt="Ticket QR Code"
                                        className="w-48 h-48 mb-3"
                                    />
                                    <p className="text-gray-600 text-xs text-center">
                                        Scan this QR code at the event entrance
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Contract Info */}
                        <div className="bg-slate-800/50 rounded-lg p-4">
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Contract Address</p>
                            <p className="text-gray-300 text-sm font-mono break-all">
                                {ticket.eventContractAddress}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Download Buttons */}
                <div className="px-6 pb-4">
                    <div className="flex gap-3 mb-4">
                        <button
                            onClick={handleDownloadPNG}
                            disabled={isDownloading}
                            className="flex-1 py-2.5 px-4 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {isDownloading ? "Downloading..." : "Download PNG"}
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={isDownloading}
                            className="flex-1 py-2.5 px-4 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            {isDownloading ? "Downloading..." : "Download PDF"}
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6">
                    {/* View History Button */}
                    <button
                        onClick={() => setShowHistory(true)}
                        className="w-full mb-3 py-2.5 px-4 bg-slate-800/50 border border-white/10 text-gray-300 font-medium rounded-lg hover:bg-slate-800 hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View Ticket History
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            Close
                        </button>
                        {canList && (
                            <button
                                onClick={onListForSale}
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all cursor-pointer"
                            >
                                List for Sale
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Ticket History Modal */}
            <TicketHistoryModal
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                tokenId={ticket.tokenId.toString()}
                eventContractAddress={ticket.eventContractAddress}
                eventName={ticket.eventName}
            />
        </div>
    );
}

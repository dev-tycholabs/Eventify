"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Raw data to encode into a QR code (e.g. wallet address JSON). Ignored if qrImageUrl is provided. */
    qrData?: string;
    /** Pre-rendered QR code image URL. If provided, renders an img instead of generating via canvas. */
    qrImageUrl?: string;
    /** Modal title */
    title?: string;
    /** Modal subtitle shown below the title */
    subtitle?: string;
    /** Primary label shown below the QR (e.g. username or event name) */
    label?: string;
    /** Secondary label shown below the primary (e.g. truncated address or ticket ID) */
    sublabel?: string;
    /** Text to copy when the Copy button is clicked */
    copyText?: string;
    /** Filename prefix for the downloaded QR image */
    downloadName?: string;

    // Legacy props for backward compatibility
    walletAddress?: string;
    username?: string | null;
}

export function QRCodeModal({
    isOpen,
    onClose,
    qrData,
    qrImageUrl,
    title,
    subtitle,
    label,
    sublabel,
    copyText,
    downloadName,
    walletAddress,
    username,
}: QRCodeModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Determine effective values — support legacy wallet props
    const isWalletMode = !qrData && !qrImageUrl && !!walletAddress;
    const effectiveQrData = qrData || (isWalletMode ? JSON.stringify({ username: username || null, address: walletAddress }) : "");
    const effectiveTitle = title || (isWalletMode ? "My QR Code" : "QR Code");
    const effectiveSubtitle = subtitle || (isWalletMode ? "Scan to get my wallet address" : "");
    const effectiveLabel = label || (isWalletMode && username ? `@${username}` : undefined);
    const effectiveSublabel = sublabel || (isWalletMode && walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : undefined);
    const effectiveCopyText = copyText || walletAddress || "";
    const effectiveDownloadName = downloadName || (isWalletMode ? (username || "wallet") : "qr");
    const useCanvas = !qrImageUrl && !!effectiveQrData;

    useEffect(() => {
        if (isOpen && canvasRef.current && useCanvas && effectiveQrData) {
            QRCode.toCanvas(canvasRef.current, effectiveQrData, {
                width: 250,
                margin: 2,
                color: { dark: "#000000", light: "#ffffff" },
            });
        }
    }, [isOpen, useCanvas, effectiveQrData]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-white/10">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-1">{effectiveTitle}</h3>
                    {effectiveSubtitle && <p className="text-sm text-gray-400">{effectiveSubtitle}</p>}
                </div>

                <div className="bg-white rounded-2xl p-4 mx-auto w-fit">
                    {qrImageUrl ? (
                        <img src={qrImageUrl} alt="QR Code" className="w-[250px] h-[250px]" />
                    ) : (
                        <canvas ref={canvasRef} />
                    )}
                </div>

                <div className="mt-6 text-center">
                    {effectiveLabel && <p className="text-lg font-semibold text-white mb-1">{effectiveLabel}</p>}
                    {effectiveSublabel && <p className="text-sm text-gray-400 font-mono">{effectiveSublabel}</p>}
                </div>

                <div className="mt-6 flex gap-3">
                    {effectiveCopyText && (
                        <button
                            onClick={() => navigator.clipboard.writeText(effectiveCopyText)}
                            className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (qrImageUrl) {
                                const link = document.createElement("a");
                                link.download = `${effectiveDownloadName}-qr.png`;
                                link.href = qrImageUrl;
                                link.click();
                            } else if (canvasRef.current) {
                                const link = document.createElement("a");
                                link.download = `${effectiveDownloadName}-qr.png`;
                                link.href = canvasRef.current.toDataURL("image/png");
                                link.click();
                            }
                        }}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                    </button>
                </div>
            </div>
        </div>
    );
}

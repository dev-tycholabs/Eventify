"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
    onScanSuccess: (contract: string, tokenId: string, chainId?: number) => void;
    onError: (error: string) => void;
    isVerifying: boolean;
}

type ScanMode = "upload" | "camera";

interface QRData {
    contract: string;
    tokenId: string;
    event?: string;
    chainId?: number;
}

export function QRScanner({ onScanSuccess, onError, isVerifying }: QRScannerProps) {
    const [mode, setMode] = useState<ScanMode>("upload");
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isStartingCamera, setIsStartingCamera] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseQRData = useCallback((data: string): QRData | null => {
        // First, check if it's a URL (new format)
        try {
            const url = new URL(data);
            const contract = url.searchParams.get("contract");
            const tokenId = url.searchParams.get("tokenId");
            const event = url.searchParams.get("event");
            const chainIdParam = url.searchParams.get("chainId");

            if (contract && tokenId) {
                return {
                    contract,
                    tokenId,
                    event: event || undefined,
                    chainId: chainIdParam ? parseInt(chainIdParam, 10) : undefined,
                };
            }
        } catch {
            // Not a URL, try other formats
        }

        // Try JSON format (legacy)
        try {
            const parsed = JSON.parse(data);
            if (parsed.contract && parsed.tokenId) {
                return {
                    contract: parsed.contract,
                    tokenId: parsed.tokenId.toString(),
                    event: parsed.event,
                    chainId: parsed.chainId ? Number(parsed.chainId) : undefined,
                };
            }
        } catch {
            // Try alternative format: contract|tokenId or contract|tokenId|chainId
            const parts = data.split("|");
            if (parts.length >= 2 && parts[0].startsWith("0x")) {
                return {
                    contract: parts[0],
                    tokenId: parts[1],
                    chainId: parts[2] ? parseInt(parts[2], 10) : undefined,
                };
            }
        }
        return null;
    }, []);

    const handleScanSuccess = useCallback((decodedText: string) => {
        const qrData = parseQRData(decodedText);
        if (qrData) {
            onScanSuccess(qrData.contract, qrData.tokenId, qrData.chainId);
        } else {
            onError("Invalid QR code format. Please scan a valid ticket QR.");
        }
    }, [parseQRData, onScanSuccess, onError]);

    const stopCamera = useCallback(async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch {
                // Ignore stop errors
            }
            scannerRef.current = null;
        }
        setIsCameraActive(false);
    }, []);

    const startCamera = useCallback(async () => {
        setCameraError(null);
        setIsStartingCamera(true);

        // Check if we're in a secure context (HTTPS or localhost)
        const isSecureContext = window.isSecureContext ||
            window.location.protocol === 'https:' ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        if (!isSecureContext) {
            setCameraError("Camera access requires HTTPS. Please access this site via HTTPS to use the camera scanner.");
            setIsStartingCamera(false);
            return;
        }

        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError("Your browser doesn't support camera access. Please try a modern browser like Chrome, Firefox, or Safari.");
            setIsStartingCamera(false);
            return;
        }

        // Small delay to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const scanner = new Html5Qrcode("qr-reader");
            scannerRef.current = scanner;

            // Try to start with facingMode first (this will trigger permission prompt)
            // Use "environment" for mobile back camera, falls back to any available camera
            await scanner.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                },
                (decodedText) => {
                    handleScanSuccess(decodedText);
                    stopCamera();
                },
                () => {
                    // Ignore scan failures (no QR found in frame)
                }
            );
            setIsCameraActive(true);
            setIsStartingCamera(false);
        } catch (firstErr) {
            // If facingMode fails, try with "user" (front camera) as fallback
            try {
                if (scannerRef.current) {
                    scannerRef.current.clear();
                }
                const scanner = new Html5Qrcode("qr-reader");
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: "user" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                    },
                    (decodedText) => {
                        handleScanSuccess(decodedText);
                        stopCamera();
                    },
                    () => { }
                );
                setIsCameraActive(true);
                setIsStartingCamera(false);
            } catch (secondErr) {
                const message = secondErr instanceof Error ? secondErr.message : String(secondErr);
                console.error("Camera error:", message);

                if (message.includes("Permission") || message.includes("NotAllowed") || message.includes("denied")) {
                    setCameraError("Camera permission denied. Please click the camera icon in your browser's address bar to allow access, then try again.");
                } else if (message.includes("NotFound") || message.includes("not found") || message.includes("Requested device not found") || message.includes("no camera")) {
                    setCameraError("No camera detected. Make sure your camera is connected and not being used by another app.");
                } else if (message.includes("NotReadable") || message.includes("in use") || message.includes("Could not start")) {
                    setCameraError("Camera is busy. Please close other apps using the camera (like Zoom, Teams, etc.) and try again.");
                } else {
                    setCameraError(`Unable to access camera. Error: ${message}`);
                }
                setIsCameraActive(false);
                setIsStartingCamera(false);
            }
        }
    }, [handleScanSuccess, stopCamera]);

    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const scanner = new Html5Qrcode("qr-file-reader");
            const result = await scanner.scanFile(file, true);
            handleScanSuccess(result);
            scanner.clear();
        } catch {
            onError("Could not read QR code from image. Please try a clearer image.");
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [handleScanSuccess, onError]);

    // Cleanup on unmount or mode change
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => { });
            }
        };
    }, []);

    // Stop camera when switching modes
    useEffect(() => {
        if (mode === "upload" && isCameraActive) {
            stopCamera();
        }
    }, [mode, isCameraActive, stopCamera]);

    return (
        <div className="space-y-6">
            {/* Mode Tabs */}
            <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl">
                <button
                    onClick={() => setMode("upload")}
                    disabled={isVerifying}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === "upload"
                        ? "bg-purple-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-slate-700/50"
                        }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload Image
                </button>
                <button
                    onClick={() => setMode("camera")}
                    disabled={isVerifying}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === "camera"
                        ? "bg-purple-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-slate-700/50"
                        }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Scan with Camera
                </button>
            </div>

            {/* Upload Mode */}
            {mode === "upload" && (
                <div className="space-y-4">
                    <div
                        onClick={() => !isVerifying && fileInputRef.current?.click()}
                        className={`border-2 border-dashed border-white/20 rounded-2xl p-8 text-center cursor-pointer transition-all hover:border-purple-500/50 hover:bg-purple-500/5 ${isVerifying ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                    >
                        <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                        </div>
                        <p className="text-white font-medium mb-1">Upload Ticket Image</p>
                        <p className="text-gray-400 text-sm">Click to select or drag and drop your ticket</p>
                        <p className="text-gray-500 text-xs mt-2">Supports PNG, JPG, JPEG</p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isVerifying}
                    />
                    {/* Hidden element for file scanning */}
                    <div id="qr-file-reader" className="hidden"></div>
                </div>
            )}

            {/* Camera Mode */}
            {mode === "camera" && (
                <div className="space-y-4">
                    {/* QR Reader container - visible when camera is active or starting */}
                    <div
                        id="qr-reader"
                        className={`rounded-2xl overflow-hidden ${(isCameraActive || isStartingCamera) ? 'block' : 'absolute opacity-0 pointer-events-none'}`}
                        style={{ minHeight: (isCameraActive || isStartingCamera) ? '300px' : '0' }}
                    ></div>

                    {cameraError ? (
                        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-sm text-red-400">{cameraError}</p>
                                <button
                                    onClick={() => { setCameraError(null); setMode("upload"); }}
                                    className="mt-2 text-sm text-purple-400 hover:text-purple-300 underline"
                                >
                                    Switch to Upload Image
                                </button>
                            </div>
                        </div>
                    ) : isStartingCamera ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                                <svg className="animate-spin w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            </div>
                            <p className="text-gray-400">Starting camera...</p>
                        </div>
                    ) : !isCameraActive ? (
                        <div className="text-center py-8">
                            <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-400 mb-4">Position the QR code within the camera frame</p>
                            <button
                                onClick={startCamera}
                                disabled={isVerifying}
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all cursor-pointer"
                            >
                                Start Camera
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={stopCamera}
                            className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Stop Camera
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

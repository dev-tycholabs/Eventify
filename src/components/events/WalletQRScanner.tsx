"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { isAddress } from "viem";

interface WalletQRScannerProps {
    onScanSuccess: (walletAddress: string) => void;
    onError: (error: string) => void;
    onClose: () => void;
}

type ScanMode = "upload" | "camera";

export function WalletQRScanner({ onScanSuccess, onError, onClose }: WalletQRScannerProps) {
    const [mode, setMode] = useState<ScanMode>("upload");
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isStartingCamera, setIsStartingCamera] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Parse QR data to extract wallet address
    const parseWalletAddress = useCallback(async (data: string): Promise<string | null> => {
        // Direct wallet address
        if (isAddress(data)) {
            return data;
        }

        // Try parsing as JSON (profile QR has { username, address })
        try {
            const parsed = JSON.parse(data);
            // Check for address field first
            if (parsed.address && isAddress(parsed.address)) {
                return parsed.address;
            }
            if (parsed.wallet && isAddress(parsed.wallet)) {
                return parsed.wallet;
            }
            // If only username is available, look up the address
            if (parsed.username) {
                const res = await fetch(`/api/users?username=${encodeURIComponent(parsed.username)}`);
                const userData = await res.json();
                if (userData.user?.wallet_address && isAddress(userData.user.wallet_address)) {
                    return userData.user.wallet_address;
                }
            }
        } catch {
            // Not JSON, continue checking other formats
        }

        // Check for ethereum: URI format
        if (data.startsWith("ethereum:")) {
            const address = data.replace("ethereum:", "").split("@")[0].split("?")[0];
            if (isAddress(address)) {
                return address;
            }
        }

        return null;
    }, []);

    const handleScanSuccess = useCallback(async (decodedText: string) => {
        const walletAddress = await parseWalletAddress(decodedText);
        if (walletAddress) {
            onScanSuccess(walletAddress);
        } else {
            onError("Could not find a valid wallet address in the QR code.");
        }
    }, [parseWalletAddress, onScanSuccess, onError]);

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

        const isSecureContext = window.isSecureContext ||
            window.location.protocol === 'https:' ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        if (!isSecureContext) {
            setCameraError("Camera access requires HTTPS.");
            setIsStartingCamera(false);
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError("Your browser doesn't support camera access.");
            setIsStartingCamera(false);
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const scanner = new Html5Qrcode("wallet-qr-reader");
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    handleScanSuccess(decodedText);
                    stopCamera();
                },
                () => { }
            );
            setIsCameraActive(true);
            setIsStartingCamera(false);
        } catch (firstErr) {
            try {
                if (scannerRef.current) {
                    scannerRef.current.clear();
                }
                const scanner = new Html5Qrcode("wallet-qr-reader");
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: "user" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
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
                if (message.includes("Permission") || message.includes("denied")) {
                    setCameraError("Camera permission denied.");
                } else if (message.includes("NotFound") || message.includes("not found")) {
                    setCameraError("No camera detected.");
                } else {
                    setCameraError(`Unable to access camera: ${message}`);
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
            const scanner = new Html5Qrcode("wallet-qr-file-reader");
            const result = await scanner.scanFile(file, true);
            handleScanSuccess(result);
            scanner.clear();
        } catch {
            onError("Could not read QR code from image.");
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [handleScanSuccess, onError]);

    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => { });
            }
        };
    }, []);

    useEffect(() => {
        if (mode === "upload" && isCameraActive) {
            stopCamera();
        }
    }, [mode, isCameraActive, stopCamera]);


    return (
        <div className="space-y-4">
            {/* Header with close button */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Scan Profile QR Code</h3>
                <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl">
                <button
                    onClick={() => setMode("upload")}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === "upload"
                        ? "bg-purple-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-slate-700/50"
                        }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload
                </button>
                <button
                    onClick={() => setMode("camera")}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === "camera"
                        ? "bg-purple-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-slate-700/50"
                        }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Camera
                </button>
            </div>

            {/* Upload Mode */}
            {mode === "upload" && (
                <div className="space-y-3">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer transition-all hover:border-purple-500/50 hover:bg-purple-500/5"
                    >
                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                        </div>
                        <p className="text-white text-sm font-medium mb-1">Upload Profile QR</p>
                        <p className="text-gray-500 text-xs">Click to select image</p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <div id="wallet-qr-file-reader" className="hidden"></div>
                </div>
            )}

            {/* Camera Mode */}
            {mode === "camera" && (
                <div className="space-y-3">
                    <div
                        id="wallet-qr-reader"
                        className={`rounded-xl overflow-hidden ${(isCameraActive || isStartingCamera) ? 'block' : 'absolute opacity-0 pointer-events-none'}`}
                        style={{ minHeight: (isCameraActive || isStartingCamera) ? '250px' : '0' }}
                    ></div>

                    {cameraError ? (
                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs text-red-400">{cameraError}</p>
                        </div>
                    ) : isStartingCamera ? (
                        <div className="text-center py-6">
                            <svg className="animate-spin w-8 h-8 text-purple-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <p className="text-gray-400 text-sm">Starting camera...</p>
                        </div>
                    ) : !isCameraActive ? (
                        <div className="text-center py-6">
                            <div className="w-14 h-14 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                                <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <button
                                onClick={startCamera}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-medium rounded-lg transition-all cursor-pointer"
                            >
                                Start Camera
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={stopCamera}
                            className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

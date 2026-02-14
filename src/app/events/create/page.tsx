"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useEventFactory } from "@/hooks/useEventFactory";
import { useSupabase } from "@/hooks/useSupabase";
import { GmtOffsetPicker, getDefaultGmtOffset } from "@/components/GmtOffsetPicker";
import { DateTimePicker } from "@/components/DateTimePicker";
import { LocationPicker } from "@/components/LocationPicker";
import { EventTypeSelect } from "@/components/EventTypeSelect";
import type { EventCreationForm, EventType, RoyaltyRecipient, MediaFile } from "@/types/event";
import type { LocationValue } from "@/components/LocationPicker";

type DeploymentStatus = "idle" | "deploying" | "success" | "error";

interface FormErrors {
    name?: string;
    symbol?: string;
    date?: string;
    venue?: string;
    location?: string;
    ticketPrice?: string;
    totalSupply?: string;
    royaltyPercent?: string;
    royaltyRecipients?: string;
}

export default function CreateEventPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const draftId = searchParams.get("draft");
    const { address, isConnected } = useAccount();
    const { createEvent, isLoading, error } = useEventFactory();
    const { saveDraft: saveDraftToSupabase, publishEvent, getEvents } = useSupabase();

    const [form, setForm] = useState<EventCreationForm>({
        name: "",
        symbol: "",
        description: "",
        date: "",
        timezone: getDefaultGmtOffset(),
        eventType: "offline",
        venue: "",
        location: {
            countryId: null,
            countryName: "",
            stateId: null,
            stateName: "",
            cityId: null,
            cityName: "",
        },
        image: null,
        coverImage: null,
        ticketPrice: "",
        totalSupply: 100,
        maxTicketsPerWallet: 5,
        maxResalePrice: "",
        royaltyPercent: "5",
        royaltyRecipients: [],
        mediaFiles: [],
    });

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [ipfsImageUrl, setIpfsImageUrl] = useState<string | null>(null);
    const [ipfsProtocolUrl, setIpfsProtocolUrl] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [imageUploadError, setImageUploadError] = useState<string | null>(null);

    // Cover image state
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
    const [ipfsCoverImageUrl, setIpfsCoverImageUrl] = useState<string | null>(null);
    const [ipfsCoverProtocolUrl, setIpfsCoverProtocolUrl] = useState<string | null>(null);
    const [isUploadingCoverImage, setIsUploadingCoverImage] = useState(false);
    const [coverImageUploadError, setCoverImageUploadError] = useState<string | null>(null);

    const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>("idle");
    const [txHash, setTxHash] = useState<string | null>(null);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [draftSaved, setDraftSaved] = useState(false);
    const [hasDraft, setHasDraft] = useState(false);
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);

    const DRAFT_KEY = "event_creation_draft";

    // Load draft from Supabase if draftId is provided in URL
    useEffect(() => {
        const loadDraftFromSupabase = async () => {
            if (draftId && address) {
                try {
                    const events = await getEvents({ organizer: address, status: "draft" });
                    const draft = events.find(e => e.id === draftId);
                    if (draft) {
                        // Map database royalty_recipients to form format
                        const dbRecipients = (draft as Record<string, unknown>).royalty_recipients as Array<{
                            id: string;
                            recipient_address: string;
                            recipient_name: string | null;
                            percentage: number;
                        }> | undefined;

                        const mappedRecipients: RoyaltyRecipient[] = dbRecipients?.map(r => ({
                            id: r.id,
                            address: r.recipient_address,
                            name: r.recipient_name || "",
                            percentage: String(r.percentage),
                        })) || [];

                        setForm({
                            name: draft.name || "",
                            symbol: (draft as Record<string, unknown>).symbol as string || "",
                            description: draft.description || "",
                            date: draft.date ? new Date(draft.date).toISOString().slice(0, 16) : "",
                            timezone: draft.timezone || getDefaultGmtOffset(),
                            eventType: (draft.event_type as EventType) || "offline",
                            venue: draft.venue || "",
                            location: {
                                countryId: null,
                                countryName: (draft as Record<string, unknown>).country as string || "",
                                stateId: null,
                                stateName: (draft as Record<string, unknown>).state as string || "",
                                cityId: null,
                                cityName: (draft as Record<string, unknown>).city as string || "",
                            },
                            image: null,
                            coverImage: null,
                            ticketPrice: draft.ticket_price || "",
                            totalSupply: draft.total_supply || 100,
                            maxTicketsPerWallet: draft.max_tickets_per_wallet || 5,
                            maxResalePrice: draft.max_resale_price || "",
                            royaltyPercent: (draft as Record<string, unknown>).royalty_percent as string || "5",
                            royaltyRecipients: mappedRecipients,
                            mediaFiles: [],
                        });
                        if (draft.image_url) {
                            setImagePreview(draft.image_url);
                            // Handle both ipfs:// protocol URLs and gateway URLs
                            if (draft.image_url.startsWith("ipfs://")) {
                                setIpfsProtocolUrl(draft.image_url);
                                // Convert to gateway URL for display
                                const cid = draft.image_url.replace("ipfs://", "");
                                setIpfsImageUrl(`https://gateway.pinata.cloud/ipfs/${cid}`);
                            } else if (draft.image_url.includes("ipfs") || draft.image_url.includes("pinata")) {
                                setIpfsImageUrl(draft.image_url);
                                // Extract CID and create ipfs:// URL
                                const cidMatch = draft.image_url.match(/ipfs\/([a-zA-Z0-9]+)/);
                                if (cidMatch) {
                                    setIpfsProtocolUrl(`ipfs://${cidMatch[1]}`);
                                }
                            }
                        }

                        // Load cover image
                        const coverImageUrl = (draft as Record<string, unknown>).cover_image_url as string | undefined;
                        if (coverImageUrl) {
                            setCoverImagePreview(coverImageUrl);
                            if (coverImageUrl.startsWith("ipfs://")) {
                                setIpfsCoverProtocolUrl(coverImageUrl);
                                const cid = coverImageUrl.replace("ipfs://", "");
                                setIpfsCoverImageUrl(`https://gateway.pinata.cloud/ipfs/${cid}`);
                            } else if (coverImageUrl.includes("ipfs") || coverImageUrl.includes("pinata")) {
                                setIpfsCoverImageUrl(coverImageUrl);
                                const cidMatch = coverImageUrl.match(/ipfs\/([a-zA-Z0-9]+)/);
                                if (cidMatch) {
                                    setIpfsCoverProtocolUrl(`ipfs://${cidMatch[1]}`);
                                }
                            }
                        }

                        // Load media files
                        const dbMediaFiles = (draft as Record<string, unknown>).media_files as Array<{ url: string; type: "image" | "video" }> | undefined;
                        if (dbMediaFiles && Array.isArray(dbMediaFiles) && dbMediaFiles.length > 0) {
                            const loadedMediaFiles: MediaFile[] = dbMediaFiles.map((m, index) => ({
                                id: `loaded-media-${index}-${Date.now()}`,
                                file: null,
                                previewUrl: m.url,
                                ipfsUrl: m.url,
                                type: m.type,
                                isUploading: false,
                            }));
                            setForm(prev => ({ ...prev, mediaFiles: loadedMediaFiles }));
                        }

                        setCurrentDraftId(draftId);
                        setHasDraft(true);
                    }
                } catch (err) {
                    console.error("Failed to load draft:", err);
                }
            }
        };
        loadDraftFromSupabase();
    }, [draftId, address, getEvents]);

    // Load draft from localStorage on mount (fallback for unsaved local drafts)
    useEffect(() => {
        if (draftId) return; // Skip if loading from Supabase
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                // Don't restore image as File objects can't be serialized
                setForm(prev => ({ ...prev, ...parsed, image: null }));
                if (parsed.imagePreview) {
                    setImagePreview(parsed.imagePreview);
                }
                setHasDraft(true);
            } catch {
                // Invalid draft, ignore
            }
        }
    }, []);

    // Set default timezone based on user's location
    useEffect(() => {
        const defaultTz = getDefaultGmtOffset();
        setForm(prev => ({ ...prev, timezone: defaultTz }));
    }, []);

    const validateForm = (): boolean => {
        const errors: FormErrors = {};

        if (!form.name.trim()) {
            errors.name = "Event name is required";
        }

        if (!form.symbol.trim()) {
            errors.symbol = "Collection symbol is required";
        } else if (!/^[A-Z0-9]+$/.test(form.symbol)) {
            errors.symbol = "Symbol must be uppercase letters and numbers only";
        }

        if (!form.date) {
            errors.date = "Event date is required";
        } else {
            const eventDate = new Date(form.date);
            if (eventDate <= new Date()) {
                errors.date = "Event date must be in the future";
            }
        }

        if (!form.venue.trim()) {
            errors.venue = "Venue is required";
        }

        if (!form.location.countryId || !form.location.stateId || !form.location.cityId) {
            errors.location = "Country, state, and city are required";
        }

        if (!form.ticketPrice || parseFloat(form.ticketPrice) <= 0) {
            errors.ticketPrice = "Valid ticket price is required";
        }

        if (!form.totalSupply || form.totalSupply < 1) {
            errors.totalSupply = "Total supply must be at least 1";
        }

        const royalty = parseFloat(form.royaltyPercent);
        if (isNaN(royalty) || royalty < 0 || royalty > 10) {
            errors.royaltyPercent = "Royalty must be between 0% and 10%";
        }

        // Validate royalty recipients
        if (form.royaltyRecipients.length > 0) {
            const totalRecipientPercent = form.royaltyRecipients.reduce(
                (sum, r) => sum + (parseFloat(r.percentage) || 0), 0
            );
            if (totalRecipientPercent !== 100) {
                errors.royaltyRecipients = `Recipient percentages must total 100% (currently ${totalRecipientPercent}%)`;
            }
            // Check for invalid addresses
            const invalidAddress = form.royaltyRecipients.find(
                r => !r.address || !/^0x[a-fA-F0-9]{40}$/.test(r.address)
            );
            if (invalidAddress) {
                errors.royaltyRecipients = "All recipients must have valid wallet addresses";
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const saveDraft = async () => {
        if (!form.name.trim()) {
            setFormErrors({ name: "Event name is required to save draft" });
            return;
        }

        setIsSavingDraft(true);
        try {
            const eventData = {
                name: form.name,
                symbol: form.symbol || undefined,
                description: form.description || undefined,
                date: form.date ? new Date(form.date).toISOString() : undefined,
                timezone: form.timezone,
                event_type: form.eventType as "online" | "offline",
                venue: form.venue || undefined,
                country: form.location.countryName || undefined,
                state: form.location.stateName || undefined,
                city: form.location.cityName || undefined,
                image_url: ipfsImageUrl || imagePreview || undefined,
                cover_image_url: ipfsCoverImageUrl || coverImagePreview || undefined,
                media_files: form.mediaFiles
                    .filter((m) => m.ipfsUrl)
                    .map((m) => ({
                        url: m.ipfsUrl as string,
                        type: m.type,
                    })),
                ticket_price: form.ticketPrice || undefined,
                total_supply: form.totalSupply || undefined,
                max_tickets_per_wallet: form.maxTicketsPerWallet || undefined,
                max_resale_price: form.maxResalePrice || undefined,
                royalty_percent: form.royaltyPercent || undefined,
                royalty_recipients: form.royaltyRecipients.length > 0 ? form.royaltyRecipients : undefined,
            };

            const savedEvent = await saveDraftToSupabase(eventData, currentDraftId || undefined);

            if (savedEvent) {
                setCurrentDraftId(savedEvent.id);
                setDraftSaved(true);
                setHasDraft(true);
                // Clear localStorage since we saved to Supabase
                localStorage.removeItem(DRAFT_KEY);
                setTimeout(() => setDraftSaved(false), 3000);
            }
        } catch (err) {
            console.error("Failed to save draft:", err);
        } finally {
            setIsSavingDraft(false);
        }
    };

    const clearDraft = () => {
        localStorage.removeItem(DRAFT_KEY);
        setHasDraft(false);
        setCurrentDraftId(null);
        setForm({
            name: "",
            symbol: "",
            description: "",
            date: "",
            timezone: getDefaultGmtOffset(),
            eventType: "offline",
            venue: "",
            location: {
                countryId: null,
                countryName: "",
                stateId: null,
                stateName: "",
                cityId: null,
                cityName: "",
            },
            image: null,
            coverImage: null,
            ticketPrice: "",
            totalSupply: 100,
            maxTicketsPerWallet: 5,
            maxResalePrice: "",
            royaltyPercent: "5",
            royaltyRecipients: [],
            mediaFiles: [],
        });
        setImagePreview(null);
        setIpfsImageUrl(null);
        setIpfsProtocolUrl(null);
        setImageUploadError(null);
        setCoverImagePreview(null);
        setIpfsCoverImageUrl(null);
        setIpfsCoverProtocolUrl(null);
        setCoverImageUploadError(null);
        // Remove draft query param from URL
        router.replace("/events/create");
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Show preview immediately
        setForm({ ...form, image: file });
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Upload to Pinata
        setIsUploadingImage(true);
        setImageUploadError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("name", `event-${form.name || "image"}-${Date.now()}`);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to upload image");
            }

            setIpfsImageUrl(data.imageUrl);        // Gateway URL for display
            setIpfsProtocolUrl(data.ipfsUrl);      // ipfs:// URL for blockchain
        } catch (error) {
            console.error("Image upload error:", error);
            setImageUploadError(error instanceof Error ? error.message : "Failed to upload image");
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Show preview immediately
        setForm({ ...form, coverImage: file });
        const reader = new FileReader();
        reader.onloadend = () => {
            setCoverImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Upload to Pinata
        setIsUploadingCoverImage(true);
        setCoverImageUploadError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("name", `event-cover-${form.name || "image"}-${Date.now()}`);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to upload cover image");
            }

            setIpfsCoverImageUrl(data.imageUrl);        // Gateway URL for display
            setIpfsCoverProtocolUrl(data.ipfsUrl);      // ipfs:// URL for blockchain
        } catch (error) {
            console.error("Cover image upload error:", error);
            setCoverImageUploadError(error instanceof Error ? error.message : "Failed to upload cover image");
        } finally {
            setIsUploadingCoverImage(false);
        }
    };

    const handleMediaFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newMediaFiles: MediaFile[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const isVideo = file.type.startsWith("video/");
            const isImage = file.type.startsWith("image/");

            if (!isVideo && !isImage) continue;

            const mediaFile: MediaFile = {
                id: `media-${Date.now()}-${i}`,
                file,
                previewUrl: "",
                type: isVideo ? "video" : "image",
                isUploading: true,
            };

            // Create preview URL
            if (isImage) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setForm(prev => ({
                        ...prev,
                        mediaFiles: prev.mediaFiles.map(m =>
                            m.id === mediaFile.id ? { ...m, previewUrl: reader.result as string } : m
                        ),
                    }));
                };
                reader.readAsDataURL(file);
            } else {
                mediaFile.previewUrl = URL.createObjectURL(file);
            }

            newMediaFiles.push(mediaFile);
        }

        // Add to form state
        setForm(prev => ({ ...prev, mediaFiles: [...prev.mediaFiles, ...newMediaFiles] }));

        // Upload each file
        for (const mediaFile of newMediaFiles) {
            try {
                const formData = new FormData();
                formData.append("file", mediaFile.file!);
                formData.append("name", `event-media-${form.name || "file"}-${Date.now()}`);
                formData.append("type", mediaFile.type);

                const response = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to upload file");
                }

                setForm(prev => ({
                    ...prev,
                    mediaFiles: prev.mediaFiles.map(m =>
                        m.id === mediaFile.id
                            ? { ...m, ipfsUrl: data.url, ipfsProtocolUrl: data.ipfsUrl, isUploading: false }
                            : m
                    ),
                }));
            } catch (error) {
                console.error("Media upload error:", error);
                setForm(prev => ({
                    ...prev,
                    mediaFiles: prev.mediaFiles.map(m =>
                        m.id === mediaFile.id
                            ? { ...m, isUploading: false, error: error instanceof Error ? error.message : "Upload failed" }
                            : m
                    ),
                }));
            }
        }

        // Reset input
        e.target.value = "";
    };

    const removeMediaFile = (id: string) => {
        setForm(prev => ({
            ...prev,
            mediaFiles: prev.mediaFiles.filter(m => m.id !== id),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setDeploymentStatus("deploying");
        setTxHash(null);

        const result = await createEvent({
            ...form,
            imageUrl: ipfsProtocolUrl || undefined,  // Use ipfs:// URL for blockchain
        });

        if (result) {
            setTxHash(result.txHash);
            setDeploymentStatus("success");

            // Save to Supabase as published event with actual contract address
            try {
                const eventData = {
                    name: form.name,
                    symbol: form.symbol || undefined,
                    description: form.description || undefined,
                    date: form.date ? new Date(form.date).toISOString() : undefined,
                    timezone: form.timezone,
                    event_type: form.eventType as "online" | "offline",
                    venue: form.venue || undefined,
                    country: form.location.countryName || undefined,
                    state: form.location.stateName || undefined,
                    city: form.location.cityName || undefined,
                    image_url: ipfsImageUrl || imagePreview || undefined,
                    cover_image_url: ipfsCoverImageUrl || coverImagePreview || undefined,
                    media_files: form.mediaFiles
                        .filter((m) => m.ipfsUrl)
                        .map((m) => ({
                            url: m.ipfsUrl as string,
                            type: m.type,
                        })),
                    ticket_price: form.ticketPrice || undefined,
                    total_supply: form.totalSupply || undefined,
                    max_tickets_per_wallet: form.maxTicketsPerWallet || undefined,
                    max_resale_price: form.maxResalePrice || undefined,
                    royalty_percent: form.royaltyPercent || undefined,
                    royalty_recipients: form.royaltyRecipients.length > 0 ? form.royaltyRecipients : undefined,
                    contract_address: result.contractAddress,
                    royalty_splitter_address: result.royaltySplitterAddress || undefined,
                };
                await publishEvent(eventData, currentDraftId || undefined);
                // Clear localStorage and draft state
                localStorage.removeItem(DRAFT_KEY);
                setCurrentDraftId(null);
            } catch (err) {
                console.error("Failed to save event to database:", err);
            }
        } else {
            setDeploymentStatus("error");
        }
    };

    // Not connected state
    if (!isConnected) {
        return (
            <div className="min-h-screen bg-slate-900 pt-24 pb-12">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
                        <svg className="w-12 h-12 text-purple-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h1>
                    <p className="text-gray-400 mb-6">You need to connect your wallet to create an event.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Back Link */}
                <Link href="/events" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Events
                </Link>

                {/* Page Header */}
                <div className="mb-8 flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Create Event</h1>
                        <p className="text-gray-400">Deploy your event contract and start selling NFT tickets</p>
                    </div>
                    <button
                        type="button"
                        disabled={isLoadingPreview || !form.name.trim()}
                        onClick={async () => {
                            if (!form.name.trim()) {
                                setFormErrors({ name: "Event name is required to preview" });
                                return;
                            }

                            setIsLoadingPreview(true);
                            try {
                                // Save as draft first
                                const eventData = {
                                    name: form.name,
                                    symbol: form.symbol || undefined,
                                    description: form.description || undefined,
                                    date: form.date ? new Date(form.date).toISOString() : undefined,
                                    timezone: form.timezone,
                                    event_type: form.eventType as "online" | "offline",
                                    venue: form.venue || undefined,
                                    country: form.location.countryName || undefined,
                                    state: form.location.stateName || undefined,
                                    city: form.location.cityName || undefined,
                                    image_url: ipfsImageUrl || imagePreview || undefined,
                                    cover_image_url: ipfsCoverImageUrl || coverImagePreview || undefined,
                                    ticket_price: form.ticketPrice || undefined,
                                    total_supply: form.totalSupply || undefined,
                                    max_tickets_per_wallet: form.maxTicketsPerWallet || undefined,
                                    max_resale_price: form.maxResalePrice || undefined,
                                    royalty_percent: form.royaltyPercent || undefined,
                                    royalty_recipients: form.royaltyRecipients.length > 0 ? form.royaltyRecipients : undefined,
                                    media_files: form.mediaFiles
                                        .filter((m) => m.ipfsUrl)
                                        .map((m) => ({
                                            url: m.ipfsUrl as string,
                                            type: m.type,
                                        })),
                                };

                                const savedEvent = await saveDraftToSupabase(eventData, currentDraftId || undefined);

                                if (savedEvent) {
                                    setCurrentDraftId(savedEvent.id);
                                    setHasDraft(true);
                                    localStorage.removeItem(DRAFT_KEY);
                                    // Navigate to preview with draft ID
                                    router.push(`/events/create/preview?draft=${savedEvent.id}`);
                                } else {
                                    // Show error if save failed
                                    console.error("Failed to save draft - savedEvent is null");
                                    alert("Failed to save draft. Please make sure your wallet is connected and try again.");
                                }
                            } catch (err) {
                                console.error("Failed to save draft for preview:", err);
                                alert("Failed to save draft. Please try again.");
                            } finally {
                                setIsLoadingPreview(false);
                            }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white rounded-lg transition-colors border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isLoadingPreview ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Saving...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Preview
                            </>
                        )}
                    </button>
                </div>

                {/* Success State */}
                {deploymentStatus === "success" && txHash && (
                    <div className="mb-8 p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-green-400 mb-1">Event Created Successfully!</h3>
                                <p className="text-green-400/70 text-sm mb-3">Your event contract has been deployed to Etherlink.</p>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <a
                                        href={`https://shadownet.explorer.etherlink.com/tx/${txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300"
                                    >
                                        View Transaction
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                    <Link href="/events" className="inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300">
                                        View All Events
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Cover Image Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Cover Image (Optional)</label>
                        <p className="text-xs text-gray-500 mb-2">A wide banner image displayed at the top of your event page.</p>
                        <div className="relative">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleCoverImageChange}
                                className="hidden"
                                id="cover-image-upload"
                                disabled={deploymentStatus === "deploying" || isUploadingCoverImage}
                            />
                            <label
                                htmlFor="cover-image-upload"
                                className={`block w-full h-32 rounded-xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden ${isUploadingCoverImage
                                    ? "border-purple-500/50 bg-purple-500/5"
                                    : coverImageUploadError
                                        ? "border-red-500/50 hover:border-red-500/70"
                                        : ipfsCoverImageUrl
                                            ? "border-green-500/50 hover:border-green-500/70"
                                            : "border-white/20 hover:border-purple-500/50"
                                    }`}
                            >
                                {coverImagePreview ? (
                                    <div className="relative w-full h-full">
                                        <img src={coverImagePreview} alt="Cover Preview" className="w-full h-full object-cover" />
                                        {isUploadingCoverImage && (
                                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                                                <svg className="w-6 h-6 text-purple-400 animate-spin mb-1" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                <span className="text-xs text-purple-300">Uploading...</span>
                                            </div>
                                        )}
                                        {ipfsCoverImageUrl && !isUploadingCoverImage && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 px-3 py-1 flex items-center gap-2">
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span className="text-xs text-white">Stored on IPFS</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                        <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-sm">Click to upload cover image</span>
                                    </div>
                                )}
                            </label>
                        </div>
                        {coverImageUploadError && (
                            <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {coverImageUploadError}
                            </p>
                        )}
                    </div>

                    {/* Event Image Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Event Image (Optional)</label>
                        <p className="text-xs text-gray-500 mb-2">The main image/poster for your event, shown in listings and cards.</p>
                        <div className="relative">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="hidden"
                                id="image-upload"
                                disabled={deploymentStatus === "deploying" || isUploadingImage}
                            />
                            <label
                                htmlFor="image-upload"
                                className={`block w-full h-48 rounded-xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden ${isUploadingImage
                                    ? "border-purple-500/50 bg-purple-500/5"
                                    : imageUploadError
                                        ? "border-red-500/50 hover:border-red-500/70"
                                        : ipfsImageUrl
                                            ? "border-green-500/50 hover:border-green-500/70"
                                            : "border-white/20 hover:border-purple-500/50"
                                    }`}
                            >
                                {imagePreview ? (
                                    <div className="relative w-full h-full">
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        {isUploadingImage && (
                                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                                                <svg className="w-8 h-8 text-purple-400 animate-spin mb-2" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                <span className="text-sm text-purple-300">Uploading to IPFS...</span>
                                            </div>
                                        )}
                                        {ipfsImageUrl && !isUploadingImage && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 px-3 py-1.5 flex items-center gap-2">
                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span className="text-xs text-white truncate">Stored on IPFS</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                        <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-sm">Click to upload event image</span>
                                        <span className="text-xs text-gray-500 mt-1">Image will be stored on IPFS via Pinata</span>
                                    </div>
                                )}
                            </label>
                        </div>
                        {imageUploadError && (
                            <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {imageUploadError}
                            </p>
                        )}
                    </div>

                    {/* Media Files Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Event Media (Optional)</label>
                        <p className="text-xs text-gray-500 mb-3">
                            Add photos and videos to showcase your event. These will be displayed on your event page.
                        </p>

                        {/* Media Files Grid */}
                        {form.mediaFiles.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                                {form.mediaFiles.map((media) => (
                                    <div
                                        key={media.id}
                                        className={`relative aspect-video rounded-lg overflow-hidden border-2 ${media.error
                                            ? "border-red-500/50"
                                            : media.ipfsUrl
                                                ? "border-green-500/50"
                                                : "border-white/10"
                                            }`}
                                    >
                                        {media.type === "video" ? (
                                            <video
                                                src={media.ipfsUrl || media.previewUrl || undefined}
                                                className="w-full h-full object-cover"
                                                muted
                                            />
                                        ) : (media.ipfsUrl || media.previewUrl) ? (
                                            <img
                                                src={media.ipfsUrl || media.previewUrl}
                                                alt="Media preview"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )}

                                        {/* Video indicator */}
                                        {media.type === "video" && (
                                            <div className="absolute top-2 left-2 bg-black/60 rounded px-1.5 py-0.5 flex items-center gap-1">
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                                <span className="text-xs text-white">Video</span>
                                            </div>
                                        )}

                                        {/* Upload status overlay */}
                                        {media.isUploading && (
                                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                                                <svg className="w-6 h-6 text-purple-400 animate-spin mb-1" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                <span className="text-xs text-purple-300">Uploading...</span>
                                            </div>
                                        )}

                                        {/* Success indicator */}
                                        {media.ipfsUrl && !media.isUploading && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 px-2 py-1 flex items-center gap-1">
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span className="text-xs text-white">IPFS</span>
                                            </div>
                                        )}

                                        {/* Error indicator */}
                                        {media.error && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-red-500/90 px-2 py-1">
                                                <span className="text-xs text-white truncate">{media.error}</span>
                                            </div>
                                        )}

                                        {/* Remove button */}
                                        <button
                                            type="button"
                                            onClick={() => removeMediaFile(media.id)}
                                            disabled={deploymentStatus === "deploying"}
                                            className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-red-500/80 transition-colors disabled:opacity-50 cursor-pointer"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Media Button */}
                        <div className="relative">
                            <input
                                type="file"
                                accept="image/*,video/*"
                                onChange={handleMediaFilesChange}
                                className="hidden"
                                id="media-upload"
                                multiple
                                disabled={deploymentStatus === "deploying"}
                            />
                            <label
                                htmlFor="media-upload"
                                className="block w-full py-4 px-4 border-2 border-dashed border-white/20 rounded-lg text-gray-400 hover:text-purple-400 hover:border-purple-500/50 transition-colors cursor-pointer"
                            >
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    <span className="text-sm">Click to add photos or videos</span>
                                    <span className="text-xs text-gray-500">Images up to 10MB, Videos up to 100MB</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Event Name */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                            Event Name <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            disabled={deploymentStatus === "deploying"}
                            className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 ${formErrors.name ? 'border-red-500' : 'border-white/10'}`}
                            placeholder="Enter event name"
                        />
                        {formErrors.name && <p className="mt-1 text-sm text-red-400">{formErrors.name}</p>}
                    </div>

                    {/* Collection Symbol */}
                    <div>
                        <label htmlFor="symbol" className="block text-sm font-medium text-gray-300 mb-2">
                            Collection Symbol <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            id="symbol"
                            value={form.symbol}
                            onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                            disabled={deploymentStatus === "deploying"}
                            className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 uppercase ${formErrors.symbol ? 'border-red-500' : 'border-white/10'}`}
                            placeholder="e.g., FEST, CONF, SUMMERFEST2026"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            This will be the NFT collection symbol for your tickets.
                        </p>
                        {formErrors.symbol && <p className="mt-1 text-sm text-red-400">{formErrors.symbol}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                            Description (Optional)
                        </label>
                        <textarea
                            id="description"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            disabled={deploymentStatus === "deploying"}
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 resize-none"
                            placeholder="Describe your event"
                        />
                    </div>

                    {/* Date and Time */}
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-2">
                            Date & Time <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <DateTimePicker
                                value={form.date}
                                onChange={(value) => setForm({ ...form, date: value })}
                                disabled={deploymentStatus === "deploying"}
                                error={!!formErrors.date}
                            />
                            <GmtOffsetPicker
                                value={form.timezone}
                                onChange={(value) => setForm({ ...form, timezone: value })}
                                disabled={deploymentStatus === "deploying"}
                            />
                        </div>
                        {formErrors.date && <p className="mt-1 text-sm text-red-400">{formErrors.date}</p>}
                    </div>

                    {/* Event Type */}
                    <EventTypeSelect
                        value={form.eventType}
                        onChange={(val) => setForm({ ...form, eventType: val })}
                        disabled={deploymentStatus === "deploying"}
                    />

                    {/* Venue / Platform */}
                    <div>
                        <label htmlFor="venue" className="block text-sm font-medium text-gray-300 mb-2">
                            {form.eventType === "online" ? "Platform / Meeting Link" : "Venue"} <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            id="venue"
                            value={form.venue}
                            onChange={(e) => setForm({ ...form, venue: e.target.value })}
                            disabled={deploymentStatus === "deploying"}
                            className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 ${formErrors.venue ? 'border-red-500' : 'border-white/10'}`}
                            placeholder={form.eventType === "online" ? "e.g., Zoom, Google Meet, or meeting link" : "Enter venue location"}
                        />
                        {formErrors.venue && <p className="mt-1 text-sm text-red-400">{formErrors.venue}</p>}
                    </div>

                    {/* Location Picker (only for offline events) */}
                    {/* Location Picker */}
                    <div>
                        <LocationPicker
                            value={form.location}
                            onChange={(location: LocationValue) => setForm({ ...form, location })}
                            disabled={deploymentStatus === "deploying"}
                        />
                        {formErrors.location && <p className="mt-1 text-sm text-red-400">{formErrors.location}</p>}
                    </div>

                    {/* Price and Supply Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Ticket Price */}
                        <div>
                            <label htmlFor="ticketPrice" className="block text-sm font-medium text-gray-300 mb-2">
                                Ticket Price (XTZ) <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                id="ticketPrice"
                                value={form.ticketPrice}
                                onChange={(e) => setForm({ ...form, ticketPrice: e.target.value })}
                                disabled={deploymentStatus === "deploying"}
                                step="0.001"
                                min="0"
                                className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 ${formErrors.ticketPrice ? 'border-red-500' : 'border-white/10'}`}
                                placeholder="0.1"
                            />
                            {formErrors.ticketPrice && <p className="mt-1 text-sm text-red-400">{formErrors.ticketPrice}</p>}
                        </div>

                        {/* Total Supply */}
                        <div>
                            <label htmlFor="totalSupply" className="block text-sm font-medium text-gray-300 mb-2">
                                Total Tickets <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                id="totalSupply"
                                value={form.totalSupply}
                                onChange={(e) => setForm({ ...form, totalSupply: parseInt(e.target.value) || 0 })}
                                disabled={deploymentStatus === "deploying"}
                                min="1"
                                className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 ${formErrors.totalSupply ? 'border-red-500' : 'border-white/10'}`}
                                placeholder="100"
                            />
                            {formErrors.totalSupply && <p className="mt-1 text-sm text-red-400">{formErrors.totalSupply}</p>}
                        </div>
                    </div>

                    {/* Max Tickets Per Wallet */}
                    <div>
                        <label htmlFor="maxTicketsPerWallet" className="block text-sm font-medium text-gray-300 mb-2">
                            Max Tickets Per Wallet <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="number"
                            id="maxTicketsPerWallet"
                            value={form.maxTicketsPerWallet}
                            onChange={(e) => setForm({ ...form, maxTicketsPerWallet: parseInt(e.target.value) || 1 })}
                            disabled={deploymentStatus === "deploying"}
                            min="1"
                            max={form.totalSupply || 100}
                            className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                            placeholder="5"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Maximum number of tickets a single wallet address can purchase. Helps prevent scalping.
                        </p>
                    </div>

                    {/* Max Resale Price (Optional) */}
                    <div>
                        <label htmlFor="maxResalePrice" className="block text-sm font-medium text-gray-300 mb-2">
                            Max Resale Price (XTZ) - Optional
                        </label>
                        <input
                            type="number"
                            id="maxResalePrice"
                            value={form.maxResalePrice}
                            onChange={(e) => setForm({ ...form, maxResalePrice: e.target.value })}
                            disabled={deploymentStatus === "deploying"}
                            step="0.001"
                            min="0"
                            className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                            placeholder={form.ticketPrice ? `Default: ${(parseFloat(form.ticketPrice) * 1.1).toFixed(3)} (110%)` : "Leave empty for 110% of ticket price"}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Maximum price tickets can be resold for on the marketplace.
                            {form.ticketPrice && form.maxResalePrice && parseFloat(form.maxResalePrice) > 0 && (
                                <span className="text-purple-400">
                                    {" "}({Math.round((parseFloat(form.maxResalePrice) / parseFloat(form.ticketPrice)) * 100)}% of original price)
                                </span>
                            )}
                            {!form.maxResalePrice && " Default is 110% of ticket price."}
                        </p>
                    </div>

                    {/* Royalty Percentage */}
                    <div>
                        <label htmlFor="royaltyPercent" className="block text-sm font-medium text-gray-300 mb-2">
                            Royalty Percentage <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                id="royaltyPercent"
                                value={form.royaltyPercent}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setForm({ ...form, royaltyPercent: value });
                                    // Real-time validation
                                    const royalty = parseFloat(value);
                                    if (value && (isNaN(royalty) || royalty < 0 || royalty > 10)) {
                                        setFormErrors(prev => ({ ...prev, royaltyPercent: "Royalty must be between 0% and 10%" }));
                                    } else {
                                        setFormErrors(prev => ({ ...prev, royaltyPercent: undefined }));
                                    }
                                }}
                                disabled={deploymentStatus === "deploying"}
                                step="0.5"
                                min="0"
                                max="10"
                                className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 pr-12 ${formErrors.royaltyPercent ? 'border-red-500' : 'border-white/10'}`}
                                placeholder="5"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                            Percentage you receive on secondary market sales (0-10%). This is paid by the buyer on each resale.
                        </p>
                        {formErrors.royaltyPercent && <p className="mt-1 text-sm text-red-400">{formErrors.royaltyPercent}</p>}
                    </div>

                    {/* Royalty Recipients */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Royalty Recipients (Optional)
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                            Split royalties among multiple recipients like speakers, artists, or collaborators. If no recipients are added, all royalties go to you as the organizer.
                        </p>

                        {/* Recipients List */}
                        {form.royaltyRecipients.length > 0 && (
                            <div className="space-y-3 mb-4">
                                {form.royaltyRecipients.map((recipient, index) => (
                                    <div key={recipient.id} className="p-4 bg-slate-800/30 border border-white/10 rounded-lg">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 space-y-3">
                                                {/* Name */}
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Name / Role</label>
                                                    <input
                                                        type="text"
                                                        value={recipient.name}
                                                        onChange={(e) => {
                                                            const updated = [...form.royaltyRecipients];
                                                            updated[index].name = e.target.value;
                                                            setForm({ ...form, royaltyRecipients: updated });
                                                        }}
                                                        disabled={deploymentStatus === "deploying"}
                                                        className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                                                        placeholder="e.g., Main Speaker, DJ, Venue Partner"
                                                    />
                                                </div>
                                                {/* Address and Percentage Row */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <div className="sm:col-span-2">
                                                        <label className="block text-xs text-gray-400 mb-1">Wallet Address</label>
                                                        <input
                                                            type="text"
                                                            value={recipient.address}
                                                            onChange={(e) => {
                                                                const updated = [...form.royaltyRecipients];
                                                                updated[index].address = e.target.value;
                                                                setForm({ ...form, royaltyRecipients: updated });
                                                            }}
                                                            disabled={deploymentStatus === "deploying"}
                                                            className={`w-full px-3 py-2 bg-slate-800/50 border rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 font-mono ${recipient.address && !/^0x[a-fA-F0-9]{40}$/.test(recipient.address)
                                                                ? 'border-red-500/50'
                                                                : 'border-white/10'
                                                                }`}
                                                            placeholder="0x..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1">Share %</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                value={recipient.percentage}
                                                                onChange={(e) => {
                                                                    const updated = [...form.royaltyRecipients];
                                                                    updated[index].percentage = e.target.value;
                                                                    setForm({ ...form, royaltyRecipients: updated });
                                                                }}
                                                                disabled={deploymentStatus === "deploying"}
                                                                min="1"
                                                                max="100"
                                                                className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 pr-8"
                                                                placeholder="50"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Remove Button */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = form.royaltyRecipients.filter((_, i) => i !== index);
                                                    setForm({ ...form, royaltyRecipients: updated });
                                                }}
                                                disabled={deploymentStatus === "deploying"}
                                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                                                title="Remove recipient"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Total Percentage Indicator */}
                                <div className={`flex items-center justify-between px-4 py-2 rounded-lg ${form.royaltyRecipients.reduce((sum, r) => sum + (parseFloat(r.percentage) || 0), 0) === 100
                                    ? 'bg-green-500/10 border border-green-500/30'
                                    : 'bg-yellow-500/10 border border-yellow-500/30'
                                    }`}>
                                    <span className="text-sm text-gray-300">Total allocation:</span>
                                    <span className={`font-semibold ${form.royaltyRecipients.reduce((sum, r) => sum + (parseFloat(r.percentage) || 0), 0) === 100
                                        ? 'text-green-400'
                                        : 'text-yellow-400'
                                        }`}>
                                        {form.royaltyRecipients.reduce((sum, r) => sum + (parseFloat(r.percentage) || 0), 0)}%
                                        {form.royaltyRecipients.reduce((sum, r) => sum + (parseFloat(r.percentage) || 0), 0) !== 100 && (
                                            <span className="text-xs ml-1">(must equal 100%)</span>
                                        )}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Add Recipient Button */}
                        <button
                            type="button"
                            onClick={() => {
                                const newRecipient: RoyaltyRecipient = {
                                    id: `recipient-${Date.now()}`,
                                    address: "",
                                    name: "",
                                    percentage: form.royaltyRecipients.length === 0 ? "100" : "",
                                };
                                setForm({ ...form, royaltyRecipients: [...form.royaltyRecipients, newRecipient] });
                            }}
                            disabled={deploymentStatus === "deploying"}
                            className="w-full py-3 px-4 border-2 border-dashed border-white/20 rounded-lg text-gray-400 hover:text-purple-400 hover:border-purple-500/50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add Royalty Recipient
                        </button>

                        {formErrors.royaltyRecipients && (
                            <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {formErrors.royaltyRecipients}
                            </p>
                        )}
                    </div>

                    {/* Deployment Progress */}
                    {deploymentStatus === "deploying" && (
                        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <div>
                                    <p className="text-blue-400 font-medium">Deploying Event Contract...</p>
                                    <p className="text-blue-400/70 text-sm">Please confirm the transaction in your wallet</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {deploymentStatus === "error" && error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-red-400">{error.message}</p>
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={saveDraft}
                            disabled={deploymentStatus === "deploying" || deploymentStatus === "success" || isSavingDraft}
                            className="sm:flex-1 py-4 px-6 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {isSavingDraft ? (
                                <>
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Saving...
                                </>
                            ) : draftSaved ? (
                                <>
                                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Draft Saved
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                    </svg>
                                    Save Draft
                                </>
                            )}
                        </button>
                        <button
                            type="submit"
                            disabled={deploymentStatus === "deploying" || deploymentStatus === "success"}
                            className="sm:flex-[2] py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer"
                        >
                            {deploymentStatus === "deploying" ? "Deploying..." : deploymentStatus === "success" ? "Event Created" : "Create Event"}
                        </button>
                    </div>

                    {/* Clear Draft Link */}
                    {hasDraft && deploymentStatus !== "success" && (
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={clearDraft}
                                className="text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                            >
                                Clear saved draft and start fresh
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CommentSection from "@/components/events/CommentSection";

interface MediaFile {
    url: string;
    type: "image" | "video";
}

interface EventData {
    id: string;
    name: string;
    symbol?: string;
    description?: string;
    date?: string;
    timezone?: string;
    event_type?: "online" | "offline";
    venue?: string;
    image_url?: string;
    cover_image_url?: string;
    ticket_price?: string;
    total_supply?: number;
    max_tickets_per_wallet?: number;
    max_resale_price?: string;
    royalty_percent?: string;
    organizer_address?: string;
    media_files?: MediaFile[] | string;
}

interface RoyaltyRecipient {
    id: string;
    recipient_name?: string;
    recipient_address: string;
    percentage: number;
}

export default function EventPreviewPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const draftId = searchParams.get("draft");

    const [event, setEvent] = useState<EventData | null>(null);
    const [royaltyRecipients, setRoyaltyRecipients] = useState<RoyaltyRecipient[]>([]);
    const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Gallery carousel state
    const [carouselOpen, setCarouselOpen] = useState(false);
    const [carouselIndex, setCarouselIndex] = useState(0);

    // Hero image lightbox state
    const [heroLightboxOpen, setHeroLightboxOpen] = useState(false);
    const [heroLightboxImage, setHeroLightboxImage] = useState<string | null>(null);

    useEffect(() => {
        async function fetchDraft() {
            if (!draftId) {
                router.push("/events/create");
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch(`/api/events/${draftId}`);
                if (response.ok) {
                    const data = await response.json();
                    setEvent(data.event);
                    setRoyaltyRecipients(data.royaltyRecipients || []);

                    // Parse media files
                    if (data.event?.media_files) {
                        try {
                            const parsed = typeof data.event.media_files === "string"
                                ? JSON.parse(data.event.media_files)
                                : data.event.media_files;
                            setMediaFiles(Array.isArray(parsed) ? parsed : []);
                        } catch {
                            setMediaFiles([]);
                        }
                    }
                } else {
                    router.push("/events/create");
                }
            } catch (err) {
                console.error("Failed to fetch draft:", err);
                router.push("/events/create");
            } finally {
                setIsLoading(false);
            }
        }

        fetchDraft();
    }, [draftId, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 pt-24 pb-12">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="animate-pulse">
                        <div className="h-64 bg-slate-800/50 rounded-xl mb-8" />
                        <div className="h-10 bg-slate-800/50 rounded w-2/3 mb-4" />
                        <div className="h-6 bg-slate-800/50 rounded w-1/3 mb-8" />
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="h-24 bg-slate-800/50 rounded-lg" />
                            <div className="h-24 bg-slate-800/50 rounded-lg" />
                        </div>
                        <div className="h-48 bg-slate-800/50 rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (!event) {
        return null;
    }

    // Format date
    const eventDate = event.date ? new Date(event.date) : null;
    const formattedDate = eventDate
        ? eventDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
        })
        : "Date not set";
    const formattedTime = eventDate
        ? eventDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        })
        : "";

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12">
            {/* Preview Banner */}
            <div className="fixed top-16 left-0 right-0 z-40 bg-purple-600 py-2 px-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="font-medium">Preview Mode</span>
                        <span className="text-purple-200 text-sm hidden sm:inline">— This is how your event will look once published</span>
                    </div>
                    <Link
                        href={`/events/create?draft=${draftId}`}
                        className="flex items-center gap-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                        </svg>
                        Back to Edit
                    </Link>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                {/* Back Link */}
                <Link href={`/events/create?draft=${draftId}`} className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Edit
                </Link>

                {/* Cover Image */}
                {event.cover_image_url && (
                    <div
                        className="relative h-40 -mx-4 sm:-mx-6 lg:-mx-8 mb-6 overflow-hidden cursor-pointer group"
                        onClick={() => {
                            setHeroLightboxImage(event.cover_image_url!);
                            setHeroLightboxOpen(true);
                        }}
                    >
                        <img src={event.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <svg className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Event Header Image */}
                <div className={`relative h-64 rounded-xl overflow-hidden mb-8 bg-gradient-to-br from-purple-600/20 to-pink-600/20 ${event.cover_image_url ? "-mt-16" : ""}`}>
                    {event.image_url ? (
                        <div
                            className="w-full h-full cursor-pointer group"
                            onClick={() => {
                                setHeroLightboxImage(event.image_url!);
                                setHeroLightboxOpen(true);
                            }}
                        >
                            <img
                                src={event.image_url}
                                alt={event.name || "Event"}
                                className="w-full h-full object-cover"
                            />
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <svg className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-24 h-24 text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                            </svg>
                        </div>
                    )}
                </div>

                {/* Event Title */}
                <div className="flex items-start justify-between gap-4 mb-2">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white">
                        {event.name || "Untitled Event"}
                    </h1>
                    <button
                        onClick={() => {
                            document.getElementById('get-tickets-section')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all duration-300 cursor-pointer flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                        Get Tickets
                    </button>
                </div>

                {/* Organizer */}
                <p className="text-gray-400 mb-6">
                    Organized by <span className="text-purple-400 font-medium">You</span>
                    {event.organizer_address && (
                        <span className="text-gray-500 font-mono text-sm ml-2">
                            ({event.organizer_address.slice(0, 6)}...{event.organizer_address.slice(-4)})
                        </span>
                    )}
                </p>

                {/* Event Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Date & Time</p>
                                <p className="text-white font-medium">{formattedDate}</p>
                                <p className="text-gray-400 text-sm">{formattedTime} {event.timezone && `(${event.timezone})`}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                                {event.event_type === "online" ? (
                                    <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                    {event.event_type === "online" ? "Online Event" : "Venue"}
                                </p>
                                <p className="text-white font-medium">{event.venue || "TBA"}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Event Description */}
                {event.description && (
                    <div className="mb-8 bg-slate-800/50 rounded-lg p-5 border border-white/10">
                        <h2 className="text-lg font-semibold text-white mb-3">About this event</h2>
                        <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{event.description}</p>
                    </div>
                )}

                {/* Media Gallery */}
                {mediaFiles.length > 0 && (
                    <div className="mb-8 bg-slate-800/50 rounded-lg p-5 border border-white/10">
                        <h2 className="text-lg font-semibold text-white mb-4">Event Gallery</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {mediaFiles.map((media, index) => (
                                <div
                                    key={index}
                                    className="relative aspect-video rounded-lg overflow-hidden bg-slate-900/50 cursor-pointer group"
                                    onClick={() => {
                                        setCarouselIndex(index);
                                        setCarouselOpen(true);
                                    }}
                                >
                                    {media.type === "video" ? (
                                        media.url ? (
                                            <video src={media.url} className="w-full h-full object-cover pointer-events-none" muted />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )
                                    ) : media.url ? (
                                        <img src={media.url} alt="Event media" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                    )}
                                    {media.type === "video" && (
                                        <div className="absolute top-2 left-2 bg-black/60 rounded px-1.5 py-0.5 flex items-center gap-1">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                            <span className="text-xs text-white">Video</span>
                                        </div>
                                    )}
                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                        <svg className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Gallery Carousel Modal */}
                {carouselOpen && mediaFiles.length > 0 && (
                    <div
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center"
                        onClick={() => setCarouselOpen(false)}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setCarouselOpen(false)}
                            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Previous button */}
                        {mediaFiles.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCarouselIndex((prev) => (prev === 0 ? mediaFiles.length - 1 : prev - 1));
                                }}
                                className="absolute left-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}

                        {/* Next button */}
                        {mediaFiles.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCarouselIndex((prev) => (prev === mediaFiles.length - 1 ? 0 : prev + 1));
                                }}
                                className="absolute right-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}

                        {/* Media content */}
                        <div
                            className="max-w-5xl max-h-[85vh] w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {mediaFiles[carouselIndex]?.type === "video" ? (
                                <video
                                    key={carouselIndex}
                                    src={mediaFiles[carouselIndex]?.url}
                                    className="w-full max-h-[85vh] object-contain rounded-lg"
                                    controls
                                    autoPlay
                                />
                            ) : (
                                <img
                                    key={carouselIndex}
                                    src={mediaFiles[carouselIndex]?.url}
                                    alt={`Gallery item ${carouselIndex + 1}`}
                                    className="w-full max-h-[85vh] object-contain rounded-lg"
                                />
                            )}
                        </div>

                        {/* Indicator dots */}
                        {mediaFiles.length > 1 && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                                {mediaFiles.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCarouselIndex(index);
                                        }}
                                        className={`w-2.5 h-2.5 rounded-full transition-colors cursor-pointer ${index === carouselIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/60'
                                            }`}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Counter */}
                        <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/50 rounded-full text-white text-sm">
                            {carouselIndex + 1} / {mediaFiles.length}
                        </div>
                    </div>
                )}

                {/* Hero Image Lightbox Modal */}
                {heroLightboxOpen && heroLightboxImage && (
                    <div
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center"
                        onClick={() => setHeroLightboxOpen(false)}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setHeroLightboxOpen(false)}
                            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Image content */}
                        <div
                            className="max-w-5xl max-h-[85vh] w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={heroLightboxImage}
                                alt="Event image"
                                className="w-full max-h-[85vh] object-contain rounded-lg"
                            />
                        </div>
                    </div>
                )}

                {/* Ticket Details Section */}
                <div className="bg-slate-800/50 rounded-lg p-5 border border-white/10 mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4">Ticket Details</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {event.symbol && (
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Token Symbol</p>
                                <p className="text-white font-medium">{event.symbol}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Max per Wallet</p>
                            <p className="text-white font-medium">{event.max_tickets_per_wallet || 5}</p>
                        </div>
                        {event.max_resale_price && (
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Max Resale Price</p>
                                <p className="text-white font-medium">{event.max_resale_price} XTZ</p>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Resale Royalty</p>
                            <p className="text-white font-medium">{event.royalty_percent || "0"}%</p>
                        </div>
                    </div>
                </div>

                {/* Royalty Recipients Section */}
                {royaltyRecipients.length > 0 && (
                    <div className="bg-slate-800/50 rounded-lg p-5 border border-white/10 mb-8">
                        <h2 className="text-lg font-semibold text-white mb-4">Royalty Recipients</h2>
                        <p className="text-gray-400 text-sm mb-4">
                            When tickets are resold, royalties are distributed to the following recipients:
                        </p>
                        <div className="space-y-3">
                            {royaltyRecipients.map((recipient) => (
                                <div
                                    key={recipient.id}
                                    className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <div>
                                            {recipient.recipient_name && (
                                                <p className="text-white font-medium text-sm">{recipient.recipient_name}</p>
                                            )}
                                            <p className="text-gray-400 font-mono text-xs">
                                                {recipient.recipient_address.slice(0, 6)}...{recipient.recipient_address.slice(-4)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">
                                            {recipient.percentage}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Total Royalty Distribution</span>
                            <span className="text-white font-medium">
                                {royaltyRecipients.reduce((sum, r) => sum + r.percentage, 0)}%
                            </span>
                        </div>
                    </div>
                )}

                {/* Purchase Section (Preview) */}
                <div id="get-tickets-section" className="bg-slate-800/50 rounded-xl p-6 border border-white/10">
                    <h2 className="text-xl font-semibold text-white mb-6">Get Tickets</h2>

                    <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Price per ticket</p>
                            <p className="text-2xl font-bold text-white">{event.ticket_price || "0"} XTZ</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Available</p>
                            <p className="text-2xl font-bold text-green-400">{event.total_supply || 0} / {event.total_supply || 0}</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm text-gray-400 mb-2">Quantity</label>
                        <div className="flex items-center gap-4">
                            <button disabled className="w-10 h-10 rounded-lg bg-slate-700 text-white flex items-center justify-center opacity-50 cursor-not-allowed">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                            </button>
                            <span className="text-2xl font-bold text-white w-12 text-center">1</span>
                            <button disabled className="w-10 h-10 rounded-lg bg-slate-700 text-white flex items-center justify-center opacity-50 cursor-not-allowed">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-6 p-4 bg-slate-900/50 rounded-lg">
                        <span className="text-gray-400">Total</span>
                        <span className="text-xl font-bold text-white">{event.ticket_price || "0"} XTZ</span>
                    </div>

                    <button disabled className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg opacity-50 cursor-not-allowed">
                        Buy 1 Ticket
                    </button>

                    <p className="text-center text-gray-500 text-sm mt-4">
                        This is a preview. Purchasing will be available after the event is published.
                    </p>
                </div>

                {/* Comments Section (Preview) */}
                <div className="mt-8">
                    <CommentSection eventId={event.id} preview />
                </div>

                {/* Back to Edit Button */}
                <div className="mt-8 text-center">
                    <Link
                        href={`/events/create?draft=${draftId}`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-white/10"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                        </svg>
                        Back to Edit
                    </Link>
                </div>
            </div>
        </div>
    );
}

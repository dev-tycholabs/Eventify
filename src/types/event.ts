export interface Event {
    id: string;
    contractAddress: `0x${string}`;
    chainId: number;
    name: string;
    description: string;
    date: Date;
    venue: string;
    imageUrl: string;
    ticketPrice: bigint;
    totalSupply: number;
    soldCount: number;
    organizer: `0x${string}`;
    maxResalePrice?: bigint;
    city?: string;
    country?: string;
    distance_km?: number | null;
}

export type EventType = "online" | "offline";

export interface RoyaltyRecipient {
    id: string;
    address: string;
    name: string;
    percentage: string;
}

export interface MediaFile {
    id: string;
    file: File | null;
    previewUrl: string;
    ipfsUrl?: string;
    ipfsProtocolUrl?: string;
    type: "image" | "video";
    isUploading: boolean;
    error?: string;
}

export interface EventCreationForm {
    name: string;
    symbol: string;
    description: string;
    date: string;
    timezone: string;
    eventType: EventType;
    venue: string;
    location: {
        countryId: number | null;
        countryName: string;
        stateId: number | null;
        stateName: string;
        cityId: number | null;
        cityName: string;
    };
    image: File | null;
    imageUrl?: string;
    coverImage: File | null;
    coverImageUrl?: string;
    ticketPrice: string;
    totalSupply: number;
    maxTicketsPerWallet: number;
    maxResalePrice?: string;
    royaltyPercent: string;
    royaltyRecipients: RoyaltyRecipient[];
    mediaFiles: MediaFile[];
}

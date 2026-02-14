export interface NFTTicket {
    tokenId: bigint;
    eventId: string;
    eventContractAddress: `0x${string}`;
    owner: `0x${string}`;
    isUsed: boolean;
    purchaseDate: Date;
    metadata: TicketMetadata;
}

export interface TicketMetadata {
    name: string;
    description: string;
    image: string;
    attributes: {
        eventName: string;
        eventDate: string;
        venue: string;
        ticketType: string;
        seatInfo?: string;
    };
}

export interface MarketplaceListing {
    listingId: bigint;
    tokenId: bigint;
    eventContractAddress: `0x${string}`;
    seller: `0x${string}`;
    price: bigint;
    isActive: boolean;
    listedAt: Date;
}

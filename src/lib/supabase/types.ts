export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type EventType = "online" | "offline";
export type EventStatus = "draft" | "published";
export type ListingStatus = "active" | "sold" | "cancelled";
export type TransactionType = "purchase" | "sale" | "listing" | "transfer" | "cancel" | "use";
export type RoyaltyDistributionAction = "claim_and_distribute" | "distribute" | "direct_claim";

// Per-recipient snapshot stored in royalty_distributions.recipients JSONB
export interface RoyaltyDistributionRecipient {
    address: string;
    percentage: number;
    amount_distributed: string;
}

// Media file type for event gallery
export interface MediaFileJson {
    url: string;
    type: "image" | "video";
}

export interface Database {
    graphql_public: {
        Tables: Record<string, never>;
        Views: Record<string, never>;
        Functions: {
            graphql: {
                Args: {
                    operationName?: string;
                    query?: string;
                    variables?: Json;
                    extensions?: Json;
                };
                Returns: Json;
            };
        };
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
    public: {
        Tables: {
            chat_messages: {
                Row: {
                    id: string;
                    event_id: string;
                    user_address: string;
                    content: string;
                    created_at: string;
                    reply_to: string | null;
                    edited_at: string | null;
                    deleted_at: string | null;
                    deleted_for: string[];
                };
                Insert: {
                    id?: string;
                    event_id: string;
                    user_address: string;
                    content: string;
                    created_at?: string;
                    reply_to?: string | null;
                    edited_at?: string | null;
                    deleted_at?: string | null;
                    deleted_for?: string[];
                };
                Update: {
                    id?: string;
                    event_id?: string;
                    user_address?: string;
                    content?: string;
                    created_at?: string;
                    reply_to?: string | null;
                    edited_at?: string | null;
                    deleted_at?: string | null;
                    deleted_for?: string[];
                };
                Relationships: [
                    {
                        foreignKeyName: "chat_messages_event_id_fkey";
                        columns: ["event_id"];
                        referencedRelation: "events";
                        referencedColumns: ["id"];
                    }
                ];
            };
            comments: {
                Row: {
                    id: string;
                    event_id: string;
                    user_address: string;
                    content: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    event_id: string;
                    user_address: string;
                    content: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    event_id?: string;
                    user_address?: string;
                    content?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "comments_event_id_fkey";
                        columns: ["event_id"];
                        referencedRelation: "events";
                        referencedColumns: ["id"];
                    }
                ];
            };
            users: {
                Row: {
                    id: string;
                    wallet_address: string;
                    username: string | null;
                    name: string | null;
                    email: string | null;
                    contact_number: string | null;
                    avatar_url: string | null;
                    bio: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    wallet_address: string;
                    username?: string | null;
                    name?: string | null;
                    email?: string | null;
                    contact_number?: string | null;
                    avatar_url?: string | null;
                    bio?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    wallet_address?: string;
                    username?: string | null;
                    name?: string | null;
                    email?: string | null;
                    contact_number?: string | null;
                    avatar_url?: string | null;
                    bio?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            events: {
                Row: {
                    id: string;
                    chain_id: number;
                    contract_address: string | null;
                    organizer_address: string;
                    name: string;
                    symbol: string | null;
                    description: string | null;
                    date: string | null;
                    timezone: string;
                    event_type: EventType;
                    venue: string | null;
                    country: string | null;
                    state: string | null;
                    city: string | null;
                    image_url: string | null;
                    cover_image_url: string | null;
                    media_files: MediaFileJson[];
                    ticket_price: string | null;
                    total_supply: number | null;
                    sold_count: number;
                    max_tickets_per_wallet: number;
                    max_resale_price: string | null;
                    royalty_percent: string | null;
                    royalty_splitter_address: string | null;
                    status: EventStatus;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    chain_id: number;
                    contract_address?: string | null;
                    organizer_address: string;
                    name: string;
                    symbol?: string | null;
                    description?: string | null;
                    date?: string | null;
                    timezone?: string;
                    event_type?: EventType;
                    venue?: string | null;
                    country?: string | null;
                    state?: string | null;
                    city?: string | null;
                    image_url?: string | null;
                    cover_image_url?: string | null;
                    media_files?: MediaFileJson[];
                    ticket_price?: string | null;
                    total_supply?: number | null;
                    sold_count?: number;
                    max_tickets_per_wallet?: number;
                    max_resale_price?: string | null;
                    royalty_percent?: string | null;
                    royalty_splitter_address?: string | null;
                    status?: EventStatus;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    chain_id?: number;
                    contract_address?: string | null;
                    organizer_address?: string;
                    name?: string;
                    symbol?: string | null;
                    description?: string | null;
                    date?: string | null;
                    timezone?: string;
                    event_type?: EventType;
                    venue?: string | null;
                    country?: string | null;
                    state?: string | null;
                    city?: string | null;
                    image_url?: string | null;
                    cover_image_url?: string | null;
                    media_files?: MediaFileJson[];
                    ticket_price?: string | null;
                    total_supply?: number | null;
                    sold_count?: number;
                    max_tickets_per_wallet?: number;
                    max_resale_price?: string | null;
                    royalty_percent?: string | null;
                    royalty_splitter_address?: string | null;
                    status?: EventStatus;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            marketplace_listings: {
                Row: {
                    id: string;
                    chain_id: number;
                    listing_id: string;
                    token_id: string;
                    event_contract_address: string;
                    event_id: string | null;
                    seller_address: string;
                    price: string;
                    status: ListingStatus;
                    buyer_address: string | null;
                    listed_at: string;
                    sold_at: string | null;
                    cancelled_at: string | null;
                    tx_hash: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    chain_id: number;
                    listing_id: string;
                    token_id: string;
                    event_contract_address: string;
                    event_id?: string | null;
                    seller_address: string;
                    price: string;
                    status?: ListingStatus;
                    buyer_address?: string | null;
                    listed_at?: string;
                    sold_at?: string | null;
                    cancelled_at?: string | null;
                    tx_hash?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    chain_id?: number;
                    listing_id?: string;
                    token_id?: string;
                    event_contract_address?: string;
                    event_id?: string | null;
                    seller_address?: string;
                    price?: string;
                    status?: ListingStatus;
                    buyer_address?: string | null;
                    listed_at?: string;
                    sold_at?: string | null;
                    cancelled_at?: string | null;
                    tx_hash?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            user_tickets: {
                Row: {
                    id: string;
                    chain_id: number;
                    token_id: string;
                    event_contract_address: string;
                    event_id: string | null;
                    owner_address: string;
                    is_used: boolean;
                    is_listed: boolean;
                    listing_id: string | null;
                    purchase_price: string | null;
                    purchase_tx_hash: string | null;
                    purchased_at: string;
                    used_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    chain_id: number;
                    token_id: string;
                    event_contract_address: string;
                    event_id?: string | null;
                    owner_address: string;
                    is_used?: boolean;
                    is_listed?: boolean;
                    listing_id?: string | null;
                    purchase_price?: string | null;
                    purchase_tx_hash?: string | null;
                    purchased_at?: string;
                    used_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    chain_id?: number;
                    token_id?: string;
                    event_contract_address?: string;
                    event_id?: string | null;
                    owner_address?: string;
                    is_used?: boolean;
                    is_listed?: boolean;
                    listing_id?: string | null;
                    purchase_price?: string | null;
                    purchase_tx_hash?: string | null;
                    purchased_at?: string;
                    used_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            transactions: {
                Row: {
                    id: string;
                    chain_id: number;
                    tx_hash: string;
                    tx_type: TransactionType;
                    user_address: string;
                    token_id: string | null;
                    event_contract_address: string | null;
                    event_id: string | null;
                    listing_id: string | null;
                    amount: string | null;
                    from_address: string | null;
                    to_address: string | null;
                    block_number: string | null;
                    tx_timestamp: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    chain_id: number;
                    tx_hash: string;
                    tx_type: TransactionType;
                    user_address: string;
                    token_id?: string | null;
                    event_contract_address?: string | null;
                    event_id?: string | null;
                    listing_id?: string | null;
                    amount?: string | null;
                    from_address?: string | null;
                    to_address?: string | null;
                    block_number?: string | null;
                    tx_timestamp: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    chain_id?: number;
                    tx_hash?: string;
                    tx_type?: TransactionType;
                    user_address?: string;
                    token_id?: string | null;
                    event_contract_address?: string | null;
                    event_id?: string | null;
                    listing_id?: string | null;
                    amount?: string | null;
                    from_address?: string | null;
                    to_address?: string | null;
                    block_number?: string | null;
                    tx_timestamp?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
            royalty_recipients: {
                Row: {
                    id: string;
                    event_id: string;
                    recipient_address: string;
                    recipient_name: string | null;
                    percentage: number;
                    royalty_earned: string;
                    royalty_claimed: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    event_id: string;
                    recipient_address: string;
                    recipient_name?: string | null;
                    percentage: number;
                    royalty_earned?: string;
                    royalty_claimed?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    event_id?: string;
                    recipient_address?: string;
                    recipient_name?: string | null;
                    percentage?: number;
                    royalty_earned?: string;
                    royalty_claimed?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "royalty_recipients_event_id_fkey";
                        columns: ["event_id"];
                        referencedRelation: "events";
                        referencedColumns: ["id"];
                    }
                ];
            };
            cities: {
                Row: {
                    id: number;
                    name: string;
                    state_id: number;
                    state_code: string;
                    country_id: number;
                    country_code: string;
                    latitude: string;
                    longitude: string;
                    created_at: string;
                    updated_at: string;
                    flag: number;
                    wikiDataId: string | null;
                };
                Insert: {
                    id?: number;
                    name: string;
                    state_id: number;
                    state_code: string;
                    country_id: number;
                    country_code: string;
                    latitude: string;
                    longitude: string;
                    created_at?: string;
                    updated_at?: string;
                    flag?: number;
                    wikiDataId?: string | null;
                };
                Update: {
                    id?: number;
                    name?: string;
                    state_id?: number;
                    state_code?: string;
                    country_id?: number;
                    country_code?: string;
                    latitude?: string;
                    longitude?: string;
                    created_at?: string;
                    updated_at?: string;
                    flag?: number;
                    wikiDataId?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "cities_state_id_fkey";
                        columns: ["state_id"];
                        referencedRelation: "states";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "cities_country_id_fkey";
                        columns: ["country_id"];
                        referencedRelation: "countries";
                        referencedColumns: ["id"];
                    }
                ];
            };
            states: {
                Row: {
                    id: number;
                    name: string;
                    country_id: number;
                    country_code: string;
                    fips_code: string | null;
                    iso2: string | null;
                    type: string | null;
                    latitude: string | null;
                    longitude: string | null;
                    created_at: string;
                    updated_at: string;
                    flag: number;
                    wikiDataId: string | null;
                };
                Insert: {
                    id?: number;
                    name: string;
                    country_id: number;
                    country_code: string;
                    fips_code?: string | null;
                    iso2?: string | null;
                    type?: string | null;
                    latitude?: string | null;
                    longitude?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    flag?: number;
                    wikiDataId?: string | null;
                };
                Update: {
                    id?: number;
                    name?: string;
                    country_id?: number;
                    country_code?: string;
                    fips_code?: string | null;
                    iso2?: string | null;
                    type?: string | null;
                    latitude?: string | null;
                    longitude?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    flag?: number;
                    wikiDataId?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "states_country_id_fkey";
                        columns: ["country_id"];
                        referencedRelation: "countries";
                        referencedColumns: ["id"];
                    }
                ];
            };
            countries: {
                Row: {
                    id: number;
                    name: string;
                    iso3: string | null;
                    numeric_code: string | null;
                    iso2: string | null;
                    phonecode: string | null;
                    capital: string | null;
                    currency: string | null;
                    currency_name: string | null;
                    currency_symbol: string | null;
                    tld: string | null;
                    native: string | null;
                    region: string | null;
                    region_id: number | null;
                    subregion: string | null;
                    subregion_id: number | null;
                    nationality: string | null;
                    latitude: string | null;
                    longitude: string | null;
                    emoji: string | null;
                    emojiU: string | null;
                    created_at: string;
                    updated_at: string;
                    flag: number;
                    wikiDataId: string | null;
                };
                Insert: {
                    id?: number;
                    name: string;
                    iso3?: string | null;
                    numeric_code?: string | null;
                    iso2?: string | null;
                    phonecode?: string | null;
                    capital?: string | null;
                    currency?: string | null;
                    currency_name?: string | null;
                    currency_symbol?: string | null;
                    tld?: string | null;
                    native?: string | null;
                    region?: string | null;
                    region_id?: number | null;
                    subregion?: string | null;
                    subregion_id?: number | null;
                    nationality?: string | null;
                    latitude?: string | null;
                    longitude?: string | null;
                    emoji?: string | null;
                    emojiU?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    flag?: number;
                    wikiDataId?: string | null;
                };
                Update: {
                    id?: number;
                    name?: string;
                    iso3?: string | null;
                    numeric_code?: string | null;
                    iso2?: string | null;
                    phonecode?: string | null;
                    capital?: string | null;
                    currency?: string | null;
                    currency_name?: string | null;
                    currency_symbol?: string | null;
                    tld?: string | null;
                    native?: string | null;
                    region?: string | null;
                    region_id?: number | null;
                    subregion?: string | null;
                    subregion_id?: number | null;
                    nationality?: string | null;
                    latitude?: string | null;
                    longitude?: string | null;
                    emoji?: string | null;
                    emojiU?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    flag?: number;
                    wikiDataId?: string | null;
                };
                Relationships: [];
            };
            royalty_distributions: {
                Row: {
                    id: string;
                    chain_id: number;
                    event_id: string;
                    splitter_address: string;
                    tx_hash: string;
                    action: RoyaltyDistributionAction;
                    total_distributed: string;
                    triggered_by: string;
                    recipients: RoyaltyDistributionRecipient[];
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    chain_id: number;
                    event_id: string;
                    splitter_address: string;
                    tx_hash: string;
                    action: RoyaltyDistributionAction;
                    total_distributed: string;
                    triggered_by: string;
                    recipients: RoyaltyDistributionRecipient[];
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    chain_id?: number;
                    event_id?: string;
                    splitter_address?: string;
                    tx_hash?: string;
                    action?: RoyaltyDistributionAction;
                    total_distributed?: string;
                    triggered_by?: string;
                    recipients?: RoyaltyDistributionRecipient[];
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "royalty_distributions_event_id_fkey";
                        columns: ["event_id"];
                        referencedRelation: "events";
                        referencedColumns: ["id"];
                    }
                ];
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: {
            event_type: EventType;
            event_status: EventStatus;
            listing_status: ListingStatus;
            transaction_type: TransactionType;
        };
        CompositeTypes: Record<string, never>;
    };
}

// Helper types
export type Tables<T extends keyof Database["public"]["Tables"]> =
    Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
    Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
    Database["public"]["Tables"][T]["Update"];

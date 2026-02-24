// API sync utilities for syncing blockchain data to Supabase

interface SyncListingParams {
    listing_id: string;
    token_id: string;
    event_contract_address: string;
    event_id?: string;
    seller_address: string;
    price: string;
    tx_hash?: string;
    action: "list" | "buy" | "cancel";
    buyer_address?: string;
    chain_id: number;
}

interface SyncTicketParams {
    token_id: string;
    event_contract_address: string;
    event_id?: string;
    owner_address: string;
    is_used?: boolean;
    is_listed?: boolean;
    listing_id?: string;
    purchase_price?: string;
    purchase_tx_hash?: string;
    action: "mint" | "transfer" | "use" | "list" | "unlist";
    chain_id: number;
}

interface SyncTransactionParams {
    tx_hash: string;
    tx_type: "purchase" | "sale" | "listing" | "transfer" | "cancel";
    user_address: string;
    token_id?: string;
    event_contract_address?: string;
    event_id?: string;
    listing_id?: string;
    amount?: string;
    from_address?: string;
    to_address?: string;
    block_number?: string;
    tx_timestamp: string;
    chain_id: number;
}

export async function syncListing(params: SyncListingParams): Promise<boolean> {
    try {
        const response = await fetch("/api/marketplace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            console.error("Failed to sync listing:", await response.text());
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error syncing listing:", error);
        return false;
    }
}

export async function syncTicket(params: SyncTicketParams): Promise<boolean> {
    try {
        const response = await fetch("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            console.error("Failed to sync ticket:", await response.text());
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error syncing ticket:", error);
        return false;
    }
}

export async function syncTransaction(params: SyncTransactionParams): Promise<boolean> {
    try {
        const response = await fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            console.error("Failed to sync transaction:", await response.text());
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error syncing transaction:", error);
        return false;
    }
}

// Helper to find event_id from contract address
export async function findEventIdByContract(contractAddress: string): Promise<string | null> {
    try {
        const response = await fetch(
            `/api/events?contract_address=${contractAddress.toLowerCase()}`
        );

        if (!response.ok) return null;

        const data = await response.json();
        if (data.events && data.events.length > 0) {
            return data.events[0].id;
        }

        return null;
    } catch {
        return null;
    }
}

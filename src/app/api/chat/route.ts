import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createPublicClient, http } from "viem";
import { SUPPORTED_CHAINS, getContractsForChain } from "@/config/chains";

// Create a public client per supported chain
const publicClients = Object.fromEntries(
    SUPPORTED_CHAINS.map((chain) => [
        chain.id,
        createPublicClient({ chain, transport: http() }),
    ])
);

const balanceOfAbi = [
    {
        inputs: [{ internalType: "address", name: "owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

const getListingsBySellerAbi = [
    {
        inputs: [{ internalType: "address", name: "seller", type: "address" }],
        name: "getListingsBySeller",
        outputs: [
            {
                components: [
                    { internalType: "uint256", name: "id", type: "uint256" },
                    { internalType: "uint256", name: "tokenId", type: "uint256" },
                    { internalType: "address", name: "nftAddress", type: "address" },
                    { internalType: "address", name: "seller", type: "address" },
                    { internalType: "address", name: "currency", type: "address" },
                    { internalType: "uint256", name: "price", type: "uint256" },
                    { internalType: "uint256", name: "createdAt", type: "uint256" },
                    { internalType: "bool", name: "active", type: "bool" },
                ],
                internalType: "struct TicketMarketplace.Listing[]",
                name: "sellerListings",
                type: "tuple[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const;

// --- Token holder cache (60s TTL) to avoid RPC spam ---
const tokenCache = new Map<string, { isHolder: boolean; expiry: number }>();
const TOKEN_CACHE_TTL = 60_000;

async function hasActiveListingForEvent(
    eventContractAddress: string,
    walletAddress: string,
    chainId: number
): Promise<boolean> {
    try {
        const client = publicClients[chainId];
        const contracts = getContractsForChain(chainId);
        if (!client || !contracts) return false;

        const listings = await client.readContract({
            address: contracts.TicketMarketplace,
            abi: getListingsBySellerAbi,
            functionName: "getListingsBySeller",
            args: [walletAddress as `0x${string}`],
        });
        return listings.some(
            (l) =>
                l.nftAddress.toLowerCase() === eventContractAddress.toLowerCase() &&
                l.active
        );
    } catch (err) {
        console.error("Marketplace listing check failed:", err);
        return false;
    }
}

async function verifyTokenHolder(
    contractAddress: string,
    walletAddress: string,
    chainId: number
): Promise<boolean> {
    const cacheKey = `${chainId}:${contractAddress.toLowerCase()}:${walletAddress.toLowerCase()}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
        return cached.isHolder;
    }
    try {
        const client = publicClients[chainId];
        if (!client) return false;

        const balance = await client.readContract({
            address: contractAddress as `0x${string}`,
            abi: balanceOfAbi,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
        });
        let isHolder = balance > BigInt(0);
        if (!isHolder) {
            isHolder = await hasActiveListingForEvent(contractAddress, walletAddress, chainId);
        }
        tokenCache.set(cacheKey, { isHolder, expiry: Date.now() + TOKEN_CACHE_TTL });
        return isHolder;
    } catch (err) {
        console.error("Token verification failed:", err);
        return false;
    }
}

// --- Rate limiter: 20 messages per 60s per address ---
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(address: string): boolean {
    const now = Date.now();
    const key = address.toLowerCase();
    const entry = rateLimitMap.get(key);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(key, { count: 1, windowStart: now });
        return true;
    }
    if (entry.count >= RATE_LIMIT_MAX) return false;
    entry.count++;
    return true;
}

// --- Sanitization ---
function sanitizeContent(input: string): string {
    return input
        .replace(/[<>]/g, "")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .trim();
}

function isValidAddress(addr: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function isValidUUID(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// GET /api/chat?event_id=...&user_address=...&before=...
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get("event_id");
        const userAddress = searchParams.get("user_address");
        const before = searchParams.get("before");

        if (!eventId || !userAddress) {
            return NextResponse.json(
                { error: "event_id and user_address are required" },
                { status: 400 }
            );
        }

        if (!isValidUUID(eventId) || !isValidAddress(userAddress)) {
            return NextResponse.json(
                { error: "Invalid event_id or user_address format" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        const { data: event } = await supabase
            .from("events")
            .select("contract_address, organizer_address, chain_id")
            .eq("id", eventId)
            .single();

        if (!event?.contract_address) {
            return NextResponse.json(
                { error: "Event not found or contract not deployed" },
                { status: 404 }
            );
        }

        const isOrganizer =
            event.organizer_address.toLowerCase() === userAddress.toLowerCase();
        if (!isOrganizer) {
            const isHolder = await verifyTokenHolder(
                event.contract_address,
                userAddress,
                event.chain_id
            );
            if (!isHolder) {
                return NextResponse.json(
                    { error: "You must hold a ticket to access this chat" },
                    { status: 403 }
                );
            }
        }

        const query = supabase
            .from("chat_messages")
            .select("*")
            .eq("event_id", eventId)
            .is("deleted_at", null);

        if (before) {
            query.lt("created_at", before);
        }

        const { data: rawMessages, error } = await query
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) throw error;

        type ChatMsg = {
            id: string; event_id: string; user_address: string; content: string;
            created_at: string; reply_to: string | null; edited_at: string | null;
            deleted_at: string | null; deleted_for: string[];
        };
        const messages = (rawMessages || []) as ChatMsg[];

        // Filter out messages deleted for this user
        const addr = userAddress.toLowerCase();
        const filtered = messages.filter(
            (m) => !(m.deleted_for || []).includes(addr)
        );

        const sorted = filtered.reverse();

        // Collect reply_to IDs to fetch replied-to messages
        const replyIds = [...new Set(sorted.map((m) => m.reply_to).filter(Boolean))] as string[];
        let replyMap = new Map<string, { id: string; content: string; user_address: string; deleted_at: string | null }>();
        if (replyIds.length > 0) {
            const { data: replyMsgs } = await supabase
                .from("chat_messages")
                .select("id, content, user_address, deleted_at")
                .in("id", replyIds);
            replyMap = new Map((replyMsgs || []).map((r) => [r.id, r]));
        }

        // Batch fetch user info
        const allAddresses = [...new Set([
            ...sorted.map((m) => m.user_address),
            ...Array.from(replyMap.values()).map((r) => r.user_address),
        ])];
        let userMap = new Map<string, { wallet_address: string; username: string | null; name: string | null; avatar_url: string | null }>();
        if (allAddresses.length > 0) {
            const { data: users } = await supabase
                .from("users")
                .select("wallet_address, username, name, avatar_url")
                .in("wallet_address", allAddresses);
            userMap = new Map((users || []).map((u) => [u.wallet_address, u]));
        }

        const enriched = sorted.map((m) => {
            let replyToMessage = null;
            if (m.reply_to) {
                const replied = replyMap.get(m.reply_to);
                if (replied) {
                    replyToMessage = {
                        id: replied.id,
                        content: replied.deleted_at ? "This message was deleted" : replied.content,
                        user_address: replied.user_address,
                        user: userMap.get(replied.user_address) || null,
                    };
                }
            }
            return {
                ...m,
                user: userMap.get(m.user_address) || null,
                reply_to_message: replyToMessage,
            };
        });

        const hasMore = filtered.length === 50;

        return NextResponse.json({ messages: enriched, hasMore });
    } catch (error) {
        console.error("Error fetching chat:", error);
        return NextResponse.json(
            { error: "Failed to fetch messages" },
            { status: 500 }
        );
    }
}

// POST /api/chat  (send message, with optional reply_to)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { event_id, user_address, content, reply_to } = body;

        if (!event_id || !user_address || !content?.trim()) {
            return NextResponse.json(
                { error: "event_id, user_address, and content are required" },
                { status: 400 }
            );
        }

        if (!isValidUUID(event_id) || !isValidAddress(user_address)) {
            return NextResponse.json(
                { error: "Invalid event_id or user_address format" },
                { status: 400 }
            );
        }

        if (reply_to && !isValidUUID(reply_to)) {
            return NextResponse.json(
                { error: "Invalid reply_to format" },
                { status: 400 }
            );
        }

        const sanitized = sanitizeContent(content);
        if (!sanitized || sanitized.length === 0) {
            return NextResponse.json(
                { error: "Message content is empty after sanitization" },
                { status: 400 }
            );
        }
        if (sanitized.length > 500) {
            return NextResponse.json(
                { error: "Message must be 500 characters or less" },
                { status: 400 }
            );
        }

        if (!checkRateLimit(user_address)) {
            return NextResponse.json(
                { error: "Too many messages. Please wait a moment." },
                { status: 429 }
            );
        }

        const supabase = createServerClient();

        const { data: event } = await supabase
            .from("events")
            .select("contract_address, organizer_address, chain_id")
            .eq("id", event_id)
            .single();

        if (!event?.contract_address) {
            return NextResponse.json(
                { error: "Event not found or contract not deployed" },
                { status: 404 }
            );
        }

        const isOrganizer =
            event.organizer_address.toLowerCase() === user_address.toLowerCase();
        if (!isOrganizer) {
            const isHolder = await verifyTokenHolder(
                event.contract_address,
                user_address,
                event.chain_id
            );
            if (!isHolder) {
                return NextResponse.json(
                    { error: "You must hold a ticket to send messages" },
                    { status: 403 }
                );
            }
        }

        const { data: userRecord } = await supabase
            .from("users")
            .select("wallet_address")
            .eq("wallet_address", user_address.toLowerCase())
            .single();

        if (!userRecord) {
            return NextResponse.json(
                { error: "User not found. Please sign in first." },
                { status: 401 }
            );
        }

        const insertData: { event_id: string; user_address: string; content: string; reply_to?: string } = {
            event_id,
            user_address: user_address.toLowerCase(),
            content: sanitized,
        };
        if (reply_to) insertData.reply_to = reply_to;

        const { data, error } = await supabase
            .from("chat_messages")
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;

        // Fetch user info for response
        const { data: userData } = await supabase
            .from("users")
            .select("wallet_address, username, name, avatar_url")
            .eq("wallet_address", user_address.toLowerCase())
            .single();

        // If replying, fetch the replied-to message info
        let replyToMessage = null;
        if (reply_to) {
            const { data: repliedMsg } = await supabase
                .from("chat_messages")
                .select("id, content, user_address, deleted_at")
                .eq("id", reply_to)
                .single();
            if (repliedMsg) {
                const { data: replyUser } = await supabase
                    .from("users")
                    .select("wallet_address, username, name, avatar_url")
                    .eq("wallet_address", repliedMsg.user_address)
                    .single();
                replyToMessage = {
                    id: repliedMsg.id,
                    content: repliedMsg.deleted_at ? "This message was deleted" : repliedMsg.content,
                    user_address: repliedMsg.user_address,
                    user: replyUser || null,
                };
            }
        }

        return NextResponse.json({
            message: { ...data, user: userData || null, reply_to_message: replyToMessage },
        });
    } catch (error) {
        console.error("Error sending message:", error);
        return NextResponse.json(
            { error: "Failed to send message" },
            { status: 500 }
        );
    }
}

// PATCH /api/chat  (edit a message)
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { message_id, user_address, content } = body;

        if (!message_id || !user_address || !content?.trim()) {
            return NextResponse.json(
                { error: "message_id, user_address, and content are required" },
                { status: 400 }
            );
        }

        if (!isValidUUID(message_id) || !isValidAddress(user_address)) {
            return NextResponse.json(
                { error: "Invalid message_id or user_address format" },
                { status: 400 }
            );
        }

        const sanitized = sanitizeContent(content);
        if (!sanitized || sanitized.length === 0) {
            return NextResponse.json(
                { error: "Message content is empty after sanitization" },
                { status: 400 }
            );
        }
        if (sanitized.length > 500) {
            return NextResponse.json(
                { error: "Message must be 500 characters or less" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // Verify ownership
        const { data: msg } = await supabase
            .from("chat_messages")
            .select("id, user_address, deleted_at")
            .eq("id", message_id)
            .single();

        if (!msg) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }
        if (msg.user_address.toLowerCase() !== user_address.toLowerCase()) {
            return NextResponse.json({ error: "You can only edit your own messages" }, { status: 403 });
        }
        if (msg.deleted_at) {
            return NextResponse.json({ error: "Cannot edit a deleted message" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("chat_messages")
            .update({ content: sanitized, edited_at: new Date().toISOString() })
            .eq("id", message_id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ message: data });
    } catch (error) {
        console.error("Error editing message:", error);
        return NextResponse.json(
            { error: "Failed to edit message" },
            { status: 500 }
        );
    }
}

// DELETE /api/chat  (delete a message: for_everyone or for_me)
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { message_id, user_address, mode } = body; // mode: "for_everyone" | "for_me"

        if (!message_id || !user_address || !mode) {
            return NextResponse.json(
                { error: "message_id, user_address, and mode are required" },
                { status: 400 }
            );
        }

        if (!isValidUUID(message_id) || !isValidAddress(user_address)) {
            return NextResponse.json(
                { error: "Invalid message_id or user_address format" },
                { status: 400 }
            );
        }

        if (mode !== "for_everyone" && mode !== "for_me") {
            return NextResponse.json(
                { error: "mode must be 'for_everyone' or 'for_me'" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();
        const addr = user_address.toLowerCase();

        const { data: msg } = await supabase
            .from("chat_messages")
            .select("id, user_address, deleted_at, deleted_for")
            .eq("id", message_id)
            .single();

        if (!msg) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        if (mode === "for_everyone") {
            // Only the message author can delete for everyone
            if (msg.user_address.toLowerCase() !== addr) {
                return NextResponse.json(
                    { error: "You can only delete your own messages for everyone" },
                    { status: 403 }
                );
            }
            const { error } = await supabase
                .from("chat_messages")
                .update({ deleted_at: new Date().toISOString(), content: "" })
                .eq("id", message_id);

            if (error) throw error;
        } else {
            // "for_me" - add address to deleted_for array
            const currentDeletedFor: string[] = msg.deleted_for || [];
            if (!currentDeletedFor.includes(addr)) {
                currentDeletedFor.push(addr);
            }
            const { error } = await supabase
                .from("chat_messages")
                .update({ deleted_for: currentDeletedFor })
                .eq("id", message_id);

            if (error) throw error;
        }

        return NextResponse.json({ success: true, mode });
    } catch (error) {
        console.error("Error deleting message:", error);
        return NextResponse.json(
            { error: "Failed to delete message" },
            { status: 500 }
        );
    }
}
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAccount } from "wagmi";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface ChatUser {
    wallet_address: string;
    username: string | null;
    name: string | null;
    avatar_url: string | null;
}

interface ReplyToMessage {
    id: string;
    content: string;
    user_address: string;
    user: ChatUser | null;
}

interface ChatMessage {
    id: string;
    event_id: string;
    user_address: string;
    content: string;
    created_at: string;
    user: ChatUser | null;
    pending?: boolean;
    reply_to: string | null;
    reply_to_message: ReplyToMessage | null;
    edited_at: string | null;
    deleted_at: string | null;
}

interface SidebarEvent {
    id: string;
    name: string;
    image_url: string | null;
    organizer_address: string;
    contract_address: string | null;
    date: string | null;
    isOrganizer: boolean;
    lastMessage: { content: string; created_at: string; user_address: string } | null;
}

type ChatState = "loading" | "unauthorized" | "ready" | "error";


export default function EventChatPage() {
    const params = useParams();
    const router = useRouter();
    const activeEventId = params.id as string;
    const { user, isAuthenticated } = useAuth();
    const { address } = useAccount();

    // Sidebar state
    const [sidebarEvents, setSidebarEvents] = useState<SidebarEvent[]>([]);
    const [sidebarLoading, setSidebarLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Active chat state
    const [activeEvent, setActiveEvent] = useState<SidebarEvent | null>(null);
    const [chatState, setChatState] = useState<ChatState>("loading");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [onlineCount, setOnlineCount] = useState(0);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Reply / Edit / Delete state
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
    const [contextMenuMsg, setContextMenuMsg] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const messagesRef = useRef(messages);

    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    const myUserInfo = useCallback((): ChatUser | null => {
        if (!user || !address) return null;
        return { wallet_address: address.toLowerCase(), username: user.username, name: user.name, avatar_url: user.avatar_url };
    }, [user, address]);

    const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    // Fetch sidebar events
    useEffect(() => {
        if (!address) return;
        setSidebarLoading(true);
        fetch(`/api/chat/events?user_address=${address.toLowerCase()}`)
            .then((res) => res.json())
            .then((data) => {
                const events: SidebarEvent[] = data.events || [];
                setSidebarEvents(events);
                const active = events.find((e) => e.id === activeEventId);
                if (active) setActiveEvent(active);
                else if (events.length > 0) {
                    setActiveEvent({ id: activeEventId, name: "Event Chat", image_url: null, organizer_address: "", contract_address: null, date: null, isOrganizer: false, lastMessage: null });
                }
            })
            .catch(() => { })
            .finally(() => setSidebarLoading(false));
    }, [address, activeEventId]);

    // Load messages
    const loadMessages = useCallback(async (before?: string) => {
        if (!address || !activeEventId) return;
        if (!before) setChatState("loading");
        else setIsLoadingMore(true);
        setErrorMsg(null);
        try {
            let url = `/api/chat?event_id=${activeEventId}&user_address=${address.toLowerCase()}`;
            if (before) url += `&before=${encodeURIComponent(before)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 403) { setChatState("unauthorized"); return; }
                throw new Error(data.error || "Failed to load chat");
            }
            const fetched: ChatMessage[] = data.messages || [];
            setHasMore(data.hasMore ?? false);
            if (before) {
                setMessages((prev) => {
                    const ids = new Set(prev.map((m) => m.id));
                    return [...fetched.filter((m) => !ids.has(m.id)), ...prev];
                });
            } else {
                setMessages(fetched);
                setChatState("ready");
                setTimeout(scrollToBottom, 100);
            }
        } catch (err) {
            if (!before) { setErrorMsg(err instanceof Error ? err.message : "Failed to load chat"); setChatState("error"); }
        } finally { setIsLoadingMore(false); }
    }, [address, activeEventId, scrollToBottom]);

    const loadMessagesRef = useRef(loadMessages);
    useEffect(() => { loadMessagesRef.current = loadMessages; }, [loadMessages]);

    useEffect(() => {
        if (address && activeEventId) {
            setMessages([]);
            loadMessagesRef.current();
        }
    }, [address, activeEventId]);

    const loadOlderMessages = useCallback(() => {
        if (isLoadingMore || !hasMore) return;
        const oldest = messagesRef.current[0];
        if (oldest) loadMessages(oldest.created_at);
    }, [isLoadingMore, hasMore, loadMessages]);

    const handleScroll = useCallback(() => {
        const container = chatContainerRef.current;
        if (!container || !hasMore || isLoadingMore) return;
        if (container.scrollTop < 60) loadOlderMessages();
    }, [hasMore, isLoadingMore, loadOlderMessages]);


    // Realtime subscription
    useEffect(() => {
        if (chatState !== "ready" || !address || !activeEventId) return;
        const supabase = getSupabaseClient();
        const channel = supabase.channel(`chat-room:${activeEventId}`, {
            config: { presence: { key: address.toLowerCase() } },
        });
        channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `event_id=eq.${activeEventId}` },
            async (payload) => {
                const newMsg = payload.new as ChatMessage;
                if (newMsg.user_address.toLowerCase() === address.toLowerCase()) return;
                if (newMsg.deleted_at) return;
                setMessages((prev) => {
                    if (prev.some((m) => m.id === newMsg.id)) return prev;
                    return [...prev, { ...newMsg, user: null, reply_to_message: null }];
                });
                try {
                    const res = await fetch(`/api/users?address=${newMsg.user_address}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.user) {
                            setMessages((prev) => prev.map((m) => m.id === newMsg.id ? { ...m, user: { wallet_address: data.user.wallet_address, username: data.user.username, name: data.user.name, avatar_url: data.user.avatar_url } } : m));
                        }
                    }
                } catch { /* silent */ }
                if (newMsg.reply_to) {
                    setMessages((prev) => {
                        const repliedMsg = prev.find((m) => m.id === newMsg.reply_to);
                        if (repliedMsg) {
                            return prev.map((m) =>
                                m.id === newMsg.id
                                    ? { ...m, reply_to_message: { id: repliedMsg.id, content: repliedMsg.deleted_at ? "This message was deleted" : repliedMsg.content, user_address: repliedMsg.user_address, user: repliedMsg.user } }
                                    : m
                            );
                        }
                        return prev;
                    });
                }
                setTimeout(scrollToBottom, 50);
            }
        );
        channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `event_id=eq.${activeEventId}` },
            (payload) => {
                const updated = payload.new as ChatMessage;
                setMessages((prev) =>
                    prev.map((m) => {
                        if (m.id !== updated.id) return m;
                        if (updated.deleted_at) {
                            return { ...m, content: "", deleted_at: updated.deleted_at, edited_at: updated.edited_at };
                        }
                        return { ...m, content: updated.content, edited_at: updated.edited_at };
                    }).filter((m) => {
                        const deletedFor: string[] = (updated.id === m.id ? (updated as unknown as { deleted_for: string[] }).deleted_for : []) || [];
                        return !deletedFor.includes(address.toLowerCase());
                    })
                );
            }
        );
        channel.on("broadcast", { event: "typing" }, (payload) => {
            const typer = payload.payload?.user_address as string;
            if (!typer || typer.toLowerCase() === address.toLowerCase()) return;
            const label = payload.payload?.name || `${typer.slice(0, 6)}...${typer.slice(-4)}`;
            setTypingUsers((prev) => new Set(prev).add(label));
            setTimeout(() => { setTypingUsers((prev) => { const next = new Set(prev); next.delete(label); return next; }); }, 3000);
        });
        channel.on("presence", { event: "sync" }, () => { setOnlineCount(Object.keys(channel.presenceState()).length); });
        channel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
                const info = myUserInfo();
                await channel.track({ user_address: address.toLowerCase(), name: info?.name || info?.username || address.slice(0, 8), online_at: new Date().toISOString() });
            }
        });
        channelRef.current = channel;
        return () => { supabase.removeChannel(channel); channelRef.current = null; };
    }, [chatState, activeEventId, address, scrollToBottom, myUserInfo]);

    // Visibility reconnect
    useEffect(() => {
        if (chatState !== "ready" || !address) return;
        const handler = () => { if (document.visibilityState === "visible") loadMessages(); };
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
    }, [chatState, address, loadMessages]);


    const emitTyping = useCallback(() => {
        if (!channelRef.current || !address) return;
        if (typingTimeoutRef.current) return;
        const info = myUserInfo();
        channelRef.current.send({ type: "broadcast", event: "typing", payload: { user_address: address.toLowerCase(), name: info?.name || info?.username || null } });
        typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 2000);
    }, [address, myUserInfo]);

    // --- Edit message ---
    const handleEdit = (msg: ChatMessage) => {
        setEditingMessage(msg);
        setReplyingTo(null);
        setNewMessage(msg.content);
        setContextMenuMsg(null);
        inputRef.current?.focus();
    };

    const handleCancelEdit = () => {
        setEditingMessage(null);
        setNewMessage("");
    };

    // --- Reply to message ---
    const handleReply = (msg: ChatMessage) => {
        setReplyingTo(msg);
        setEditingMessage(null);
        setNewMessage("");
        setContextMenuMsg(null);
        inputRef.current?.focus();
    };

    const handleCancelReply = () => {
        setReplyingTo(null);
    };

    // --- Delete message ---
    const handleDelete = async (messageId: string, mode: "for_everyone" | "for_me") => {
        if (!address) return;
        setContextMenuMsg(null);
        try {
            const res = await fetch("/api/chat", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message_id: messageId, user_address: address.toLowerCase(), mode }),
            });
            if (!res.ok) {
                const data = await res.json();
                setErrorMsg(data.error || "Failed to delete");
                return;
            }
            if (mode === "for_everyone") {
                setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, content: "", deleted_at: new Date().toISOString() } : m));
            } else {
                setMessages((prev) => prev.filter((m) => m.id !== messageId));
            }
        } catch {
            setErrorMsg("Failed to delete message");
        }
    };


    // --- Send / Edit submit ---
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !address || isSending) return;
        const content = newMessage.trim();
        if (content.length > 500) return;

        // If editing
        if (editingMessage) {
            if (content === editingMessage.content) { handleCancelEdit(); return; }
            setIsSending(true);
            try {
                const res = await fetch("/api/chat", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message_id: editingMessage.id, user_address: address.toLowerCase(), content }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to edit");
                setMessages((prev) => prev.map((m) => m.id === editingMessage.id ? { ...m, content: data.message.content, edited_at: data.message.edited_at } : m));
                handleCancelEdit();
            } catch (err) {
                setErrorMsg(err instanceof Error ? err.message : "Failed to edit");
            } finally { setIsSending(false); }
            return;
        }

        // Normal send (with optional reply)
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const info = myUserInfo();
        const optimisticMsg: ChatMessage = {
            id: tempId, event_id: activeEventId, user_address: address.toLowerCase(),
            content, created_at: new Date().toISOString(), user: info, pending: true,
            reply_to: replyingTo?.id || null,
            reply_to_message: replyingTo ? { id: replyingTo.id, content: replyingTo.content, user_address: replyingTo.user_address, user: replyingTo.user } : null,
            edited_at: null, deleted_at: null,
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        setNewMessage(""); setErrorMsg(null);
        setReplyingTo(null);
        setTimeout(scrollToBottom, 50);
        inputRef.current?.focus();
        setIsSending(true);
        try {
            const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_id: activeEventId, user_address: address.toLowerCase(), content, reply_to: replyingTo?.id || undefined }) });
            const data = await res.json();
            if (!res.ok) { setMessages((prev) => prev.filter((m) => m.id !== tempId)); throw new Error(data.error || "Failed to send"); }
            setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...data.message, pending: false } : m)));
        } catch (err) { setErrorMsg(err instanceof Error ? err.message : "Failed to send"); }
        finally { setIsSending(false); }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); }
        if (e.key === "Escape") {
            if (editingMessage) handleCancelEdit();
            else if (replyingTo) handleCancelReply();
        }
    };

    const displayName = (msg: ChatMessage) => {
        if (msg.user?.name) return msg.user.name;
        if (msg.user?.username) return `@${msg.user.username}`;
        return `${msg.user_address.slice(0, 6)}...${msg.user_address.slice(-4)}`;
    };

    const displayNameFromUser = (u: ChatUser | null, addr: string) => {
        if (u?.name) return u.name;
        if (u?.username) return `@${u.username}`;
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const isOwnMessage = (msg: ChatMessage) => address?.toLowerCase() === msg.user_address.toLowerCase();
    const isOrganizerMsg = (addr: string) => activeEvent?.organizer_address?.toLowerCase() === addr.toLowerCase();

    const switchEvent = (eventId: string) => {
        router.push(`/events/${eventId}/chat`);
        setSidebarOpen(false);
    };

    // Close context menu on outside click
    useEffect(() => {
        const handler = () => setContextMenuMsg(null);
        if (contextMenuMsg) document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [contextMenuMsg]);


    if (!address || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-900 pt-24 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-white text-lg mb-2">Connect your wallet to access chats</p>
                    <p className="text-gray-400 text-sm">You need to be signed in to view event chats.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-slate-900 pt-16 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex overflow-hidden">
                {/* Mobile sidebar overlay */}
                {sidebarOpen && (
                    <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
                )}

                {/* Sidebar */}
                <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:relative z-40 lg:z-auto w-80 h-full bg-slate-800 border-r border-white/10 flex flex-col transition-transform duration-200`}>
                    <div className="px-4 py-4 border-b border-white/10">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-white text-lg font-semibold">Chats</h2>
                            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white cursor-pointer">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-gray-500 text-xs">Events you&apos;re part of</p>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {sidebarLoading ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-3 animate-pulse">
                                        <div className="w-12 h-12 rounded-full bg-slate-700" />
                                        <div className="flex-1">
                                            <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
                                            <div className="h-3 bg-slate-700 rounded w-1/2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : sidebarEvents.length === 0 ? (
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                </div>
                                <p className="text-gray-400 text-sm mb-1">No chats yet</p>
                                <p className="text-gray-500 text-xs">Buy a ticket or create an event to start chatting</p>
                            </div>
                        ) : (
                            sidebarEvents.map((event) => (
                                <button
                                    key={event.id}
                                    onClick={() => switchEvent(event.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors cursor-pointer ${event.id === activeEventId ? "bg-slate-700/70 border-l-2 border-purple-500" : "border-l-2 border-transparent"}`}
                                >
                                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-purple-600/30 to-pink-600/30 flex items-center justify-center overflow-hidden">
                                        {event.image_url ? (
                                            <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-white text-sm font-medium truncate">{event.name}</p>
                                            {event.lastMessage && (
                                                <span className="text-gray-500 text-[10px] flex-shrink-0">{formatDate(event.lastMessage.created_at)}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {event.isOrganizer && (
                                                <span className="text-[9px] bg-purple-500/30 text-purple-300 px-1 py-0.5 rounded flex-shrink-0">Organizer</span>
                                            )}
                                            {event.lastMessage ? (
                                                <p className="text-gray-500 text-xs truncate">{event.lastMessage.content}</p>
                                            ) : (
                                                <p className="text-gray-600 text-xs italic">No messages yet</p>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>


                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Chat Header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/80 border-b border-white/10">
                        <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-400 hover:text-white cursor-pointer">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        {activeEvent?.image_url ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                                <img src={activeEvent.image_url} alt="" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                                </svg>
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold truncate">{activeEvent?.name || "Event Chat"}</p>
                            <div className="flex items-center gap-2">
                                <p className="text-gray-500 text-xs">Token holders only</p>
                                {onlineCount > 0 && chatState === "ready" && (
                                    <span className="flex items-center gap-1 text-xs text-green-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                        {onlineCount} online
                                    </span>
                                )}
                            </div>
                        </div>
                        <Link
                            href={`/events/${activeEventId}`}
                            className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <span className="hidden sm:inline">Event</span>
                        </Link>
                    </div>


                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto bg-slate-900/50" ref={chatContainerRef} onScroll={handleScroll}>
                        {chatState === "loading" && (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <svg className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <p className="text-gray-400 text-sm">Loading chat...</p>
                                </div>
                            </div>
                        )}
                        {chatState === "unauthorized" && (
                            <div className="flex items-center justify-center h-full px-6">
                                <div className="text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <p className="text-white font-medium mb-1">Token-Gated Chat</p>
                                    <p className="text-gray-400 text-sm">You need to hold a ticket for this event to join the chat.</p>
                                </div>
                            </div>
                        )}
                        {chatState === "error" && (
                            <div className="flex items-center justify-center h-full px-6">
                                <div className="text-center">
                                    <p className="text-red-400 text-sm mb-3">{errorMsg || "Something went wrong"}</p>
                                    <button onClick={() => loadMessages()} className="text-purple-400 hover:text-purple-300 text-sm underline cursor-pointer">Try again</button>
                                </div>
                            </div>
                        )}
                        {chatState === "ready" && (
                            <div className="px-4 sm:px-6 py-4 space-y-3 max-w-4xl mx-auto">
                                {hasMore && (
                                    <div className="text-center py-2">
                                        <button onClick={loadOlderMessages} disabled={isLoadingMore} className="text-purple-400 hover:text-purple-300 text-xs underline cursor-pointer disabled:opacity-50">
                                            {isLoadingMore ? "Loading..." : "Load older messages"}
                                        </button>
                                    </div>
                                )}
                                {messages.length === 0 && (
                                    <div className="text-center py-20">
                                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                                            <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                        </div>
                                        <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
                                    </div>
                                )}

                                {messages.map((msg) => {
                                    const own = isOwnMessage(msg);
                                    const deleted = !!msg.deleted_at;

                                    return (
                                        <div key={msg.id} className={`group flex gap-2.5 ${own ? "flex-row-reverse" : ""} ${msg.pending ? "opacity-60" : ""}`}>
                                            {!own && (
                                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center overflow-hidden mt-0.5">
                                                    {msg.user?.avatar_url ? (
                                                        <img src={msg.user.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                    )}
                                                </div>
                                            )}
                                            <div className="relative max-w-[70%] sm:max-w-[60%]">
                                                {/* Reply preview */}
                                                {msg.reply_to_message && !deleted && (
                                                    <div className={`text-[11px] mb-1 px-3 py-1.5 rounded-xl border-l-2 border-purple-500/50 ${own ? "bg-purple-900/20" : "bg-slate-800/50"}`}>
                                                        <span className="text-purple-400 font-medium">{displayNameFromUser(msg.reply_to_message.user, msg.reply_to_message.user_address)}</span>
                                                        <p className="text-gray-400 truncate">{msg.reply_to_message.content}</p>
                                                    </div>
                                                )}
                                                <div className={`${own ? "bg-purple-600/30 border-purple-500/20" : "bg-slate-800/80 border-white/5"} border rounded-2xl px-4 py-2.5`}>
                                                    {!own && !deleted && (
                                                        <p className="text-xs font-medium mb-1 flex items-center gap-1.5">
                                                            <span className="text-purple-400">{displayName(msg)}</span>
                                                            {isOrganizerMsg(msg.user_address) && (
                                                                <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded-full">Organizer</span>
                                                            )}
                                                        </p>
                                                    )}
                                                    {deleted ? (
                                                        <p className="text-gray-500 text-sm italic">This message was deleted</p>
                                                    ) : (
                                                        <p className="text-gray-200 text-sm whitespace-pre-wrap break-words leading-relaxed">{escapeHtml(msg.content)}</p>
                                                    )}
                                                    <div className={`flex items-center gap-1 mt-1 ${own ? "justify-end" : ""}`}>
                                                        {msg.edited_at && !deleted && (
                                                            <span className="text-[10px] text-gray-500">edited</span>
                                                        )}
                                                        <p className={`text-[10px] ${own ? "text-purple-300/50" : "text-gray-500"}`}>{formatTime(msg.created_at)}</p>
                                                        {own && (
                                                            <span className={`text-[10px] ${msg.pending ? "text-gray-500" : "text-purple-300/50"}`}>{msg.pending ? "sending..." : "✓"}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action buttons on hover */}
                                                {!deleted && !msg.pending && (
                                                    <div className={`absolute top-0 ${own ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"} hidden group-hover:flex items-center gap-0.5`}>
                                                        <button onClick={() => handleReply(msg)} className="p-1.5 rounded bg-slate-700/80 hover:bg-slate-600 text-gray-400 hover:text-white transition-colors cursor-pointer" title="Reply">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                                            </svg>
                                                        </button>
                                                        {own && (
                                                            <>
                                                                <button onClick={() => handleEdit(msg)} className="p-1.5 rounded bg-slate-700/80 hover:bg-slate-600 text-gray-400 hover:text-white transition-colors cursor-pointer" title="Edit">
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                    </svg>
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); setContextMenuMsg(contextMenuMsg === msg.id ? null : msg.id); }} className="p-1.5 rounded bg-slate-700/80 hover:bg-slate-600 text-gray-400 hover:text-white transition-colors cursor-pointer" title="Delete">
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </>
                                                        )}
                                                        {!own && (
                                                            <button onClick={() => handleDelete(msg.id, "for_me")} className="p-1.5 rounded bg-slate-700/80 hover:bg-slate-600 text-gray-400 hover:text-white transition-colors cursor-pointer" title="Delete for me">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Delete context menu for own messages */}
                                                {contextMenuMsg === msg.id && own && (
                                                    <div className={`absolute z-50 ${own ? "right-0" : "left-0"} top-full mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-[180px]`} onClick={(e) => e.stopPropagation()}>
                                                        <button onClick={() => handleDelete(msg.id, "for_me")} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer">
                                                            Delete for me
                                                        </button>
                                                        <button onClick={() => handleDelete(msg.id, "for_everyone")} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors cursor-pointer">
                                                            Delete for everyone
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>


                    {/* Typing Indicator */}
                    {chatState === "ready" && typingUsers.size > 0 && (
                        <div className="px-4 sm:px-6 py-1.5 bg-slate-900/50">
                            <div className="max-w-4xl mx-auto">
                                <p className="text-gray-500 text-xs flex items-center gap-1.5">
                                    <span className="flex gap-0.5">
                                        <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </span>
                                    {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Reply / Edit Banner */}
                    {chatState === "ready" && (replyingTo || editingMessage) && (
                        <div className="px-4 sm:px-6 py-2 bg-slate-800/70 border-t border-white/5">
                            <div className="max-w-4xl mx-auto flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                    {replyingTo && (
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                            </svg>
                                            <span className="text-purple-400 text-xs font-medium">Replying to {displayName(replyingTo)}</span>
                                            <span className="text-gray-500 text-xs truncate">{replyingTo.content}</span>
                                        </div>
                                    )}
                                    {editingMessage && (
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            <span className="text-yellow-400 text-xs font-medium">Editing message</span>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => { if (editingMessage) handleCancelEdit(); else handleCancelReply(); }} className="text-gray-400 hover:text-white cursor-pointer">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Input Area */}
                    {chatState === "ready" && isAuthenticated && user && (
                        <form onSubmit={handleSend} className="px-4 sm:px-6 py-4 bg-slate-800/80 border-t border-white/10">
                            <div className="max-w-4xl mx-auto">
                                {errorMsg && <p className="text-red-400 text-xs mb-2">{errorMsg}</p>}
                                <div className="flex items-end gap-3">
                                    <textarea
                                        ref={inputRef}
                                        value={newMessage}
                                        onChange={(e) => { setNewMessage(e.target.value); setErrorMsg(null); if (e.target.value.trim()) emitTyping(); }}
                                        onKeyDown={handleKeyDown}
                                        placeholder={editingMessage ? "Edit your message..." : replyingTo ? "Type your reply..." : "Type a message..."}
                                        maxLength={500}
                                        rows={1}
                                        className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500/50 transition-colors max-h-28"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim() || isSending}
                                        className={`flex-shrink-0 w-10 h-10 rounded-xl ${editingMessage ? "bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500" : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"} text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer`}
                                    >
                                        {isSending ? (
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                        ) : editingMessage ? (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {chatState === "ready" && !isAuthenticated && (
                        <div className="px-4 py-4 bg-slate-800/80 border-t border-white/10 text-center">
                            <p className="text-gray-400 text-sm">Sign in to send messages</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
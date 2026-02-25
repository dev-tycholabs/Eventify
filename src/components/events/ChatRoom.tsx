"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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

interface ChatRoomProps {
    eventId: string;
    contractAddress: string | null;
    organizerAddress: string;
}

type ChatState = "closed" | "loading" | "unauthorized" | "ready" | "error";

export default function ChatRoom({
    eventId,
    contractAddress,
    organizerAddress,
}: ChatRoomProps) {
    const router = useRouter();
    const { user, isAuthenticated, getAccessToken } = useAuth();
    const { address } = useAccount();

    const [chatState, setChatState] = useState<ChatState>("closed");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
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
    const isOpenRef = useRef(isOpen);
    const messagesRef = useRef(messages);

    useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);


    const myUserInfo = useCallback((): ChatUser | null => {
        if (!user || !address) return null;
        return {
            wallet_address: address.toLowerCase(),
            username: user.username,
            name: user.name,
            avatar_url: user.avatar_url,
        };
    }, [user, address]);

    const escapeHtml = (text: string) => {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    };

    const loadMessages = useCallback(async (before?: string) => {
        if (!address || !contractAddress) return;
        if (!before) setChatState("loading");
        else setIsLoadingMore(true);
        setErrorMsg(null);
        try {
            let url = `/api/chat?event_id=${eventId}&user_address=${address.toLowerCase()}`;
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
                    const existingIds = new Set(prev.map((m) => m.id));
                    const newOnes = fetched.filter((m) => !existingIds.has(m.id));
                    return [...newOnes, ...prev];
                });
            } else {
                setMessages(fetched);
                setChatState("ready");
                setTimeout(scrollToBottom, 100);
            }
        } catch (err) {
            if (!before) {
                setErrorMsg(err instanceof Error ? err.message : "Failed to load chat");
                setChatState("error");
            }
        } finally { setIsLoadingMore(false); }
    }, [address, contractAddress, eventId, scrollToBottom]);

    const loadMessagesRef = useRef(loadMessages);
    useEffect(() => { loadMessagesRef.current = loadMessages; }, [loadMessages]);

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
        if (chatState !== "ready" || !address) return;
        const supabase = getSupabaseClient();
        const channel = supabase.channel(`chat-room:${eventId}`, {
            config: { presence: { key: address.toLowerCase() } },
        });
        channel.on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "chat_messages", filter: `event_id=eq.${eventId}` },
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
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === newMsg.id
                                        ? { ...m, user: { wallet_address: data.user.wallet_address, username: data.user.username, name: data.user.name, avatar_url: data.user.avatar_url } }
                                        : m
                                )
                            );
                        }
                    }
                } catch { /* silent */ }
                // If it's a reply, resolve the replied-to message from local state
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
                if (!isOpenRef.current) setUnreadCount((c) => c + 1);
                setTimeout(scrollToBottom, 50);
            }
        );
        channel.on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "chat_messages", filter: `event_id=eq.${eventId}` },
            (payload) => {
                const updated = payload.new as ChatMessage;
                setMessages((prev) =>
                    prev.map((m) => {
                        if (m.id !== updated.id) return m;
                        // If deleted for everyone
                        if (updated.deleted_at) {
                            return { ...m, content: "", deleted_at: updated.deleted_at, edited_at: updated.edited_at };
                        }
                        // If edited
                        return { ...m, content: updated.content, edited_at: updated.edited_at };
                    }).filter((m) => {
                        // Remove if deleted_for includes current user
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
            setTimeout(() => {
                setTypingUsers((prev) => { const next = new Set(prev); next.delete(label); return next; });
            }, 3000);
        });
        channel.on("presence", { event: "sync" }, () => {
            setOnlineCount(Object.keys(channel.presenceState()).length);
        });
        channel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
                const info = myUserInfo();
                await channel.track({
                    user_address: address.toLowerCase(),
                    name: info?.name || info?.username || address.slice(0, 8),
                    online_at: new Date().toISOString(),
                });
            }
        });
        channelRef.current = channel;
        return () => { supabase.removeChannel(channel); channelRef.current = null; };
    }, [chatState, eventId, address, scrollToBottom, myUserInfo]);


    useEffect(() => {
        if (chatState !== "ready" || !address) return;
        const handleVisibility = () => {
            if (document.visibilityState === "visible" && isOpenRef.current) loadMessagesRef.current();
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [chatState, address]);

    const toggleChat = useCallback(() => {
        if (!isOpen) { setIsOpen(true); setUnreadCount(0); loadMessagesRef.current(); }
        else { setIsOpen(false); setChatState("closed"); }
    }, [isOpen]);

    const emitTyping = useCallback(() => {
        if (!channelRef.current || !address) return;
        if (typingTimeoutRef.current) return;
        const info = myUserInfo();
        channelRef.current.send({
            type: "broadcast", event: "typing",
            payload: { user_address: address.toLowerCase(), name: info?.name || info?.username || null },
        });
        typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 2000);
    }, [address, myUserInfo]);

    // --- Edit message ---
    const handleEdit = async (msg: ChatMessage) => {
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
            const token = await getAccessToken();
            if (!token) { setErrorMsg("Not authenticated"); return; }

            const res = await fetch("/api/chat", {
                method: "DELETE",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
                const token = await getAccessToken();
                if (!token) throw new Error("Not authenticated");

                const res = await fetch("/api/chat", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
            id: tempId, event_id: eventId, user_address: address.toLowerCase(),
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
            const token = await getAccessToken();
            if (!token) { setMessages((prev) => prev.filter((m) => m.id !== tempId)); throw new Error("Not authenticated"); }

            const res = await fetch("/api/chat", {
                method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ event_id: eventId, user_address: address.toLowerCase(), content, reply_to: replyingTo?.id || undefined }),
            });
            const data = await res.json();
            if (!res.ok) { setMessages((prev) => prev.filter((m) => m.id !== tempId)); throw new Error(data.error || "Failed to send message"); }
            const realMsg: ChatMessage = { ...data.message, pending: false };
            setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Failed to send");
        } finally { setIsSending(false); }
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

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    };

    const isOwnMessage = (msg: ChatMessage) => address?.toLowerCase() === msg.user_address.toLowerCase();
    const isOrganizerAddr = (addr: string) => addr.toLowerCase() === organizerAddress.toLowerCase();

    // Close context menu on outside click
    useEffect(() => {
        const handler = () => setContextMenuMsg(null);
        if (contextMenuMsg) document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [contextMenuMsg]);

    if (!contractAddress) return null;

    return (
        <>
            {/* Floating Chat Button */}
            <button
                onClick={toggleChat}
                className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg hover:from-purple-500 hover:to-pink-500 transition-all duration-300 flex items-center justify-center cursor-pointer"
                title="Event Chat"
            >
                {isOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                )}
                {unreadCount > 0 && !isOpen && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-40 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-8rem)] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-white text-sm font-semibold">Event Chat</p>
                                <div className="flex items-center gap-1.5">
                                    <p className="text-gray-500 text-xs">Token holders only</p>
                                    {onlineCount > 0 && chatState === "ready" && (
                                        <span className="flex items-center gap-1 text-xs text-green-400">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                            {onlineCount} online
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => router.push(`/events/${eventId}/chat`)}
                                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                                title="Open full chat"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </button>
                            <button onClick={toggleChat} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>


                    {/* Chat Body */}
                    <div className="flex-1 overflow-y-auto" ref={chatContainerRef} onScroll={handleScroll}>
                        {chatState === "loading" && (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <svg className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <p className="text-gray-400 text-sm">Verifying token ownership...</p>
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
                            <div className="px-4 py-3 space-y-3">
                                {hasMore && (
                                    <div className="text-center py-2">
                                        <button onClick={loadOlderMessages} disabled={isLoadingMore} className="text-purple-400 hover:text-purple-300 text-xs underline cursor-pointer disabled:opacity-50">
                                            {isLoadingMore ? "Loading..." : "Load older messages"}
                                        </button>
                                    </div>
                                )}
                                {messages.length === 0 && (
                                    <div className="text-center py-12"><p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p></div>
                                )}
                                {messages.map((msg) => {
                                    const own = isOwnMessage(msg);
                                    const deleted = !!msg.deleted_at;

                                    return (
                                        <div key={msg.id} className={`group flex gap-2 ${own ? "flex-row-reverse" : ""} ${msg.pending ? "opacity-60" : ""}`}>
                                            {!own && (
                                                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center overflow-hidden mt-0.5">
                                                    {msg.user?.avatar_url ? (
                                                        <img src={msg.user.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                    )}
                                                </div>
                                            )}
                                            <div className="relative max-w-[75%]">
                                                {/* Reply preview */}
                                                {msg.reply_to_message && !deleted && (
                                                    <div className={`text-[10px] mb-1 px-2 py-1 rounded-lg border-l-2 border-purple-500/50 ${own ? "bg-purple-900/20" : "bg-slate-800/50"}`}>
                                                        <span className="text-purple-400 font-medium">{displayNameFromUser(msg.reply_to_message.user, msg.reply_to_message.user_address)}</span>
                                                        <p className="text-gray-400 truncate">{msg.reply_to_message.content}</p>
                                                    </div>
                                                )}
                                                <div className={`${own ? "bg-purple-600/30 border-purple-500/20" : "bg-slate-800/80 border-white/5"} border rounded-xl px-3 py-2`}>
                                                    {!own && !deleted && (
                                                        <p className="text-xs font-medium mb-0.5 flex items-center gap-1">
                                                            <span className="text-purple-400">{displayName(msg)}</span>
                                                            {isOrganizerAddr(msg.user_address) && (
                                                                <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded-full">Organizer</span>
                                                            )}
                                                        </p>
                                                    )}
                                                    {deleted ? (
                                                        <p className="text-gray-500 text-sm italic">This message was deleted</p>
                                                    ) : (
                                                        <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">{escapeHtml(msg.content)}</p>
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
                                                        <button onClick={() => handleReply(msg)} className="p-1 rounded bg-slate-700/80 hover:bg-slate-600 text-gray-400 hover:text-white transition-colors cursor-pointer" title="Reply">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                                            </svg>
                                                        </button>
                                                        {own && (
                                                            <>
                                                                <button onClick={() => handleEdit(msg)} className="p-1 rounded bg-slate-700/80 hover:bg-slate-600 text-gray-400 hover:text-white transition-colors cursor-pointer" title="Edit">
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                    </svg>
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); setContextMenuMsg(contextMenuMsg === msg.id ? null : msg.id); }} className="p-1 rounded bg-slate-700/80 hover:bg-slate-600 text-gray-400 hover:text-white transition-colors cursor-pointer" title="Delete">
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </>
                                                        )}
                                                        {!own && (
                                                            <button onClick={() => handleDelete(msg.id, "for_me")} className="p-1 rounded bg-slate-700/80 hover:bg-slate-600 text-gray-400 hover:text-white transition-colors cursor-pointer" title="Delete for me">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Delete context menu for own messages */}
                                                {contextMenuMsg === msg.id && own && (
                                                    <div className={`absolute z-50 ${own ? "right-0" : "left-0"} top-full mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]`} onClick={(e) => e.stopPropagation()}>
                                                        <button onClick={() => handleDelete(msg.id, "for_me")} className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer">
                                                            Delete for me
                                                        </button>
                                                        <button onClick={() => handleDelete(msg.id, "for_everyone")} className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors cursor-pointer">
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
                        <div className="px-4 py-1.5 border-t border-white/5">
                            <p className="text-gray-500 text-xs flex items-center gap-1.5">
                                <span className="flex gap-0.5">
                                    <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                                </span>
                                {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing
                            </p>
                        </div>
                    )}

                    {/* Reply / Edit Banner */}
                    {chatState === "ready" && (replyingTo || editingMessage) && (
                        <div className="px-3 py-2 bg-slate-800/70 border-t border-white/5 flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                                {replyingTo && (
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-3 h-3 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                        <span className="text-purple-400 text-xs font-medium">Replying to {displayName(replyingTo)}</span>
                                        <span className="text-gray-500 text-xs truncate">{replyingTo.content}</span>
                                    </div>
                                )}
                                {editingMessage && (
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-3 h-3 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    )}

                    {/* Input Area */}
                    {chatState === "ready" && isAuthenticated && user && (
                        <form onSubmit={handleSend} className="px-3 py-3 border-t border-white/10 bg-slate-800/50">
                            {errorMsg && <p className="text-red-400 text-xs mb-2">{errorMsg}</p>}
                            <div className="flex items-end gap-2">
                                <textarea
                                    ref={inputRef}
                                    value={newMessage}
                                    onChange={(e) => { setNewMessage(e.target.value); setErrorMsg(null); if (e.target.value.trim()) emitTyping(); }}
                                    onKeyDown={handleKeyDown}
                                    placeholder={editingMessage ? "Edit your message..." : replyingTo ? "Type your reply..." : "Type a message..."}
                                    maxLength={500}
                                    rows={1}
                                    className="flex-1 px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500/50 transition-colors max-h-20"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || isSending}
                                    className={`flex-shrink-0 w-9 h-9 rounded-lg ${editingMessage ? "bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500" : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"} text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer`}
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
                        </form>
                    )}

                    {chatState === "ready" && !isAuthenticated && (
                        <div className="px-4 py-3 border-t border-white/10 bg-slate-800/50 text-center">
                            <p className="text-gray-400 text-xs">Sign in to send messages</p>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
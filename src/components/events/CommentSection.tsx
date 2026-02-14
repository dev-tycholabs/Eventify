"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAccount } from "wagmi";

interface CommentUser {
    wallet_address: string;
    username: string | null;
    name: string | null;
    avatar_url: string | null;
}

interface Comment {
    id: string;
    event_id: string;
    user_address: string;
    content: string;
    created_at: string;
    user: CommentUser | null;
}

interface CommentSectionProps {
    eventId: string;
    preview?: boolean;
}

export default function CommentSection({ eventId, preview = false }: CommentSectionProps) {
    const { user, isAuthenticated } = useAuth();
    const { address } = useAccount();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchComments = useCallback(async () => {
        if (preview) {
            setIsLoading(false);
            return;
        }
        try {
            const res = await fetch(`/api/comments?event_id=${eventId}`);
            if (res.ok) {
                const data = await res.json();
                setComments(data.comments || []);
            }
        } catch {
            console.error("Failed to fetch comments");
        } finally {
            setIsLoading(false);
        }
    }, [eventId, preview]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !address || isSubmitting || preview) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const res = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    event_id: eventId,
                    user_address: address.toLowerCase(),
                    content: newComment.trim(),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to post comment");
            }

            const data = await res.json();
            setComments((prev) => [data.comment, ...prev]);
            setNewComment("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to post comment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!address || preview) return;

        try {
            const res = await fetch(
                `/api/comments?id=${commentId}&user_address=${address.toLowerCase()}`,
                { method: "DELETE" }
            );

            if (res.ok) {
                setComments((prev) => prev.filter((c) => c.id !== commentId));
            }
        } catch {
            console.error("Failed to delete comment");
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const displayName = (comment: Comment) => {
        if (comment.user?.name) return comment.user.name;
        if (comment.user?.username) return `@${comment.user.username}`;
        return `${comment.user_address.slice(0, 6)}...${comment.user_address.slice(-4)}`;
    };

    // Preview mode: show static placeholder
    if (preview) {
        return (
            <div className="bg-slate-800/50 rounded-lg p-5 border border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Comments
                </h2>

                {/* Disabled input */}
                <div className="mb-6">
                    <textarea
                        disabled
                        placeholder="Comments will be available after the event is published..."
                        className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-lg text-gray-500 placeholder-gray-600 resize-none cursor-not-allowed"
                        rows={3}
                    />
                    <div className="flex justify-end mt-2">
                        <button
                            disabled
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg opacity-50 cursor-not-allowed text-sm font-medium"
                        >
                            Post Comment
                        </button>
                    </div>
                </div>

                <p className="text-center text-gray-500 text-sm">
                    No comments yet. Be the first to comment once this event is live.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-lg p-5 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Comments
                {comments.length > 0 && (
                    <span className="text-sm text-gray-400 font-normal">({comments.length})</span>
                )}
            </h2>

            {/* Comment Form */}
            {isAuthenticated && user ? (
                <form onSubmit={handleSubmit} className="mb-6">
                    <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center overflow-hidden">
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            )}
                        </div>
                        <div className="flex-1">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Write a comment..."
                                maxLength={1000}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500/50 transition-colors"
                                rows={3}
                            />
                            {error && (
                                <p className="text-red-400 text-sm mt-1">{error}</p>
                            )}
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-500">
                                    {newComment.length}/1000
                                </span>
                                <button
                                    type="submit"
                                    disabled={!newComment.trim() || isSubmitting}
                                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium cursor-pointer"
                                >
                                    {isSubmitting ? "Posting..." : "Post Comment"}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            ) : (
                <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-white/10 text-center">
                    <p className="text-gray-400 text-sm">
                        Connect your wallet and sign in to leave a comment.
                    </p>
                </div>
            )}

            {/* Comments List */}
            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700" />
                            <div className="flex-1">
                                <div className="h-4 bg-slate-700 rounded w-24 mb-2" />
                                <div className="h-3 bg-slate-700 rounded w-full mb-1" />
                                <div className="h-3 bg-slate-700 rounded w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : comments.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-4">
                    No comments yet. Be the first to share your thoughts!
                </p>
            ) : (
                <div className="space-y-4">
                    {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 group">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center overflow-hidden">
                                {comment.user?.avatar_url ? (
                                    <img src={comment.user.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-purple-400 truncate">
                                        {displayName(comment)}
                                    </span>
                                    <span className="text-xs text-gray-500 flex-shrink-0">
                                        {formatTime(comment.created_at)}
                                    </span>
                                    {address?.toLowerCase() === comment.user_address && (
                                        <button
                                            onClick={() => handleDelete(comment.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400 ml-auto cursor-pointer"
                                            title="Delete comment"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap break-words">
                                    {comment.content}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

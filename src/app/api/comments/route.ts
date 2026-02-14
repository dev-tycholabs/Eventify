import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/comments?event_id=...
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get("event_id");

        if (!eventId) {
            return NextResponse.json({ error: "event_id is required" }, { status: 400 });
        }

        const supabase = createServerClient();

        const { data, error } = await supabase
            .from("comments")
            .select("id, event_id, user_address, content, created_at, updated_at")
            .eq("event_id", eventId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Fetch user info for each unique address
        const addresses = [...new Set((data || []).map((c) => c.user_address))];
        const { data: users } = await supabase
            .from("users")
            .select("wallet_address, username, name, avatar_url")
            .in("wallet_address", addresses);

        const userMap = new Map(
            (users || []).map((u) => [u.wallet_address, u])
        );

        const comments = (data || []).map((c) => ({
            ...c,
            user: userMap.get(c.user_address) || null,
        }));

        return NextResponse.json({ comments });
    } catch (error) {
        console.error("Error fetching comments:", error);
        return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }
}

// POST /api/comments - Create a comment
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { event_id, user_address, content } = body;

        if (!event_id || !user_address || !content?.trim()) {
            return NextResponse.json(
                { error: "event_id, user_address, and content are required" },
                { status: 400 }
            );
        }

        if (content.length > 1000) {
            return NextResponse.json(
                { error: "Comment must be 1000 characters or less" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // Verify user exists
        const { data: user } = await supabase
            .from("users")
            .select("wallet_address")
            .eq("wallet_address", user_address.toLowerCase())
            .single();

        if (!user) {
            return NextResponse.json({ error: "User not found. Please sign in first." }, { status: 401 });
        }

        const { data, error } = await supabase
            .from("comments")
            .insert({
                event_id,
                user_address: user_address.toLowerCase(),
                content: content.trim(),
            })
            .select()
            .single();

        if (error) throw error;

        // Fetch user info for the response
        const { data: userData } = await supabase
            .from("users")
            .select("wallet_address, username, name, avatar_url")
            .eq("wallet_address", user_address.toLowerCase())
            .single();

        return NextResponse.json({
            comment: { ...data, user: userData || null },
        });
    } catch (error) {
        console.error("Error creating comment:", error);
        return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }
}

// DELETE /api/comments?id=...&user_address=...
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const userAddress = searchParams.get("user_address");

        if (!id || !userAddress) {
            return NextResponse.json(
                { error: "id and user_address are required" },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // Verify ownership
        const { data: comment } = await supabase
            .from("comments")
            .select("user_address")
            .eq("id", id)
            .single();

        if (!comment) {
            return NextResponse.json({ error: "Comment not found" }, { status: 404 });
        }

        if (comment.user_address !== userAddress.toLowerCase()) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const { error } = await supabase.from("comments").delete().eq("id", id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting comment:", error);
        return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
    }
}

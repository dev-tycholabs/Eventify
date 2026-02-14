import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT!,
    pinataGateway: process.env.PINATA_GATEWAY!,
});

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const name = formData.get("name") as string | null;
        const fileType = formData.get("type") as string | null; // "image" or "video"

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        // Validate file type
        if (!isImage && !isVideo) {
            return NextResponse.json(
                { error: "File must be an image or video" },
                { status: 400 }
            );
        }

        if (isImage && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: "Image must be JPEG, PNG, GIF, or WebP" },
                { status: 400 }
            );
        }

        if (isVideo && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: "Video must be MP4, WebM, or QuickTime" },
                { status: 400 }
            );
        }

        // Validate file size
        const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: `File size must be less than ${isVideo ? "100MB" : "10MB"}` },
                { status: 400 }
            );
        }

        // Upload to Pinata
        const upload = await pinata.upload.public
            .file(file)
            .group(process.env.PINATA_EVENTIFY_GROUP!)
            .name(name || file.name);

        // Gateway URL for display/preview
        const gatewayUrl = `https://${process.env.PINATA_GATEWAY}/ipfs/${upload.cid}`;
        // IPFS protocol URL for blockchain storage (standard NFT format)
        const ipfsUrl = `ipfs://${upload.cid}`;

        return NextResponse.json({
            success: true,
            cid: upload.cid,
            url: gatewayUrl,      // For display in UI
            imageUrl: gatewayUrl, // Legacy support
            ipfsUrl,              // For blockchain storage
            name: upload.name,
            type: isVideo ? "video" : "image",
            mimeType: file.type,
        });
    } catch (error) {
        console.error("Pinata upload error:", error);
        return NextResponse.json(
            { error: "Failed to upload file to IPFS" },
            { status: 500 }
        );
    }
}

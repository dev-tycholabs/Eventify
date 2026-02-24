import jsPDF from "jspdf";
import QRCode from "qrcode";

interface TicketData {
    eventName: string;
    venue: string;
    date: string;
    time: string;
    tokenId: string;
    contractAddress: string;
    status: string;
    price: string;
    chainId?: number;
}

async function generateQRCode(data: string): Promise<string> {
    return await QRCode.toDataURL(data, {
        width: 200,
        margin: 1,
        color: { dark: "#1e1b4b", light: "#ffffff" },
    });
}

async function drawTicket(
    ctx: CanvasRenderingContext2D,
    data: TicketData,
    width: number,
    height: number
): Promise<void> {
    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Header gradient
    const headerGradient = ctx.createLinearGradient(0, 0, width, 0);
    headerGradient.addColorStop(0, "#7c3aed");
    headerGradient.addColorStop(1, "#db2777");
    ctx.fillStyle = headerGradient;
    ctx.fillRect(0, 0, width, 8);

    // Event name section
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(data.eventName, 40, 60);

    // Ticket ID badge
    ctx.fillStyle = "#1e293b";
    roundRect(ctx, width - 140, 35, 100, 35, 8);
    ctx.fill();
    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 14px monospace";
    ctx.fillText(`#${data.tokenId}`, width - 120, 58);

    // Divider line
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 90);
    ctx.lineTo(width - 40, 90);
    ctx.stroke();

    // Status badge
    const statusColors: Record<string, { bg: string; text: string }> = {
        Valid: { bg: "#166534", text: "#4ade80" },
        Used: { bg: "#374151", text: "#9ca3af" },
        "Listed for Sale": { bg: "#9a3412", text: "#fb923c" },
        "Event Passed": { bg: "#991b1b", text: "#f87171" },
    };
    const statusStyle = statusColors[data.status] || statusColors.Valid;

    ctx.fillStyle = statusStyle.bg;
    const statusWidth = ctx.measureText(data.status).width + 30;
    roundRect(ctx, 40, 110, statusWidth, 30, 15);
    ctx.fill();
    ctx.fillStyle = statusStyle.text;
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(data.status, 55, 130);

    // Details section
    const detailsY = 170;

    // Date
    drawDetailItem(ctx, "DATE", data.date, 40, detailsY);

    // Time
    drawDetailItem(ctx, "TIME", data.time || "TBA", 40, detailsY + 60);

    // Venue
    drawDetailItem(ctx, "VENUE", data.venue, 40, detailsY + 120);

    // Price
    drawDetailItem(ctx, "PRICE", data.price, 40, detailsY + 180);

    // QR Code section - contains URL to verify page
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const verifyUrl = `${baseUrl}/verify?contract=${data.contractAddress}&tokenId=${data.tokenId}&event=${encodeURIComponent(data.eventName)}${data.chainId ? `&chainId=${data.chainId}` : ""}`;

    const qrCodeDataUrl = await generateQRCode(verifyUrl);
    const qrImage = new Image();

    await new Promise<void>((resolve) => {
        qrImage.onload = () => resolve();
        qrImage.src = qrCodeDataUrl;
    });

    // QR code background
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, width - 200, 150, 160, 180, 12);
    ctx.fill();

    // Draw QR code
    ctx.drawImage(qrImage, width - 190, 160, 140, 140);

    // QR label
    ctx.fillStyle = "#64748b";
    ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Scan for verification", width - 120, 315);
    ctx.textAlign = "left";

    // Contract address footer
    ctx.fillStyle = "#1e293b";
    roundRect(ctx, 20, height - 70, width - 40, 50, 8);
    ctx.fill();

    ctx.fillStyle = "#64748b";
    ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("CONTRACT ADDRESS", 35, height - 48);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px monospace";
    ctx.fillText(data.contractAddress, 35, height - 30);

    // Bottom gradient line
    const bottomGradient = ctx.createLinearGradient(0, 0, width, 0);
    bottomGradient.addColorStop(0, "#7c3aed");
    bottomGradient.addColorStop(1, "#db2777");
    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, height - 6, width, 6);
}

function drawDetailItem(
    ctx: CanvasRenderingContext2D,
    label: string,
    value: string,
    x: number,
    y: number
): void {
    ctx.fillStyle = "#64748b";
    ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(label, x, y);

    ctx.fillStyle = "#f1f5f9";
    ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(value, x, y + 22);
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

export function getTicketDataFromElement(elementId: string): TicketData | null {
    const element = document.getElementById(elementId);
    if (!element) return null;

    const eventName = element.querySelector("h2")?.textContent?.trim() || "Event";

    let venue = "", date = "", time = "", price = "", tokenId = "", contractAddress = "", status = "Valid";

    // Get token ID from "Ticket #X" text
    const allText = element.textContent || "";
    const tokenMatch = allText.match(/Ticket #(\d+)/);
    if (tokenMatch) tokenId = tokenMatch[1];

    // Get contract address
    const contractMatch = allText.match(/0x[a-fA-F0-9]{40}/);
    if (contractMatch) contractAddress = contractMatch[0];

    // Get status
    const statusEl = element.querySelector('[class*="font-medium"]');
    if (statusEl?.textContent) {
        const statusText = statusEl.textContent.trim();
        if (["Valid", "Used", "Listed for Sale", "Event Passed"].includes(statusText)) {
            status = statusText;
        }
    }

    // Get details from the structured rows
    const rows = element.querySelectorAll('[class*="items-start"]');
    rows.forEach((row) => {
        const text = row.textContent || "";
        if (text.includes("Date") || text.includes("DATE")) {
            const whiteText = row.querySelectorAll('[class*="text-white"]');
            if (whiteText.length >= 1) {
                date = whiteText[0]?.textContent?.trim() || "";
            }
            if (whiteText.length >= 2) {
                time = whiteText[1]?.textContent?.trim() || "";
            } else {
                // Try to get time from gray text
                const grayText = row.querySelector('[class*="text-gray"]');
                if (grayText) time = grayText.textContent?.trim() || "";
            }
        }
        if (text.includes("Venue") || text.includes("VENUE")) {
            const valueEl = row.querySelector('[class*="text-white"][class*="font-medium"]');
            venue = valueEl?.textContent?.trim() || "";
        }
        if (text.includes("Price") || text.includes("PRICE")) {
            const valueEl = row.querySelector('[class*="text-white"][class*="font-medium"]');
            price = valueEl?.textContent?.trim() || "";
        }
    });

    return { eventName, venue, date, time, tokenId, contractAddress, status, price };
}

export async function downloadTicketAsPNG(
    elementId: string,
    fileName: string
): Promise<void> {
    const data = getTicketDataFromElement(elementId);
    if (!data) throw new Error("Could not extract ticket data");

    const width = 500;
    const height = 450;
    const scale = 2;

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    ctx.scale(scale, scale);
    await drawTicket(ctx, data, width, height);

    const link = document.createElement("a");
    link.download = `${fileName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
}

export async function downloadTicketAsPDF(
    elementId: string,
    fileName: string
): Promise<void> {
    const data = getTicketDataFromElement(elementId);
    if (!data) throw new Error("Could not extract ticket data");

    const width = 500;
    const height = 450;
    const scale = 2;

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    ctx.scale(scale, scale);
    await drawTicket(ctx, data, width, height);

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [width, height],
    });

    pdf.addImage(imgData, "PNG", 0, 0, width, height);
    pdf.save(`${fileName}.pdf`);
}

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface AuthTokenPayload extends JWTPayload {
    address: string;
}

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

function getSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not set");
    return new TextEncoder().encode(secret);
}

export async function signAccessToken(address: string): Promise<string> {
    return new SignJWT({ address: address.toLowerCase() })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(ACCESS_TOKEN_EXPIRY)
        .setIssuer("eventify")
        .setSubject(address.toLowerCase())
        .sign(getSecret());
}

export async function signRefreshToken(address: string): Promise<string> {
    return new SignJWT({ address: address.toLowerCase() })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(REFRESH_TOKEN_EXPIRY)
        .setIssuer("eventify")
        .setSubject(address.toLowerCase())
        .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<AuthTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getSecret(), {
            issuer: "eventify",
        });
        return payload as AuthTokenPayload;
    } catch {
        return null;
    }
}

export async function verifyRefreshToken(token: string): Promise<AuthTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getSecret(), {
            issuer: "eventify",
        });
        return payload as AuthTokenPayload;
    } catch {
        return null;
    }
}

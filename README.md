# 🎫 Eventify - Decentralized Event Ticketing Platform
![alt text](image.png)
> **Full-stack event platform for online and offline events — NFT tickets, secondary marketplace, token-gated communities, and API-as-a-service on Etherlink**

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)](https://nextjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.25-blue?logo=solidity)](https://soliditylang.org/)
[![Etherlink](https://img.shields.io/badge/Etherlink-Shadownet-purple)](https://www.etherlink.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 🌟 Overview

Eventify is a full-stack event platform for both online and offline events, powered by blockchain technology. Whether it's a concert, conference, virtual workshop, or live stream — Eventify handles ticketing, access control, community, and resale with on-chain guarantees. Built on Etherlink Shadownet, it provides a transparent, secure, and feature-rich ecosystem for event organizers and attendees.

The MVP proves the core loop — mint, buy, sell, verify, chat — all on-chain. The vision is to make Eventify the go-to platform for any event type, and an API layer that lets existing Web2 ticketing systems adopt NFT tickets without a rebuild.

### 🎯 MVP Features (Built)

#### For Event Organizers
- **🎨 NFT Ticket Creation** - Deploy custom ERC-721 ticket contracts with configurable parameters
- **💰 Royalty Management** - Earn royalties on secondary sales with flexible splitting among multiple recipients
- **📊 Real-time Analytics** - Track ticket sales, revenue, and attendee engagement
- **🔍 QR Code Verification** - Scan and verify tickets at event entry with blockchain validation
- **💬 Token-Gated Chat** - Exclusive real-time chat rooms for ticket holders
- **📍 Location-Based Discovery** - Events discoverable by proximity and city
- **🎭 Draft Management** - Save and publish events when ready

#### For Attendees
- **🎟️ NFT Tickets** - Own your tickets as blockchain-verified NFTs
- **🏪 Secondary Marketplace** - Buy and sell tickets with price cap protection
- **💸 Secure Transfers** - Transfer tickets to friends with on-chain verification
- **📱 Digital Wallet** - Manage all your tickets in one dashboard
- **🗓️ Calendar Integration** - Filter events by date with visual calendar
- **🌍 Location Discovery** - Find events nearby or search by city
- **👤 User Profiles** - Customizable profiles with QR codes for quick check-in
- **💬 Event Communities** - Join token-gated text chat with other attendees

#### Under the Hood
- **🔐 Wallet Authentication** - Secure sign-in with Web3 wallets
- **📸 Media Management** - Upload event images and videos to IPFS via Pinata
- **🌐 Multi-timezone Support** - Events displayed in local timezones
- **📊 Transaction History** - Complete audit trail of all ticket operations
- **🎨 Customizable Metadata** - Rich NFT metadata with event details
- **⚡ Real-time Updates** - Live chat and notifications via Supabase Realtime
- **🔄 Royalty Splitter** - Automated distribution of royalties to multiple recipients

### 🔭 Vision: Where Eventify Is Headed

| Direction | What it means |
|---|---|
| **Online Events** | Token-gated video and audio rooms (extending the text chat already built), screen sharing, breakout rooms, hybrid event support |
| **Payments** | Card payments and fiat on-ramps so non-crypto users can buy tickets seamlessly |
| **API-as-a-Service** | REST API, SDK, and embeddable widgets so existing Web2 ticketing platforms can add NFT tickets without a rebuild |
| **Smart Wallets** | Embedded wallets auto-created on signup, removing the Web3 onboarding barrier |

---

## 🏗️ Architecture

### Technology Stack

#### Frontend
- **Framework**: Next.js 16.1.6 (React 19.2.3)
- **Styling**: Tailwind CSS 4
- **Web3**: wagmi 2.19.5, viem 2.45.1, RainbowKit 2.2.10
- **State Management**: TanStack Query 5.90.20
- **Database**: Supabase (PostgreSQL + Realtime)
- **Storage**: Pinata (IPFS)

#### Smart Contracts
- **Language**: Solidity 0.8.25
- **Framework**: Hardhat 2.13.0
- **Standards**: ERC-721, ERC-2981 (Royalties), EIP-1167 (Minimal Proxies)
- **Libraries**: OpenZeppelin Contracts 4.9.3

#### Blockchain
- **Network**: Etherlink Shadownet (Testnet)
- **Chain ID**: 127823
- **Native Currency**: XTZ
- **RPC**: Ankr RPC endpoint

### Smart Contract Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      EventFactory                            │
│  - Creates EventTicket contracts                            │
│  - Deploys RoyaltySplitter clones                          │
│  - Manages event registry                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ├──────────────────┬─────────────────┐
                          ▼                  ▼                 ▼
              ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
              │  EventTicket #1  │  │ EventTicket  │  │ EventTicket  │
              │  (ERC-721 NFT)   │  │      #2      │  │      #N      │
              │  - Mint tickets  │  └──────────────┘  └──────────────┘
              │  - Verify entry  │
              │  - Price caps    │
              └──────────────────┘
                          │
                          ▼
              ┌──────────────────────────────────────┐
              │      TicketMarketplace               │
              │  - List tickets for sale             │
              │  - Buy/sell with royalties           │
              │  - Price cap enforcement             │
              │  - Escrow management                 │
              └──────────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────────────────────┐
              │      RoyaltySplitter (Clone)         │
              │  - Receive royalty payments          │
              │  - Split among recipients            │
              │  - Automated distribution            │
              └──────────────────────────────────────┘
```

### Database Schema

```sql
-- Core Tables
users                    -- User profiles and wallet addresses
events                   -- Event metadata and configuration
user_tickets             -- Ticket ownership tracking
marketplace_listings     -- Active and historical listings
transactions             -- Complete transaction history
royalty_recipients       -- Royalty split configuration
royalty_distributions    -- Distribution audit trail
comments                 -- Event comments
chat_messages            -- Token-gated chat (with Realtime)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and npm
- Git
- MetaMask or compatible Web3 wallet
- Etherlink Shadownet testnet XTZ (for deployment)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/eventify.git
cd eventify
```

2. **Install frontend dependencies**
```bash
npm install
```

3. **Install smart contract dependencies**
```bash
cd nft-marketplace-Marketplace
npm install
cd ..
```

4. **Configure environment variables**

Create `.env.local` in the root directory:

```env
# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# JWT Secret
JWT_SECRET=your_strong_random_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Pinata (IPFS)
PINATA_API_KEY=your_api_key
PINATA_API_SECRET=your_api_secret
PINATA_JWT=your_jwt_token
PINATA_EVENTIFY_GROUP=your_group_id
PINATA_GATEWAY=your_gateway_domain
```

5. **Set up Supabase database**

Run the SQL schema in your Supabase SQL Editor:
```bash
# Use the complete schema
supabase/setup_full_schema.sql
```

6. **Deploy smart contracts** (Optional - contracts are already deployed)

```bash
cd nft-marketplace-Marketplace
cp .env.example .env
# Add your PRIVATE_KEY to .env
npm run deploy:etherlink-testnet
cd ..
```

7. **Start the development server**
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

---

## 📋 Smart Contract Deployment

### Deployed Contracts (Etherlink Shadownet)

| Contract | Address |
|---|---|
| EventFactory | `0x6885809b6894B8Dfa5BA92f01fEd1031E96007Ae` |
| TicketMarketplace | `0xFBC5f575A39D97a15545F095B92fA23BAa3ea075` |
| Registry | `0xDb3B9b7AC97D51D825aA43733D3f4aA49fe8B4Da` |
| RoyaltySplitterImpl | `0x9273391df6651941Fd02a674A5FB849e721F0094` |

> **Network:** Etherlink Shadownet (Chain ID: 127823)

### Deployment Process

```bash
cd nft-marketplace-Marketplace
npm run deploy:etherlink-testnet
```

The deployment script:
1. Deploys Registry with 2.5% platform fee
2. Deploys TicketMarketplace
3. Deploys RoyaltySplitter implementation
4. Deploys EventFactory with 5% default royalty
5. Configures contract permissions
6. Updates frontend contract addresses automatically

---

## 🎯 Core Features Deep Dive

### 1. Event Creation

Organizers can create events with:
- **Basic Info**: Name, description, date, venue
- **Location**: Country, state, city (searchable)
- **Media**: Cover image, gallery images/videos (IPFS)
- **Ticketing**: Price, supply, max per wallet
- **Resale Control**: Maximum resale price cap
- **Royalties**: Percentage and recipient splitting
- **Timezone**: Event-specific timezone handling

### 2. NFT Tickets

Each ticket is an ERC-721 NFT with:
- Unique token ID
- Event metadata (name, date, venue)
- Purchase price tracking
- Usage status (for entry verification)
- Resale price cap enforcement
- Royalty configuration (ERC-2981)

### 3. Secondary Marketplace

Features:
- List tickets for resale
- Automated price cap validation
- Royalty distribution on sales
- Escrow-based transactions
- Cancel listings anytime
- Real-time listing updates

### 4. Ticket Verification

Two verification modes:
- **QR Scan**: Scan ticket QR codes for instant verification
- **Wallet Lookup**: Search by username or wallet address

Verification shows:
- Ticket validity
- Current holder
- Usage status
- One-click check-in

### 5. Token-Gated Chat

Real-time chat features:
- Ticket ownership verification
- Reply to messages
- Edit/delete messages
- Typing indicators
- Online user count
- Message history
- Full-page chat view

### 6. Royalty Management

Flexible royalty system:
- **Direct**: Organizer receives all royalties
- **Split**: Multiple recipients with percentage shares
- **Automated**: RoyaltySplitter contract handles distribution
- **Transparent**: Complete distribution history
- **On-chain**: All splits verified on blockchain

### 7. Location-Based Discovery

Find events by:
- **Nearby**: Events within configurable radius (10-500km)
- **City**: Events in specific cities
- **Search**: City name search with autocomplete
- **Calendar**: Filter by specific dates
- **Distance**: Shows distance from your location

---

## 🔐 Security Features

- **Smart Contract Auditing**: OpenZeppelin battle-tested contracts
- **Price Cap Protection**: Prevents ticket scalping
- **Wallet Authentication**: Secure Web3 sign-in
- **Row Level Security**: Supabase RLS policies
- **Input Validation**: Client and server-side validation
- **Reentrancy Guards**: Protection against reentrancy attacks
- **Access Control**: Role-based permissions
- **IPFS Storage**: Decentralized media storage

---

## 📱 User Flows

### Organizer Flow
1. Connect wallet
2. Create event with details and media
3. Configure ticketing parameters
4. Set royalty recipients (optional)
5. Publish event
6. Monitor sales and analytics
7. Verify tickets at event entry
8. Claim royalties from secondary sales

### Attendee Flow
1. Connect wallet
2. Browse/search events
3. Purchase tickets (NFTs minted)
4. View tickets in dashboard
5. List tickets on marketplace (optional)
6. Transfer tickets to friends
7. Show QR code at event entry
8. Join token-gated chat

---

## 🛠️ Development

### Project Structure

```
eventify/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/               # API routes
│   │   ├── dashboard/         # User dashboard
│   │   ├── events/            # Event pages
│   │   ├── marketplace/       # Marketplace
│   │   ├── profile/           # User profile
│   │   └── verify/            # Ticket verification
│   ├── components/            # React components
│   │   ├── dashboard/         # Dashboard components
│   │   ├── events/            # Event components
│   │   ├── landing/           # Landing page
│   │   ├── marketplace/       # Marketplace components
│   │   ├── profile/           # Profile components
│   │   ├── providers/         # Context providers
│   │   └── verify/            # Verification components
│   ├── config/                # Configuration
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utilities and APIs
│   ├── styles/                # Global styles
│   ├── types/                 # TypeScript types
│   └── utils/                 # Helper functions
├── nft-marketplace-Marketplace/
│   ├── contracts/             # Solidity contracts
│   │   └── src/
│   │       ├── EventFactory.sol
│   │       ├── EventTicket.sol
│   │       ├── Marketplace.sol
│   │       ├── Registry.sol
│   │       ├── RoyaltySplitter.sol
│   │       └── TicketMarketplace.sol
│   ├── scripts/               # Deployment scripts
│   └── deployments/           # Deployment artifacts
├── supabase/                  # Database schemas
└── public/                    # Static assets
```

### Key Technologies

**Frontend**
- Next.js 16 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- wagmi/viem for Web3 interactions
- RainbowKit for wallet connection
- TanStack Query for data fetching
- Supabase client for database/realtime

**Backend**
- Next.js API routes
- Supabase PostgreSQL
- Supabase Realtime for chat
- Pinata for IPFS uploads
- JWT for authentication

**Smart Contracts**
- Hardhat development environment
- OpenZeppelin contracts
- EIP-1167 minimal proxies
- ERC-2981 royalty standard

### Running Tests

```bash
# Smart contract tests
cd nft-marketplace-Marketplace
npm test

# Frontend tests (if implemented)
npm test
```

### Building for Production

```bash
npm run build
npm start
```

---

## 🌐 API Routes

### Events
- `GET /api/events` - List events with filters
- `POST /api/events` - Create event
- `GET /api/events/[id]` - Get event details
- `PATCH /api/events/[id]` - Update event
- `DELETE /api/events/[id]` - Delete draft event
- `GET /api/events/[id]/royalties` - Get royalty data
- `POST /api/events/[id]/royalties` - Record distribution

### Tickets
- `POST /api/tickets` - Sync ticket ownership
- `GET /api/tickets?owner=address` - Get user tickets

### Marketplace
- `GET /api/marketplace` - Get active listings
- `POST /api/marketplace` - Create/update listing

### Transactions
- `POST /api/transactions` - Record transaction

### Users
- `GET /api/users?address=0x...` - Get user by address
- `GET /api/users?username=name` - Get user by username
- `POST /api/users` - Create/update user

### Chat
- `GET /api/chat?event_id=...` - Get messages
- `POST /api/chat` - Send message
- `PATCH /api/chat` - Edit message
- `DELETE /api/chat` - Delete message

### Locations
- `GET /api/locations?type=countries` - Get countries
- `GET /api/locations?type=states&country_id=1` - Get states
- `GET /api/locations?type=cities&state_id=1` - Get cities
- `GET /api/locations?type=city_search&q=New` - Search cities

### Upload
- `POST /api/upload` - Upload to IPFS via Pinata

---

## 🎨 UI/UX Features

- **Responsive Design**: Mobile-first approach
- **Dark Theme**: Modern dark UI with purple/pink accents
- **Loading States**: Skeleton loaders and spinners
- **Error Handling**: User-friendly error messages
- **Toast Notifications**: Real-time feedback
- **Modal Dialogs**: Confirmation and detail views
- **QR Code Generation**: For tickets and profiles
- **Image Optimization**: Next.js Image component
- **Smooth Animations**: Tailwind transitions
- **Accessibility**: ARIA labels and keyboard navigation

---

## 🔮 Roadmap & Future Enhancements

### 🏁 Phase 1 — Payments & Onboarding (Next Up)
- [ ] Card payments (Stripe/fiat on-ramp — fans pay in USD/EUR, settled on-chain)
- [ ] Smart wallets (embedded wallets auto-created on signup for non-crypto users)
- [ ] Invoicing (automated PDF invoices for organizers and attendees)

### 🛡️ Phase 2 — Trust & Safety
- [ ] Soulbound ticket option (non-transferable tickets for high-demand events)
- [ ] On-chain identity verification (optional KYC-lite for premium events)
- [ ] Dispute resolution system (on-chain arbitration for contested transactions)
- [ ] Ticket insurance (on-chain coverage for event cancellations)
- [ ] Refund mechanisms (smart contract escrow with conditional release)

### 🚀 Phase 3 — Online Events: Token-Gated Video & Audio Platform
> Extending the token-gated text chat (already built in MVP) to a full virtual event platform.

- [ ] Token-gated video rooms (WebRTC-based, ticket NFT verified at join — only holders get in)
- [ ] Token-gated audio rooms (lightweight audio-only spaces for panels, AMAs, networking)
- [ ] Screen sharing & presentations (built-in for virtual workshops, talks, and demos)
- [ ] Breakout rooms (smaller gated rooms within a large event for networking sessions)
- [ ] Event recording & gated playback (record sessions, gate replays behind the same ticket NFT)
- [ ] Hybrid event mode (single event page with both physical venue details and virtual room access)
- [ ] Live reactions & polls (real-time audience engagement during virtual sessions)
- [ ] Speaker/moderator controls (mute, spotlight, hand-raise, stage management)

### 🤝 Phase 4 — Community & Engagement
- [ ] Loyalty rewards / POAPs (proof-of-attendance tokens for repeat attendees)
- [ ] Event recommendations engine (ML-based suggestions from purchase history)
- [ ] Social media integration (share tickets, invite friends, event feeds)
- [ ] Collaborative event management (multi-organizer roles and permissions)
- [ ] Email & push notifications (reminders, sale alerts, chat mentions)

### 🔌 Phase 5 — Eventify API: NFT Ticketing as a Service
> Existing Web2 ticketing platforms (Eventbrite, Dice, Humanitix, custom systems) can integrate NFT-based tickets without rebuilding their stack.

- [ ] REST API & SDK — simple endpoints to mint, transfer, verify, and list NFT tickets from any backend
- [ ] Webhook system — real-time callbacks for mint, transfer, resale, and check-in events
- [ ] Drop-in widget — embeddable JS widget for Web2 frontends (ticket purchase, wallet creation, QR display)
- [ ] Managed smart wallets — auto-provision wallets for end-users so Web2 platforms don't need to handle key management
- [ ] API key & dashboard — self-serve onboarding, usage analytics, and billing for integrators
- [ ] On-chain resale rails — let Web2 platforms offer secondary marketplace with price cap enforcement via a single API call
- [ ] Royalty-as-a-service — configure royalty splits per event through the API, distributed automatically on-chain
- [ ] Sandbox environment — testnet-backed staging for integrators to build and test without real funds

### 🌐 Phase 6 — Scale & Ecosystem
- [ ] Multi-chain support (Polygon, Arbitrum, Base — deploy where the audience is)
- [ ] Mobile app (React Native with embedded wallet)
- [ ] Bulk ticket operations (batch mint, airdrop, corporate group buys)
- [ ] Event templates (one-click setup for common event types)
- [ ] Calendar app integration (Google Calendar, Apple Calendar sync)
- [ ] Advanced analytics dashboard (revenue forecasting, attendee demographics)
- [ ] White-label solution (custom-branded ticketing for large organizers)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 👥 Team

Built with ❤️ for the hackathon

---

## 📞 Support

For support, please open an issue in the GitHub repository or contact the team.

---

## 🙏 Acknowledgments

- **Etherlink** - For the blockchain infrastructure
- **OpenZeppelin** - For secure smart contract libraries
- **Supabase** - For database and realtime functionality
- **Pinata** - For IPFS storage
- **RainbowKit** - For wallet connection UI
- **Vercel** - For hosting and deployment

---

## 📊 Project Stats

- **Smart Contracts**: 6 contracts
- **Frontend Components**: 50+ components
- **API Routes**: 15+ endpoints
- **Database Tables**: 9 tables
- **Lines of Code**: 10,000+ lines
- **Technologies Used**: 20+ technologies

---

**Built for the future of event ticketing** 🎫✨

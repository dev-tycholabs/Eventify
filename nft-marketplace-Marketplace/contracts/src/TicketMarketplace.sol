// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/INFT.sol";
import "./interfaces/IRegistry.sol";
import "./interfaces/IEventTicket.sol";

/// @title TicketMarketplace - Secondary marketplace for event tickets with price caps
/// @notice Allows resale of EventTicket NFTs with enforced price caps
/// @dev Extends marketplace functionality with ticket-specific validations
contract TicketMarketplace is ERC721Holder, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                          STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    uint256 public listingIdCounter;
    
    address private constant ETH = address(0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa);
    IRegistry private immutable _REGISTRY;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event ListingCreated(
        uint256 indexed listingId,
        address indexed nftAddress,
        uint256 indexed tokenId,
        address seller,
        uint256 price
    );
    event ListingCancelled(uint256 indexed listingId);
    event TicketSold(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 price
    );
    event FundsClaimed(address indexed user, address indexed currency, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error ContractIsDeprecated();
    error ListingNotActive();
    error ZeroAddressNotAllowed();
    error NotEnoughBalance();
    error IncorrectPayment();
    error NothingToClaim();
    error OnlySellerOrOwner();
    error NFTContractNotApproved();
    error CurrencyNotSupported();
    error ContractMustSupportERC2981();
    error PriceExceedsCap();
    error TicketAlreadyUsed();
    error CannotBuyOwnListing();
    error TransferFailed();
    error ListingDoesNotExist();

    /*//////////////////////////////////////////////////////////////
                               STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct Listing {
        uint256 id;
        uint256 tokenId;
        address nftAddress;
        address seller;
        address currency;
        uint256 price;
        uint256 createdAt;
        bool active;
    }

    /*//////////////////////////////////////////////////////////////
                               MAPPINGS
    //////////////////////////////////////////////////////////////*/

    mapping(uint256 => Listing) public listings;
    mapping(address => mapping(address => uint256)) public claimableFunds;
    // nftAddress => tokenId => listingId (to prevent duplicate listings)
    mapping(address => mapping(uint256 => uint256)) public activeListingByToken;

    /*//////////////////////////////////////////////////////////////
                          CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address registry) {
        if (registry == address(0)) revert ZeroAddressNotAllowed();
        _REGISTRY = IRegistry(registry);
    }

    /*//////////////////////////////////////////////////////////////
                          LISTING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice List a ticket for sale
    /// @param nftAddress EventTicket contract address
    /// @param tokenId Token ID of the ticket
    /// @param price Listing price in wei
    /// @param currency Payment currency (use ETH address for native token)
    /// @return listingId The ID of the created listing
    function listTicket(
        address nftAddress,
        uint256 tokenId,
        uint256 price,
        address currency
    ) external nonReentrant returns (uint256 listingId) {
        // Platform checks
        if (!_REGISTRY.platformContracts(address(this))) revert ContractIsDeprecated();
        if (!_REGISTRY.platformContracts(nftAddress)) revert NFTContractNotApproved();
        if (!_REGISTRY.approvedCurrencies(currency)) revert CurrencyNotSupported();

        INFT nftContract = INFT(nftAddress);
        if (!nftContract.supportsInterface(0x2a55205a)) revert ContractMustSupportERC2981();

        // Ticket-specific validations
        IEventTicket ticketContract = IEventTicket(nftAddress);
        
        // Check if ticket is already used
        if (ticketContract.ticketUsed(tokenId)) revert TicketAlreadyUsed();
        
        // Validate price cap
        if (!ticketContract.validateResalePrice(tokenId, price)) revert PriceExceedsCap();

        // Check no active listing exists for this token
        uint256 existingListing = activeListingByToken[nftAddress][tokenId];
        if (existingListing != 0 && listings[existingListing].active) {
            revert ListingNotActive(); // Token already listed
        }

        // Transfer NFT to marketplace
        nftContract.safeTransferFrom(msg.sender, address(this), tokenId, "");

        // Create listing
        unchecked {
            ++listingIdCounter;
        }
        listingId = listingIdCounter;

        listings[listingId] = Listing({
            id: listingId,
            tokenId: tokenId,
            nftAddress: nftAddress,
            seller: msg.sender,
            currency: currency,
            price: price,
            createdAt: block.timestamp,
            active: true
        });

        activeListingByToken[nftAddress][tokenId] = listingId;

        emit ListingCreated(listingId, nftAddress, tokenId, msg.sender, price);
    }

    /// @notice Buy a listed ticket
    /// @param listingId The listing ID to purchase
    /// @param amountFromBalance Amount to use from claimable balance
    function buyTicket(
        uint256 listingId,
        uint256 amountFromBalance
    ) external payable nonReentrant {
        if (!_REGISTRY.platformContracts(address(this))) revert ContractIsDeprecated();
        
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();
        if (listing.seller == msg.sender) revert CannotBuyOwnListing();

        address currency = listing.currency;
        uint256 price = listing.price;

        // Validate balance usage
        if (amountFromBalance > claimableFunds[msg.sender][currency]) 
            revert NotEnoughBalance();

        // Handle payment
        uint256 externalPayment = price - amountFromBalance;
        
        if (currency != ETH) {
            IERC20(currency).safeTransferFrom(msg.sender, address(this), externalPayment);
        } else {
            if (msg.value != externalPayment) revert IncorrectPayment();
        }

        if (amountFromBalance > 0) {
            claimableFunds[msg.sender][currency] -= amountFromBalance;
        }

        // Calculate fees and royalties
        INFT nftContract = INFT(listing.nftAddress);
        (address artistAddress, uint256 royalties) = nftContract.royaltyInfo(listing.tokenId, price);
        (address systemWallet, uint256 fee) = _REGISTRY.feeInfo(price);

        // Distribute funds
        claimableFunds[systemWallet][currency] += fee;

        if (listing.seller != artistAddress) {
            claimableFunds[artistAddress][currency] += royalties;
        } else {
            royalties = 0; // Seller is artist, no separate royalty
        }

        claimableFunds[listing.seller][currency] += price - fee - royalties;

        // Transfer NFT to buyer
        nftContract.safeTransferFrom(address(this), msg.sender, listing.tokenId, "");

        // Update listing state
        listing.active = false;
        delete activeListingByToken[listing.nftAddress][listing.tokenId];

        emit TicketSold(listingId, msg.sender, listing.seller, price);
    }

    /// @notice Cancel a listing and reclaim NFT
    /// @param listingId The listing ID to cancel
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        
        if (!listing.active) revert ListingNotActive();
        if (msg.sender != listing.seller && msg.sender != owner()) 
            revert OnlySellerOrOwner();

        listing.active = false;
        delete activeListingByToken[listing.nftAddress][listing.tokenId];

        // Return NFT to seller
        INFT(listing.nftAddress).safeTransferFrom(
            address(this), 
            listing.seller, 
            listing.tokenId, 
            ""
        );

        emit ListingCancelled(listingId);
    }

    /// @notice Claim accumulated funds
    /// @param currency Currency address to claim
    function claimFunds(address currency) external nonReentrant {
        uint256 amount = claimableFunds[msg.sender][currency];
        if (amount == 0) revert NothingToClaim();

        delete claimableFunds[msg.sender][currency];

        if (currency != ETH) {
            IERC20(currency).safeTransfer(msg.sender, amount);
        } else {
            (bool success, ) = msg.sender.call{value: amount}("");
            if (!success) revert TransferFailed();
        }

        emit FundsClaimed(msg.sender, currency, amount);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get listing details
    /// @param listingId The listing ID
    /// @return Listing struct
    function getListing(uint256 listingId) external view returns (Listing memory) {
        if (listingId == 0 || listingId > listingIdCounter) revert ListingDoesNotExist();
        return listings[listingId];
    }

    /// @notice Get all active listings (paginated)
    /// @param offset Starting index
    /// @param limit Max results
    /// @return activeListings Array of active listings
    /// @return total Total listing count
    function getActiveListings(
        uint256 offset,
        uint256 limit
    ) external view returns (Listing[] memory activeListings, uint256 total) {
        // Count active listings
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= listingIdCounter; i++) {
            if (listings[i].active) activeCount++;
        }
        total = activeCount;

        if (offset >= activeCount || limit == 0) {
            return (new Listing[](0), total);
        }

        // Collect active listings
        uint256 resultSize = limit;
        if (offset + limit > activeCount) {
            resultSize = activeCount - offset;
        }

        activeListings = new Listing[](resultSize);
        uint256 found = 0;
        uint256 added = 0;

        for (uint256 i = 1; i <= listingIdCounter && added < resultSize; i++) {
            if (listings[i].active) {
                if (found >= offset) {
                    activeListings[added] = listings[i];
                    added++;
                }
                found++;
            }
        }
    }

    /// @notice Get listings by seller
    /// @param seller Seller address
    /// @return sellerListings Array of seller's listings
    function getListingsBySeller(address seller) external view returns (Listing[] memory sellerListings) {
        // Count seller's listings
        uint256 count = 0;
        for (uint256 i = 1; i <= listingIdCounter; i++) {
            if (listings[i].seller == seller && listings[i].active) count++;
        }

        sellerListings = new Listing[](count);
        uint256 index = 0;

        for (uint256 i = 1; i <= listingIdCounter && index < count; i++) {
            if (listings[i].seller == seller && listings[i].active) {
                sellerListings[index] = listings[i];
                index++;
            }
        }
    }

    /// @notice Get listings by NFT contract
    /// @param nftAddress NFT contract address
    /// @return nftListings Array of listings for the NFT contract
    function getListingsByNFT(address nftAddress) external view returns (Listing[] memory nftListings) {
        uint256 count = 0;
        for (uint256 i = 1; i <= listingIdCounter; i++) {
            if (listings[i].nftAddress == nftAddress && listings[i].active) count++;
        }

        nftListings = new Listing[](count);
        uint256 index = 0;

        for (uint256 i = 1; i <= listingIdCounter && index < count; i++) {
            if (listings[i].nftAddress == nftAddress && listings[i].active) {
                nftListings[index] = listings[i];
                index++;
            }
        }
    }

    /// @notice Check if a price is valid for a ticket
    /// @param nftAddress EventTicket contract address
    /// @param tokenId Token ID
    /// @param price Proposed price
    /// @return valid Whether price is within cap
    /// @return maxPrice Maximum allowed price
    function checkPriceCap(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    ) external view returns (bool valid, uint256 maxPrice) {
        IEventTicket ticketContract = IEventTicket(nftAddress);
        maxPrice = ticketContract.getMaxResalePrice(tokenId);
        valid = price <= maxPrice;
    }

    /// @notice Get registry address
    function getRegistry() external view returns (address) {
        return address(_REGISTRY);
    }
}

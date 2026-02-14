// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title EventTicket - ERC721 NFT Ticket with resale price caps
/// @notice Ticket NFT for events with built-in verification and resale controls
/// @dev Implements ERC2981 for royalties, compatible with Marketplace.sol
contract EventTicket is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    ERC2981,
    Ownable,
    ReentrancyGuard
{
    using Counters for Counters.Counter;

    /*//////////////////////////////////////////////////////////////
                          STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    Counters.Counter private _tokenIdCounter;

    string public eventName;
    string public eventVenue;
    uint256 public eventDate;
    uint256 public ticketPrice;
    uint256 public maxSupply;
    uint256 public maxTicketsPerWallet;
    uint256 public maxResalePricePercent; // e.g., 110 = 110% of original price
    string public baseTokenURI;
    address public eventOrganizer;
    address public factory;

    /*//////////////////////////////////////////////////////////////
                               MAPPINGS
    //////////////////////////////////////////////////////////////*/

    mapping(uint256 => bool) public ticketUsed;
    mapping(uint256 => uint256) public ticketPurchasePrice;
    mapping(address => uint256) public ticketsPurchasedBy;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event TicketPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price
    );
    event TicketVerified(
        uint256 indexed tokenId,
        address indexed holder,
        bool isValid
    );
    event TicketMarkedUsed(
        uint256 indexed tokenId,
        address indexed holder,
        uint256 timestamp
    );
    event FundsWithdrawn(address indexed organizer, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error SoldOut();
    error IncorrectPayment();
    error TicketAlreadyUsed();
    error TicketDoesNotExist();
    error NotTicketHolder();
    error OnlyOrganizerOrOwner();
    error EventAlreadyPassed();
    error NoFundsToWithdraw();
    error TransferFailed();
    error InvalidResalePrice();
    error ZeroAddressNotAllowed();
    error ExceedsMaxPerWallet();

    /*//////////////////////////////////////////////////////////////
                          CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param _name Event name (also used as NFT collection name)
    /// @param _symbol NFT collection symbol
    /// @param _venue Event venue
    /// @param _eventDate Unix timestamp of event date
    /// @param _ticketPrice Price per ticket in wei
    /// @param _maxSupply Maximum number of tickets
    /// @param _maxTicketsPerWallet Max tickets a single wallet can purchase (0 = unlimited)
    /// @param _maxResalePricePercent Max resale price as percentage (e.g., 110 = 110%)
    /// @param _baseURI Base URI for token metadata
    /// @param _organizer Event organizer address (receives funds)
    /// @param _royaltyReceiver Address that receives royalties (organizer or splitter clone)
    /// @param _royaltyPercent Royalty percentage in basis points (e.g., 500 = 5%)
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _venue,
        uint256 _eventDate,
        uint256 _ticketPrice,
        uint256 _maxSupply,
        uint256 _maxTicketsPerWallet,
        uint256 _maxResalePricePercent,
        string memory _baseURI,
        address _organizer,
        address _royaltyReceiver,
        uint96 _royaltyPercent
    ) ERC721(_name, _symbol) {
        if (_organizer == address(0)) revert ZeroAddressNotAllowed();

        eventName = _name;
        eventVenue = _venue;
        eventDate = _eventDate;
        ticketPrice = _ticketPrice;
        maxSupply = _maxSupply;
        maxTicketsPerWallet = _maxTicketsPerWallet;
        maxResalePricePercent = _maxResalePricePercent;
        baseTokenURI = _baseURI;
        eventOrganizer = _organizer;
        factory = msg.sender;

        // Set royalty receiver (organizer directly, or a RoyaltySplitter clone)
        _setDefaultRoyalty(_royaltyReceiver, _royaltyPercent);

        // Transfer ownership to organizer
        _transferOwnership(_organizer);
    }

    /*//////////////////////////////////////////////////////////////
                          TICKET PURCHASE
    //////////////////////////////////////////////////////////////*/

    /// @notice Purchase a ticket for the event
    /// @return tokenId The ID of the minted ticket
    function purchaseTicket()
        external
        payable
        nonReentrant
        returns (uint256 tokenId)
    {
        if (_tokenIdCounter.current() >= maxSupply) revert SoldOut();
        if (msg.value != ticketPrice) revert IncorrectPayment();
        if (block.timestamp >= eventDate) revert EventAlreadyPassed();
        if (
            maxTicketsPerWallet > 0 &&
            ticketsPurchasedBy[msg.sender] + 1 > maxTicketsPerWallet
        ) revert ExceedsMaxPerWallet();

        ticketsPurchasedBy[msg.sender] += 1;

        _tokenIdCounter.increment();
        tokenId = _tokenIdCounter.current();

        ticketPurchasePrice[tokenId] = msg.value;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(
            tokenId,
            string(abi.encodePacked(baseTokenURI, _toString(tokenId)))
        );

        emit TicketPurchased(tokenId, msg.sender, msg.value);
    }

    /// @notice Purchase multiple tickets
    /// @param quantity Number of tickets to purchase
    /// @return tokenIds Array of minted token IDs
    function purchaseTickets(
        uint256 quantity
    ) external payable nonReentrant returns (uint256[] memory tokenIds) {
        if (_tokenIdCounter.current() + quantity > maxSupply) revert SoldOut();
        if (msg.value != ticketPrice * quantity) revert IncorrectPayment();
        if (block.timestamp >= eventDate) revert EventAlreadyPassed();
        if (
            maxTicketsPerWallet > 0 &&
            ticketsPurchasedBy[msg.sender] + quantity > maxTicketsPerWallet
        ) revert ExceedsMaxPerWallet();

        ticketsPurchasedBy[msg.sender] += quantity;

        tokenIds = new uint256[](quantity);

        for (uint256 i = 0; i < quantity; i++) {
            _tokenIdCounter.increment();
            uint256 tokenId = _tokenIdCounter.current();

            ticketPurchasePrice[tokenId] = ticketPrice;
            tokenIds[i] = tokenId;

            _safeMint(msg.sender, tokenId);
            _setTokenURI(
                tokenId,
                string(abi.encodePacked(baseTokenURI, _toString(tokenId)))
            );

            emit TicketPurchased(tokenId, msg.sender, ticketPrice);
        }
    }

    /*//////////////////////////////////////////////////////////////
                          TICKET VERIFICATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Verify a ticket's authenticity and validity
    /// @param tokenId The ticket token ID to verify
    /// @return isValid Whether the ticket is valid for entry
    /// @return holder Current ticket holder address
    /// @return used Whether the ticket has been used
    function verifyTicket(
        uint256 tokenId
    ) external view returns (bool isValid, address holder, bool used) {
        if (!_exists(tokenId)) revert TicketDoesNotExist();

        holder = ownerOf(tokenId);
        used = ticketUsed[tokenId];
        isValid = !used && block.timestamp <= eventDate + 1 days; // Valid until 1 day after event

        return (isValid, holder, used);
    }

    /// @notice Mark a ticket as used (for event entry)
    /// @dev Only callable by organizer or contract owner
    /// @param tokenId The ticket token ID to mark as used
    function markAsUsed(uint256 tokenId) external {
        if (msg.sender != eventOrganizer && msg.sender != owner())
            revert OnlyOrganizerOrOwner();
        if (!_exists(tokenId)) revert TicketDoesNotExist();
        if (ticketUsed[tokenId]) revert TicketAlreadyUsed();

        ticketUsed[tokenId] = true;

        emit TicketMarkedUsed(tokenId, ownerOf(tokenId), block.timestamp);
    }

    /// @notice Batch mark tickets as used
    /// @param tokenIds Array of ticket token IDs
    function batchMarkAsUsed(uint256[] calldata tokenIds) external {
        if (msg.sender != eventOrganizer && msg.sender != owner())
            revert OnlyOrganizerOrOwner();

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            if (!_exists(tokenId)) revert TicketDoesNotExist();
            if (ticketUsed[tokenId]) revert TicketAlreadyUsed();

            ticketUsed[tokenId] = true;
            emit TicketMarkedUsed(tokenId, ownerOf(tokenId), block.timestamp);
        }
    }

    /*//////////////////////////////////////////////////////////////
                          RESALE PRICE CAP
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the maximum allowed resale price for a ticket
    /// @param tokenId The ticket token ID
    /// @return maxPrice Maximum resale price in wei
    function getMaxResalePrice(
        uint256 tokenId
    ) external view returns (uint256 maxPrice) {
        if (!_exists(tokenId)) revert TicketDoesNotExist();

        uint256 originalPrice = ticketPurchasePrice[tokenId];
        maxPrice = (originalPrice * maxResalePricePercent) / 100;
    }

    /// @notice Validate if a resale price is within allowed limits
    /// @param tokenId The ticket token ID
    /// @param resalePrice Proposed resale price
    /// @return valid Whether the price is valid
    function validateResalePrice(
        uint256 tokenId,
        uint256 resalePrice
    ) external view returns (bool valid) {
        if (!_exists(tokenId)) revert TicketDoesNotExist();

        uint256 originalPrice = ticketPurchasePrice[tokenId];
        uint256 maxPrice = (originalPrice * maxResalePricePercent) / 100;

        return resalePrice <= maxPrice;
    }

    /*//////////////////////////////////////////////////////////////
                          ORGANIZER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Withdraw collected funds to organizer
    function withdrawFunds() external nonReentrant {
        if (msg.sender != eventOrganizer && msg.sender != owner())
            revert OnlyOrganizerOrOwner();

        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFundsToWithdraw();

        (bool success, ) = eventOrganizer.call{value: balance}("");
        if (!success) revert TransferFailed();

        emit FundsWithdrawn(eventOrganizer, balance);
    }

    /// @notice Update base token URI
    /// @param newBaseURI New base URI
    function setBaseURI(string memory newBaseURI) external {
        if (msg.sender != eventOrganizer && msg.sender != owner())
            revert OnlyOrganizerOrOwner();

        baseTokenURI = newBaseURI;
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get total tickets sold
    function totalSold() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    /// @notice Get remaining tickets
    function remainingTickets() external view returns (uint256) {
        return maxSupply - _tokenIdCounter.current();
    }

    /// @notice Get all tickets owned by an address
    /// @param owner Address to query
    /// @return tokenIds Array of owned token IDs
    function getTicketsByOwner(
        address owner
    ) external view returns (uint256[] memory tokenIds) {
        uint256 balance = balanceOf(owner);
        tokenIds = new uint256[](balance);

        for (uint256 i = 0; i < balance; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }
    }

    /// @notice Get event details
    function getEventDetails()
        external
        view
        returns (
            string memory name,
            string memory venue,
            uint256 date,
            uint256 price,
            uint256 supply,
            uint256 sold,
            address organizer
        )
    {
        return (
            eventName,
            eventVenue,
            eventDate,
            ticketPrice,
            maxSupply,
            _tokenIdCounter.current(),
            eventOrganizer
        );
    }

    /*//////////////////////////////////////////////////////////////
                          REQUIRED OVERRIDES
    //////////////////////////////////////////////////////////////*/

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";

        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }
}

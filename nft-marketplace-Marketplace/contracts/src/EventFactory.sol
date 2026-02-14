// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./EventTicket.sol";
import "./RoyaltySplitter.sol";
import "./interfaces/IRegistry.sol";

/// @title EventFactory - Factory for deploying EventTicket contracts
/// @notice Creates and tracks event ticket contracts
/// @dev Automatically registers new events with the platform Registry
contract EventFactory is Ownable {
    /*//////////////////////////////////////////////////////////////
                          STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    IRegistry public registry;
    uint256 public eventCount;
    uint96 public defaultRoyaltyPercent; // in basis points (e.g., 500 = 5%)
    uint256 public defaultMaxResalePercent; // e.g., 110 = 110% of original
    address public splitterImplementation; // RoyaltySplitter implementation for cloning

    /*//////////////////////////////////////////////////////////////
                               STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct EventInfo {
        uint256 id;
        address contractAddress;
        address organizer;
        string name;
        string venue;
        uint256 eventDate;
        uint256 ticketPrice;
        uint256 maxSupply;
        uint256 createdAt;
    }

    /*//////////////////////////////////////////////////////////////
                               ARRAYS & MAPPINGS
    //////////////////////////////////////////////////////////////*/

    address[] public allEvents;
    mapping(address => address[]) public eventsByOrganizer;
    mapping(address => EventInfo) public eventInfo;
    mapping(address => bool) public isEventContract;
    mapping(address => address) public eventSplitter; // eventAddress => splitter clone address

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event EventCreated(
        uint256 indexed eventId,
        address indexed contractAddress,
        address indexed organizer,
        string name,
        uint256 eventDate,
        uint256 ticketPrice,
        uint256 maxSupply
    );
    event RegistryUpdated(
        address indexed oldRegistry,
        address indexed newRegistry
    );
    event DefaultRoyaltyUpdated(uint96 newRoyaltyPercent);
    event DefaultMaxResaleUpdated(uint256 newMaxResalePercent);
    event SplitterCreated(
        address indexed eventAddress,
        address indexed splitterAddress
    );

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddressNotAllowed();
    error InvalidEventDate();
    error InvalidTicketPrice();
    error InvalidMaxSupply();
    error InvalidRoyaltyPercent();
    error InvalidMaxResalePercent();
    error InvalidMaxTicketsPerWallet();
    error EventNotFound();

    /*//////////////////////////////////////////////////////////////
                          CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param _registry Address of the platform Registry contract
    /// @param _defaultRoyaltyPercent Default royalty in basis points (e.g., 500 = 5%)
    /// @param _defaultMaxResalePercent Default max resale percentage (e.g., 110 = 110%)
    /// @param _splitterImplementation Address of the RoyaltySplitter implementation for cloning
    constructor(
        address _registry,
        uint96 _defaultRoyaltyPercent,
        uint256 _defaultMaxResalePercent,
        address _splitterImplementation
    ) {
        if (_registry == address(0)) revert ZeroAddressNotAllowed();
        if (_splitterImplementation == address(0))
            revert ZeroAddressNotAllowed();
        if (_defaultRoyaltyPercent > 1000) revert InvalidRoyaltyPercent(); // Max 10%
        if (_defaultMaxResalePercent < 100) revert InvalidMaxResalePercent(); // Min 100%

        registry = IRegistry(_registry);
        defaultRoyaltyPercent = _defaultRoyaltyPercent;
        defaultMaxResalePercent = _defaultMaxResalePercent;
        splitterImplementation = _splitterImplementation;
    }

    /*//////////////////////////////////////////////////////////////
                          EVENT CREATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Create a new event with ticket sales
    /// @param name Event name
    /// @param symbol NFT collection symbol
    /// @param venue Event venue
    /// @param eventDate Unix timestamp of event date
    /// @param ticketPrice Price per ticket in wei
    /// @param maxSupply Maximum number of tickets
    /// @param baseURI Base URI for ticket metadata
    /// @return eventAddress Address of the deployed EventTicket contract
    function createEvent(
        string memory name,
        string memory symbol,
        string memory venue,
        uint256 eventDate,
        uint256 ticketPrice,
        uint256 maxSupply,
        string memory baseURI
    ) external returns (address eventAddress) {
        return
            _createEvent(
                name,
                symbol,
                venue,
                eventDate,
                ticketPrice,
                maxSupply,
                0, // no per-wallet limit
                defaultMaxResalePercent,
                baseURI,
                defaultRoyaltyPercent,
                new address[](0),
                new uint256[](0)
            );
    }

    /// @notice Create event with custom resale and royalty settings
    /// @param name Event name
    /// @param symbol NFT collection symbol
    /// @param venue Event venue
    /// @param eventDate Unix timestamp of event date
    /// @param ticketPrice Price per ticket in wei
    /// @param maxSupply Maximum number of tickets
    /// @param maxTicketsPerWallet Max tickets a single wallet can purchase (0 = unlimited)
    /// @param maxResalePercent Max resale price percentage (e.g., 110 = 110%)
    /// @param baseURI Base URI for ticket metadata
    /// @param royaltyPercent Royalty in basis points (e.g., 500 = 5%)
    /// @param royaltyRecipients Array of royalty recipient addresses (empty = organizer gets all)
    /// @param royaltyShares Array of shares in basis points per recipient (must total 10000)
    /// @return eventAddress Address of the deployed EventTicket contract
    function createEventAdvanced(
        string memory name,
        string memory symbol,
        string memory venue,
        uint256 eventDate,
        uint256 ticketPrice,
        uint256 maxSupply,
        uint256 maxTicketsPerWallet,
        uint256 maxResalePercent,
        string memory baseURI,
        uint96 royaltyPercent,
        address[] calldata royaltyRecipients,
        uint256[] calldata royaltyShares
    ) external returns (address eventAddress) {
        if (royaltyPercent > 1000) revert InvalidRoyaltyPercent();
        if (maxResalePercent < 100) revert InvalidMaxResalePercent();

        return
            _createEvent(
                name,
                symbol,
                venue,
                eventDate,
                ticketPrice,
                maxSupply,
                maxTicketsPerWallet,
                maxResalePercent,
                baseURI,
                royaltyPercent,
                royaltyRecipients,
                royaltyShares
            );
    }

    /// @dev Internal function to deploy EventTicket contract and optional RoyaltySplitter clone
    function _createEvent(
        string memory name,
        string memory symbol,
        string memory venue,
        uint256 eventDate,
        uint256 ticketPrice,
        uint256 maxSupply,
        uint256 maxTicketsPerWallet,
        uint256 maxResalePercent,
        string memory baseURI,
        uint96 royaltyPercent,
        address[] memory royaltyRecipients,
        uint256[] memory royaltyShares
    ) internal returns (address eventAddress) {
        if (eventDate <= block.timestamp) revert InvalidEventDate();
        if (ticketPrice == 0) revert InvalidTicketPrice();
        if (maxSupply == 0) revert InvalidMaxSupply();

        // Determine royalty receiver: organizer directly, or a splitter clone
        address royaltyReceiver = msg.sender;

        if (royaltyRecipients.length > 0) {
            // Deploy a minimal proxy clone of RoyaltySplitter
            address splitterClone = Clones.clone(splitterImplementation);

            // Initialize the clone with recipients and shares
            RoyaltySplitter(payable(splitterClone)).initialize(
                address(0), // eventContract set below after deployment
                msg.sender,
                royaltyRecipients,
                royaltyShares
            );

            royaltyReceiver = splitterClone;
        }

        // Deploy new EventTicket contract
        EventTicket newEvent = new EventTicket(
            name,
            symbol,
            venue,
            eventDate,
            ticketPrice,
            maxSupply,
            maxTicketsPerWallet,
            maxResalePercent,
            baseURI,
            msg.sender,
            royaltyReceiver,
            royaltyPercent
        );

        eventAddress = address(newEvent);
        eventCount++;

        // Store event info
        allEvents.push(eventAddress);
        eventsByOrganizer[msg.sender].push(eventAddress);
        isEventContract[eventAddress] = true;

        eventInfo[eventAddress] = EventInfo({
            id: eventCount,
            contractAddress: eventAddress,
            organizer: msg.sender,
            name: name,
            venue: venue,
            eventDate: eventDate,
            ticketPrice: ticketPrice,
            maxSupply: maxSupply,
            createdAt: block.timestamp
        });

        // Track splitter if one was created
        if (royaltyReceiver != msg.sender) {
            eventSplitter[eventAddress] = royaltyReceiver;
            emit SplitterCreated(eventAddress, royaltyReceiver);
        }

        // Register with platform Registry
        registry.setContractStatus(eventAddress, true);

        emit EventCreated(
            eventCount,
            eventAddress,
            msg.sender,
            name,
            eventDate,
            ticketPrice,
            maxSupply
        );
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get all event contract addresses
    /// @return Array of event contract addresses
    function getEvents() external view returns (address[] memory) {
        return allEvents;
    }

    /// @notice Get events by a specific organizer
    /// @param organizer Organizer address
    /// @return Array of event contract addresses
    function getEventsByOrganizer(
        address organizer
    ) external view returns (address[] memory) {
        return eventsByOrganizer[organizer];
    }

    /// @notice Get event info by contract address
    /// @param eventAddress Event contract address
    /// @return Event information struct
    function getEventInfo(
        address eventAddress
    ) external view returns (EventInfo memory) {
        if (!isEventContract[eventAddress]) revert EventNotFound();
        return eventInfo[eventAddress];
    }

    /// @notice Get paginated events
    /// @param offset Starting index
    /// @param limit Number of events to return
    /// @return events Array of event addresses
    /// @return total Total number of events
    function getEventsPaginated(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory events, uint256 total) {
        total = allEvents.length;

        if (offset >= total) {
            return (new address[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 length = end - offset;
        events = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            events[i] = allEvents[offset + i];
        }
    }

    /// @notice Get multiple event infos
    /// @param eventAddresses Array of event addresses
    /// @return infos Array of event info structs
    function getMultipleEventInfo(
        address[] calldata eventAddresses
    ) external view returns (EventInfo[] memory infos) {
        infos = new EventInfo[](eventAddresses.length);

        for (uint256 i = 0; i < eventAddresses.length; i++) {
            if (isEventContract[eventAddresses[i]]) {
                infos[i] = eventInfo[eventAddresses[i]];
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                          ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Update the Registry contract address
    /// @param newRegistry New Registry address
    function setRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert ZeroAddressNotAllowed();

        address oldRegistry = address(registry);
        registry = IRegistry(newRegistry);

        emit RegistryUpdated(oldRegistry, newRegistry);
    }

    /// @notice Update default royalty percentage
    /// @param newRoyaltyPercent New royalty in basis points
    function setDefaultRoyalty(uint96 newRoyaltyPercent) external onlyOwner {
        if (newRoyaltyPercent > 1000) revert InvalidRoyaltyPercent();

        defaultRoyaltyPercent = newRoyaltyPercent;

        emit DefaultRoyaltyUpdated(newRoyaltyPercent);
    }

    /// @notice Update default max resale percentage
    /// @param newMaxResalePercent New max resale percentage
    function setDefaultMaxResale(
        uint256 newMaxResalePercent
    ) external onlyOwner {
        if (newMaxResalePercent < 100) revert InvalidMaxResalePercent();

        defaultMaxResalePercent = newMaxResalePercent;

        emit DefaultMaxResaleUpdated(newMaxResalePercent);
    }
}

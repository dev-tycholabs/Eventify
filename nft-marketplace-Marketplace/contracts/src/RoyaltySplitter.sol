// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title RoyaltySplitter - Minimal clone-friendly royalty splitter
/// @notice Receives royalty payments and splits them among configured recipients
/// @dev Designed to be deployed as EIP-1167 minimal proxies (clones)
///      Each clone gets its own address so marketplace claimableFunds are naturally separated per-event.
///      Recipients and shares are set once via initialize() and are immutable after that.
contract RoyaltySplitter is ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                          STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    bool public initialized;
    address public eventContract;
    address public organizer;

    address[] public recipients;
    uint256[] public shares; // basis points per recipient, must total 10000

    uint256 public totalReleased;
    mapping(address => uint256) public released;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event PaymentDistributed(address indexed recipient, uint256 amount);
    event PaymentReceived(address indexed from, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error AlreadyInitialized();
    error NotInitialized();
    error InvalidRecipients();
    error SharesMustTotal10000();
    error ZeroAddressRecipient();
    error NoPaymentDue();
    error TransferFailed();

    /*//////////////////////////////////////////////////////////////
                          INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Initialize the splitter with recipients and shares
    /// @dev Can only be called once. Called by EventFactory right after cloning.
    /// @param _eventContract The EventTicket contract this splitter is for
    /// @param _organizer The event organizer address
    /// @param _recipients Array of recipient addresses
    /// @param _shares Array of share amounts in basis points (must total 10000)
    function initialize(
        address _eventContract,
        address _organizer,
        address[] memory _recipients,
        uint256[] memory _shares
    ) external {
        if (initialized) revert AlreadyInitialized();
        if (_recipients.length == 0 || _recipients.length != _shares.length)
            revert InvalidRecipients();

        uint256 totalShares;
        for (uint256 i = 0; i < _recipients.length; i++) {
            if (_recipients[i] == address(0)) revert ZeroAddressRecipient();
            totalShares += _shares[i];
        }
        if (totalShares != 10000) revert SharesMustTotal10000();

        initialized = true;
        eventContract = _eventContract;
        organizer = _organizer;
        recipients = _recipients;
        shares = _shares;
    }

    /*//////////////////////////////////////////////////////////////
                          RECEIVE ETH
    //////////////////////////////////////////////////////////////*/

    /// @notice Accept ETH payments (from marketplace claimFunds or direct transfers)
    receive() external payable {
        emit PaymentReceived(msg.sender, msg.value);
    }

    /*//////////////////////////////////////////////////////////////
                          DISTRIBUTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Distribute all available ETH to recipients based on their shares
    /// @dev Anyone can call this — trustless distribution
    function distribute() external nonReentrant {
        if (!initialized) revert NotInitialized();

        uint256 totalReceived = address(this).balance + totalReleased;

        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 totalDue = (totalReceived * shares[i]) / 10000;
            uint256 payment = totalDue - released[recipients[i]];

            if (payment > 0) {
                released[recipients[i]] += payment;
                totalReleased += payment;

                (bool success, ) = recipients[i].call{value: payment}("");
                if (!success) revert TransferFailed();

                emit PaymentDistributed(recipients[i], payment);
            }
        }
    }

    /// @notice Claim funds from a marketplace and then distribute
    /// @dev Calls claimFunds on the marketplace, which sends ETH here, then distributes
    /// @param marketplace The marketplace contract address to claim from
    /// @param currency The currency address to claim (use ETH address for native token)
    function claimAndDistribute(
        address marketplace,
        address currency
    ) external nonReentrant {
        if (!initialized) revert NotInitialized();

        // Call claimFunds on the marketplace — this sends ETH/tokens to this contract
        // Using low-level call since we don't want to import marketplace interface
        (bool claimSuccess, ) = marketplace.call(
            abi.encodeWithSignature("claimFunds(address)", currency)
        );
        // Don't revert if claim fails (might have nothing to claim) — just distribute what we have
        // The claimFunds will revert internally if nothing to claim, but we catch it

        if (claimSuccess) {
            // Now distribute the received funds
            uint256 totalReceived = address(this).balance + totalReleased;

            for (uint256 i = 0; i < recipients.length; i++) {
                uint256 totalDue = (totalReceived * shares[i]) / 10000;
                uint256 payment = totalDue - released[recipients[i]];

                if (payment > 0) {
                    released[recipients[i]] += payment;
                    totalReleased += payment;

                    (bool success, ) = recipients[i].call{value: payment}("");
                    if (!success) revert TransferFailed();

                    emit PaymentDistributed(recipients[i], payment);
                }
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the pending payment for a specific recipient
    /// @param account The recipient address to check
    /// @return The amount of ETH pending for this recipient
    function pendingPayment(address account) external view returns (uint256) {
        uint256 totalReceived = address(this).balance + totalReleased;

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == account) {
                uint256 totalDue = (totalReceived * shares[i]) / 10000;
                return totalDue - released[account];
            }
        }
        return 0;
    }

    /// @notice Get all recipients and their shares
    /// @return _recipients Array of recipient addresses
    /// @return _shares Array of shares in basis points
    function getRecipients()
        external
        view
        returns (address[] memory _recipients, uint256[] memory _shares)
    {
        return (recipients, shares);
    }

    /// @notice Get the number of recipients
    /// @return The count of recipients
    function recipientCount() external view returns (uint256) {
        return recipients.length;
    }
}

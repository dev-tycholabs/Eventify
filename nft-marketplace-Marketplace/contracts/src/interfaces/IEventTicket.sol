// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

/// @title IEventTicket - Interface for EventTicket price cap validation
/// @notice Used by Marketplace to enforce resale price caps
interface IEventTicket {
    /// @notice Get the maximum allowed resale price for a ticket
    /// @param tokenId The ticket token ID
    /// @return maxPrice Maximum resale price in wei
    function getMaxResalePrice(uint256 tokenId) external view returns (uint256 maxPrice);

    /// @notice Validate if a resale price is within allowed limits
    /// @param tokenId The ticket token ID
    /// @param resalePrice Proposed resale price
    /// @return valid Whether the price is valid
    function validateResalePrice(uint256 tokenId, uint256 resalePrice) external view returns (bool valid);

    /// @notice Check if a ticket has been used
    /// @param tokenId The ticket token ID
    /// @return Whether the ticket has been used
    function ticketUsed(uint256 tokenId) external view returns (bool);
}

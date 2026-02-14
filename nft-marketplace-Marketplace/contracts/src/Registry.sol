// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Registry - Platform governance for approved contracts and currencies
/// @notice Manages whitelisted contracts, currencies, and platform fees
/// @dev Required by Marketplace.sol for platform operations
contract Registry is Ownable {
    /*//////////////////////////////////////////////////////////////
                          STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    address public systemWallet;
    uint256 public feeNumerator;
    uint256 public feeScale;
    bool public allCurrenciesApproved;

    /*//////////////////////////////////////////////////////////////
                               MAPPINGS
    //////////////////////////////////////////////////////////////*/

    mapping(address => bool) public platformContracts;
    mapping(address => bool) public approvedCurrencies;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event SystemWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event FeeVariablesUpdated(uint256 newFee, uint256 newScale);
    event ContractStatusUpdated(address indexed contractAddress, bool status);
    event CurrencyStatusUpdated(address indexed tokenAddress, bool status);
    event AllCurrenciesApproved();

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddressNotAllowed();
    error InvalidFeeConfiguration();
    error AlreadyApprovedAllCurrencies();

    /*//////////////////////////////////////////////////////////////
                          CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param _systemWallet Address to receive platform fees
    /// @param _feeNumerator Fee percentage numerator (e.g., 250 for 2.5%)
    /// @param _feeScale Fee percentage scale (e.g., 10000 for basis points)
    constructor(
        address _systemWallet,
        uint256 _feeNumerator,
        uint256 _feeScale
    ) {
        if (_systemWallet == address(0)) revert ZeroAddressNotAllowed();
        if (_feeScale == 0 || _feeNumerator > _feeScale) revert InvalidFeeConfiguration();

        systemWallet = _systemWallet;
        feeNumerator = _feeNumerator;
        feeScale = _feeScale;

        // Approve ETH by default
        address ETH = address(0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa);
        approvedCurrencies[ETH] = true;
        emit CurrencyStatusUpdated(ETH, true);
    }

    /*//////////////////////////////////////////////////////////////
                          EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns fee info for a given sale price
    /// @param _salePrice The total sale amount
    /// @return systemWallet address and fee amount
    function feeInfo(uint256 _salePrice) external view returns (address, uint256) {
        uint256 fee = (_salePrice * feeNumerator) / feeScale;
        return (systemWallet, fee);
    }

    /// @notice Sets the platform wallet address
    /// @param newWallet New wallet address for fees
    function setSystemWallet(address newWallet) external onlyOwner {
        if (newWallet == address(0)) revert ZeroAddressNotAllowed();
        
        address oldWallet = systemWallet;
        systemWallet = newWallet;
        
        emit SystemWalletUpdated(oldWallet, newWallet);
    }

    /// @notice Sets fee configuration
    /// @param newFee New fee numerator
    /// @param newScale New fee scale
    function setFeeVariables(uint256 newFee, uint256 newScale) external onlyOwner {
        if (newScale == 0 || newFee > newScale) revert InvalidFeeConfiguration();
        
        feeNumerator = newFee;
        feeScale = newScale;
        
        emit FeeVariablesUpdated(newFee, newScale);
    }

    /// @notice Approves or revokes a contract
    /// @param toChange Contract address to update
    /// @param status Approval status
    function setContractStatus(address toChange, bool status) external onlyOwner {
        if (toChange == address(0)) revert ZeroAddressNotAllowed();
        
        platformContracts[toChange] = status;
        
        emit ContractStatusUpdated(toChange, status);
    }

    /// @notice Approves or revokes a currency
    /// @param tokenContract Token address to update
    /// @param status Approval status
    function setCurrencyStatus(address tokenContract, bool status) external onlyOwner {
        approvedCurrencies[tokenContract] = status;
        
        emit CurrencyStatusUpdated(tokenContract, status);
    }

    /// @notice Approves all currencies permanently
    /// @dev Irreversible operation
    function approveAllCurrencies() external onlyOwner {
        if (allCurrenciesApproved) revert AlreadyApprovedAllCurrencies();
        
        allCurrenciesApproved = true;
        
        emit AllCurrenciesApproved();
    }

    /// @notice Override to check if all currencies are approved
    function checkCurrencyApproved(address tokenContract) external view returns (bool) {
        return allCurrenciesApproved || approvedCurrencies[tokenContract];
    }
}

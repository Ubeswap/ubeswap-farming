// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "./INonTransferrableToken.sol";

interface ITokenAllocator {
    // Views
    function totalSupply() external view returns (uint256);

    function balanceOf(address _account) external view returns (uint256);

    /**
     * Computes the pending reward
     */
    function earned(address _account) external view returns (uint256);

    function token() external view returns (address);

    // Mutative

    /**
     * Gets all rewards.
     * @return Amount of tokens redeemed
     */
    function getReward() external returns (uint256);

    // Events

    /**
     * Emitted when a beneficiary is added
     */
    event BeneficiaryAdded(address indexed beneficiary, uint256 shares);

    /**
     * Emitted when the beneficiaries are locked.
     */
    event BeneficiariesLocked();

    /**
     * Emitted when tokens are redeemed
     */
    event Redeemed(address indexed beneficiary, uint256 amount);
}

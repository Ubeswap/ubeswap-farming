// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "../openzeppelin-solidity/contracts/Ownable.sol";
import "../openzeppelin-solidity/contracts/SafeMath.sol";
import "../openzeppelin-solidity/contracts/SafeERC20.sol";
import "../openzeppelin-solidity/contracts/ReentrancyGuard.sol";

import "./NonTransferrableToken.sol";
import "../interfaces/ITokenAllocator.sol";

/**
 * A contract that lets its beneficiaries receive tokens proportional to
 * their predetermined, non-transferrable share.
 */
contract TokenAllocator is
    Ownable,
    ITokenAllocator,
    NonTransferrableToken,
    ReentrancyGuard
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /**
     * If true, the cap table cannot be altered
     */
    bool public isLocked;

    // Token allocated to beneficiaries.
    IERC20 private immutable _token;

    /**
     * Total number of tokens in the contract after the last redemption
     */
    uint256 public balanceAfterLastRedemption;

    /**
     * Total number of tokens this contract has ever received
     */
    uint256 public totalTokensReceived;

    /**
     * Value of `totalTokensReceived` at the last time this
     * beneficiary redeemed tokens. This is used to calculate
     * the marginal additional tokens that this user has.
     */
    mapping(address => uint256) public totalTokensReceivedAtLastRedemption;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address owner_,
        address token_
    ) NonTransferrableToken(name_, symbol_, decimals_) {
        transferOwnership(owner_);
        _token = IERC20(token_);
    }

    function token() external view override returns (address) {
        return address(_token);
    }

    function totalSupply()
        public
        view
        override(NonTransferrableToken, ITokenAllocator)
        returns (uint256)
    {
        return NonTransferrableToken.totalSupply();
    }

    function balanceOf(address _account)
        public
        view
        override(NonTransferrableToken, ITokenAllocator)
        returns (uint256)
    {
        return NonTransferrableToken.balanceOf(_account);
    }

    modifier notLocked {
        require(!isLocked, "TokenAllocator: beneficiaries are locked");
        _;
    }

    /**
     * Add a beneficiary to the splitter.
     */
    function addBeneficiary(address _address, uint256 _shares)
        external
        notLocked
        onlyOwner
    {
        require(_shares > 0, "TokenAllocator: shares must be greater than 0");
        require(
            balanceOf(_address) == 0,
            "TokenAllocator: beneficiary already added"
        );
        _setBalance(_address, _shares);
        emit BeneficiaryAdded(_address, _shares);
    }

    /**
     * Locks in the beneficiaries, preventing them from being modified in the future.
     */
    function lockBeneficiaries() external onlyOwner notLocked {
        require(totalSupply() > 0, "TokenAllocator: must have beneficiaries");
        isLocked = true;
        emit BeneficiariesLocked();
        renounceOwnership();
    }

    function earned(address _account)
        external
        view
        override
        returns (uint256 amount)
    {
        (amount, ) = _earned(_account);
    }

    /**
     * Computes the number of tokens that can be received
     * and the new `totalTokensReceived`.
     */
    function _earned(address _account)
        private
        view
        returns (uint256 amount, uint256 totalTokens)
    {
        require(isLocked, "TokenAllocator: beneficiaries must be locked");
        uint256 shares = balanceOf(_account);
        require(shares > 0, "TokenAllocator: not a beneficiary");

        // check if there are new tokens sent to the contract
        uint256 newBalance = _token.balanceOf(address(this));

        if (balanceAfterLastRedemption != newBalance) {
            // if so, update totalTokensReceived
            totalTokens = totalTokensReceived.add(newBalance).sub(
                balanceAfterLastRedemption
            );
        } else {
            totalTokens = totalTokensReceived;
        }

        // Check to see if we have tokens to redeem
        uint256 changeSinceLastRedemption =
            totalTokens.sub(totalTokensReceivedAtLastRedemption[_account]);
        if (changeSinceLastRedemption > 0) {
            // If so, transfer
            amount = changeSinceLastRedemption.mul(shares).div(totalSupply());
        }
    }

    /**
     * Redeem tokens if the sender is the beneficiary
     */
    function getReward() external override nonReentrant returns (uint256) {
        (uint256 amount, uint256 totalTokens) = _earned(msg.sender);
        if (amount == 0) {
            // Do nothing if there are no tokens to redeem
            return 0;
        }
        totalTokensReceived = totalTokens;

        // Transfer tokens
        _token.safeTransfer(msg.sender, amount);

        // Update beneficiary state
        balanceAfterLastRedemption = _token.balanceOf(address(this));
        totalTokensReceivedAtLastRedemption[msg.sender] = totalTokensReceived;
        emit Redeemed(msg.sender, amount);
        return amount;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "../../openzeppelin-solidity/contracts/SafeERC20.sol";
import "../../openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "../../interfaces/IReleaseSchedule.sol";

/**
 * Escrow to release tokens according to a schedule.
 */
contract ReleaseEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // When the release starts.
    uint256 public immutable startTime;

    // Reward token contract address
    IERC20 public immutable rewardToken;

    // Where the funds go to.
    address public immutable beneficiary;

    // Schedule for release of tokens.
    IReleaseSchedule public immutable schedule;

    // The number of weeks that have been withdrawn from the escrow.
    uint256 public numberOfWeeksWithdrawn;

    constructor(
        address beneficiary_,
        address rewardToken_,
        address schedule_,
        uint256 startTime_
    ) {
        beneficiary = beneficiary_;
        rewardToken = IERC20(rewardToken_);
        schedule = IReleaseSchedule(schedule_);
        require(
            // solhint-disable-next-line not-rely-on-time
            startTime_ > block.timestamp,
            "ReleaseEscrow: start time must be in the future"
        );
        startTime = startTime_;
    }

    /**
     * Exit function to collect all remaining tokens, in the case of rounding errors.
     */
    function collectDust() external started nonReentrant {
        require(
            numberOfWeeksWithdrawn >= schedule.totalPeriods(),
            "ReleaseEscrow: not all mining rewards have been withdrawn"
        );
        rewardToken.safeTransfer(
            beneficiary,
            rewardToken.balanceOf(address(this))
        );
    }

    /**
     * Returns true if release has already started.
     */
    function hasStarted() public view returns (bool) {
        // solhint-disable-next-line not-rely-on-time
        return startTime < block.timestamp;
    }

    modifier started {
        require(hasStarted(), "ReleaseEscrow: release has not started yet");
        _;
    }

    /**
     * The current week in the release schedule. Starts from 0.
     */
    function currentWeekIndex() public view started returns (uint256) {
        // solhint-disable-next-line not-rely-on-time
        return (block.timestamp - startTime) / (1 weeks);
    }

    /**
     * Withdraws tokens based on the weeks elapsed.
     * `_latestWeek` can be specified so execution is bounded.
     * Up to two weeks worth of tokens may be withdrawn ahead of time. This gives the protocol time
     * to move tokens into the right places in the preceding week.
     * @param _latestWeek The week to withdraw up to. I.e. if "1", this will withdraw the funds of week 0.
     */
    function withdraw(uint256 _latestWeek) external started nonReentrant {
        require(_latestWeek > 0, "ReleaseEscrow: week must be greater than 0");
        // Up to two weeks worth of tokens may be withdrawn in advance.
        // i.e. the current week and the next week.
        uint256 latestPossibleWeek = currentWeekIndex() + 2;
        require(
            _latestWeek <= latestPossibleWeek,
            "ReleaseEscrow: latest week is too late"
        );
        require(
            _latestWeek > numberOfWeeksWithdrawn,
            "ReleaseEscrow: those weeks have already been withdrawn"
        );
        uint256 totalTransfer;
        for (uint256 i = numberOfWeeksWithdrawn; i < _latestWeek; i++) {
            // Get tokens for the next week, so this is "i"
            // That is; If 1 week has been withdrawn already, we need to withdraw week 1 next.
            // Because that 1 week was week 0.
            totalTransfer += schedule.getTokensForPeriod(i);
        }
        rewardToken.safeTransfer(beneficiary, totalTransfer);
        numberOfWeeksWithdrawn = _latestWeek;
    }
}

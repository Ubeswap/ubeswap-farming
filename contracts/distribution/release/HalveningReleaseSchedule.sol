// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "../../interfaces/IReleaseSchedule.sol";

/**
 * A release schedule with a "halvening" event occuring every few periods.
 * At some point, there are no more halvenings.
 */
contract HalveningReleaseSchedule is IReleaseSchedule {
    // Tokens per week to distribute for a halvening cycle
    mapping(uint256 => uint256) public tokensPerPeriodForHalveningCycle;

    uint256 public immutable halveningCyclePeriods;

    /**
     * Total number of periods.
     */
    uint256 public immutable override totalPeriods;

    /**
     * @param firstPeriodDistribution_ Number of tokens to distribute in the first period.
     * @param halveningCyclePeriods_ Number of periods within each halvening cycle.
     * @param totalHalvenings_ Total number of halvenings until there are no more tokens to release.
     */
    constructor(
        uint256 firstPeriodDistribution_,
        uint256 halveningCyclePeriods_,
        uint256 totalHalvenings_
    ) {
        halveningCyclePeriods = halveningCyclePeriods_;
        totalPeriods = totalHalvenings_ * halveningCyclePeriods_;

        // compute period distribution schedule ahead of time.
        tokensPerPeriodForHalveningCycle[0] = firstPeriodDistribution_;
        for (uint256 i = 1; i < totalHalvenings_; i++) {
            tokensPerPeriodForHalveningCycle[i] =
                tokensPerPeriodForHalveningCycle[i - 1] /
                2;
        }
    }

    /**
     * Gets the tokens scheduled to be distributed for a specific period.
     */
    function getTokensForPeriod(uint256 _periodIndex)
        external
        view
        override
        returns (uint256)
    {
        uint256 cycle = _periodIndex / halveningCyclePeriods;
        return tokensPerPeriodForHalveningCycle[cycle];
    }
}

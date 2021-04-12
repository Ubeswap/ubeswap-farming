// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

/**
 * A token release schedule defined by discrete periods.
 */
interface IReleaseSchedule {
    /**
     * Total number of periods until there are no more tokens.
     */
    function totalPeriods() external view returns (uint256);

    /**
     * Gets the tokens scheduled to be released for a period.
     */
    function getTokensForPeriod(uint256 _periodIndex)
        external
        view
        returns (uint256);
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

// Fetches the start time from LinearReleaseToken.
interface IStartTime {
    function startTime() external view returns (uint256);
}

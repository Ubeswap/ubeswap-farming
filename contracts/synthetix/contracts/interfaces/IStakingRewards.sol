// SPDX-License-Identifier: MIT

pragma solidity >=0.4.24;

interface IStakingRewards {
    // Views
    function lastTimeRewardApplicable() external view returns (uint256);

    function rewardPerToken() external view returns (uint256);

    function earned(address account) external view returns (uint256);

    function getRewardForDuration() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account, uint256 tokenClass) external view returns (uint256);

    // Mutative

    function stake(uint256 amount, uint256 tokenClass) external;

    function withdraw(uint256 amount, uint256 tokenClass) external;

    function getReward() external;

    function exit() external;
}

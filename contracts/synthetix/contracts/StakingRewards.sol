// SPDX-License-Identifier: MIT
// solhint-disable not-rely-on-time

pragma solidity ^0.8.3;

import "../../openzeppelin-solidity/contracts/Math.sol";
import "../../openzeppelin-solidity/contracts/SafeMath.sol";
import "../../openzeppelin-solidity/contracts/ReentrancyGuard.sol";

// Inheritance
import "./interfaces/IStakingRewards.sol";
import "./RewardsDistributionRecipient.sol";

//Interfaces
import "./interfaces/IERC20.sol";
import "./interfaces/ISellable.sol";

contract StakingRewards is IStakingRewards, RewardsDistributionRecipient, ReentrancyGuard {
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    IERC20 public rewardsToken;
    ISellable public stakingToken;
    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration = 7 days;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 public override totalSupply;
    uint256 private _weightedTotalSupply;
    mapping(address => uint256[4]) private _balances;
    mapping(address => uint256) private _weightedBalance;

    //Weights per token class
    uint256[4] public WEIGHTS = [65, 20, 10, 5];

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _owner,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken
    ) Owned(_owner) {
        rewardsToken = IERC20(_rewardsToken);
        stakingToken = ISellable(_stakingToken);
        rewardsDistribution = _rewardsDistribution;
    }

    /* ========== VIEWS ========== */

    function balanceOf(address account, uint256 tokenClass) external view override returns (uint256) {
        require(tokenClass > 0 && tokenClass < 5, "Token class must be between 1 and 4");

        return _balances[account][tokenClass - 1];
    }

    function lastTimeRewardApplicable() public view override returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view override returns (uint256) {
        if (_weightedTotalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(_weightedTotalSupply)
            );
    }

    function earned(address account) public view override returns (uint256) {
        return _weightedBalance[account].mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e18).add(rewards[account]);
    }

    function getRewardForDuration() external view override returns (uint256) {
        return rewardRate.mul(rewardsDuration);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 amount, uint256 tokenClass) external override nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        require(tokenClass > 0 && tokenClass < 5, "Token class must be between 1 and 4");
        require(stakingToken.balanceOf(msg.sender, tokenClass) >= amount, "Not enough tokens");

        uint256 weightedAmount = amount.mul(WEIGHTS[tokenClass - 1]);
        totalSupply = totalSupply.add(amount);
        _weightedTotalSupply = _weightedTotalSupply.add(weightedAmount);
        _weightedBalance[msg.sender] = _weightedBalance[msg.sender].add(weightedAmount);
        _balances[msg.sender][tokenClass - 1] = _balances[msg.sender][tokenClass - 1].add(amount);

        bool result = stakingToken.transfer(msg.sender, address(this), tokenClass, amount);

        require(result, "Transfer failed");

        emit Staked(msg.sender, tokenClass, amount);
    }

    function withdraw(uint256 amount, uint256 tokenClass) public override nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        require(tokenClass > 0 && tokenClass < 5, "Token class must be between 1 and 4");

        uint256 weightedAmount = amount.mul(WEIGHTS[tokenClass - 1]);
        totalSupply = totalSupply.sub(amount);
        _weightedTotalSupply = _weightedTotalSupply.sub(weightedAmount);
        _weightedBalance[msg.sender] = _weightedBalance[msg.sender].sub(weightedAmount);
        _balances[msg.sender][tokenClass - 1] = _balances[msg.sender][tokenClass - 1].sub(amount);

        bool result = stakingToken.transfer(address(this), msg.sender, tokenClass, amount);

        require(result, "Transfer failed");

        emit Withdrawn(msg.sender, tokenClass, amount);
    }

    function getReward() public override nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external override {
        for (uint i = 0; i < 4; i++)
        {
            if (_balances[msg.sender][i] > 0)
            {
                withdraw(_balances[msg.sender][i], i + 1);
            }
        }
        
        getReward();
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(uint256 reward) external override onlyRewardsDistribution updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(rewardsDuration);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = rewardsToken.balanceOf(address(this));
        require(rewardRate <= balance.div(rewardsDuration), "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(reward);
    }

    // End rewards emission earlier
    function updatePeriodFinish(uint timestamp) external onlyOwner updateReward(address(0)) {
        periodFinish = timestamp;
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(stakingToken), "Cannot withdraw the staking token");
        IERC20(tokenAddress).transfer(owner, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(
            block.timestamp > periodFinish,
            "Previous rewards period must be complete before changing the duration for the new period"
        );
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint tokenClass, uint256 amount);
    event Withdrawn(address indexed user, uint tokenClass, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);
}

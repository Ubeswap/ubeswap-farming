// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "../openzeppelin-solidity/contracts/Ownable.sol";
import "../synthetix/contracts/StakingRewards.sol";
import "../synthetix/contracts/interfaces/IERC20.sol";

import "../utils/Operator.sol";
import "../interfaces/ITokenAllocator.sol";
import "../interfaces/IReleaseSchedule.sol";

/**
 * Manages liquidity mining pools.
 * To set up (owner only):
 * 1. Set weights of the pools using `setWeight`.
 *
 * To distribute rewards (operator only):
 * Either: (recommended)
 *   2. Call `initializePeriod` for every pool part of the period.
 * Or: (if past the block gas limit)
 *   2. Start the next period with a specified number of reward tokens using `beginInitializePeriod`.
 *   3. Call `createOrRefreshPool` for every pool part of the period.
 *   4. Complete the period initialization using `commitInitializePeriod`.
 */
contract PoolManager is Operator, ReentrancyGuard {
    
    using SafeMath for uint256;

    struct PoolInfo {
        uint256 index;
        address stakingToken;
        address poolAddress;
        uint256 weight;
        // The next period in which the pool needs to be filled
        uint256 nextPeriod;
    }
    mapping(address => PoolInfo) public pools;
    uint256 public totalWeight;

    struct Period {
        uint256 index;
        uint256 amount;
        // If true, the period is not done being allocated.
        bool isInitializing;
        // Total amount of tokens allocated towards this period so far.
        uint256 totalWeightAllocated;
    }
    Period public currentPeriod;

    IERC20 public immutable rewardsToken;
    ITokenAllocator public immutable miningAllocator;
    IReleaseSchedule public immutable releaseSchedule;

    mapping(uint256 => address) public poolsByIndex;
    uint256 public poolsCount;
    uint256 public nextPeriod;

    constructor(
        address owner_,
        address operator_,
        address rewardsToken_,
        address miningAllocator_,
        address releaseSchedule_
    ) Operator(owner_, operator_) {
        rewardsToken = IERC20(rewardsToken_);
        miningAllocator = ITokenAllocator(miningAllocator_);
        releaseSchedule = IReleaseSchedule(releaseSchedule_);
    }

    // Emitted when a pool's weight is changed.
    event UpdatePoolWeight(
        address indexed stakingToken,
        uint256 indexed index,
        uint256 weight,
        bool indexed isNewPool
    );

    // Emitted when a new period begins.
    event PeriodInitialized(uint256 index, uint256 amount);

    // ---------
    // Timelocked methods
    // ---------

    /**
     * Sets the weight of a pool's rewards.
     * If the pool doesn't exist, it creates the staking pool contract
     * and adds it to the list of pools.
     */
    function setWeight(address _stakingToken, uint256 _weight)
        public
        onlyOwner
        notInitializingPeriod
    {
        PoolInfo storage pool = pools[_stakingToken];
        if (pool.stakingToken == address(0)) {
            // create pool
            address poolAddress =
                address(
                    new StakingRewards(
                        address(this),
                        address(this),
                        address(rewardsToken),
                        _stakingToken
                    )
                );
            pools[_stakingToken] = PoolInfo({
                index: poolsCount,
                stakingToken: _stakingToken,
                poolAddress: poolAddress,
                weight: _weight,
                nextPeriod: nextPeriod
            });
            poolsByIndex[poolsCount++] = _stakingToken;
            totalWeight = totalWeight.add(_weight);
            emit UpdatePoolWeight(
                _stakingToken,
                pools[_stakingToken].index,
                _weight,
                true
            );
        } else {
            totalWeight = totalWeight.sub(pool.weight).add(_weight);
            pool.weight = _weight;
            emit UpdatePoolWeight(_stakingToken, pool.index, _weight, false);
        }
    }

    /**
     * Sets the weight of multiple pools at the same time.
     */
    function batchSetWeight(
        address[] calldata _stakingTokens,
        uint256[] calldata _weights
    ) external {
        require(
            _stakingTokens.length == _weights.length,
            "PoolManager: arguments must be same length"
        );
        for (uint256 i = 0; i < _stakingTokens.length; i++) {
            setWeight(_stakingTokens[i], _weights[i]);
        }
    }

    // ---------
    // Non-timelocked methods
    // ---------

    /**
     * Starts the next period with the allocation.
     */
    function beginInitializePeriod() public onlyOperator notInitializingPeriod {
        // This check ensures we don't get tokens stuck in the contract.
        require(
            totalWeight > 0,
            "PoolManager: total weight must be greater than 0"
        );
        miningAllocator.getReward();
        uint256 amount = computeAmountForPeriod(nextPeriod);
        require(
            amount <= rewardsToken.balanceOf(address(this)),
            "PoolManager: not enough rewards. You may need to refresh the ReleaseEscrow."
        );
        currentPeriod = Period({
            index: nextPeriod,
            amount: amount,
            isInitializing: true,
            totalWeightAllocated: 0
        });
        nextPeriod = nextPeriod.add(1);
    }

    /**
     * Commits the next period, allowing the next wave of tokens to be distributed.
     */
    function commitInitializePeriod() public onlyOperator initializingPeriod {
        require(
            currentPeriod.totalWeightAllocated == totalWeight,
            "PoolManager: period allocation is incomplete"
        );
        currentPeriod.isInitializing = false;
        emit PeriodInitialized(currentPeriod.index, currentPeriod.amount);
    }

    /**
     * Computes the amount of rewards to be distributed for a given period.
     */
    function computeAmountForPeriod(uint256 _period)
        public
        view
        returns (uint256)
    {
        return
            releaseSchedule
                .getTokensForPeriod(_period)
                .mul(miningAllocator.balanceOf(address(this)))
                .div(miningAllocator.totalSupply());
    }

    /**
     * Computes the amount of tokens a pool is expected to earn for a given period.
     */
    function computeAmountForPool(address _stakingToken, uint256 _period)
        public
        view
        returns (uint256)
    {
        return computePoolShare(_stakingToken, computeAmountForPeriod(_period));
    }

    /**
     * Computes the amount of tokens a pool is expected to earn for a given total number of tokens.
     */
    function computePoolShare(address _stakingToken, uint256 _amount)
        public
        view
        returns (uint256)
    {
        return _amount.mul(pools[_stakingToken].weight).div(totalWeight);
    }

    /**
     * Updates a pool's rewards.
     */
    function refreshPool(address _stakingToken)
        public
        onlyOperator
        initializingPeriod
        nonReentrant
    {
        PoolInfo storage poolInfo = pools[_stakingToken];
        require(
            poolInfo.stakingToken != address(0),
            "PoolManager: pool does not exist"
        );
        require(
            poolInfo.nextPeriod <= currentPeriod.index,
            "PoolManager: period already refreshed"
        );
        require(poolInfo.weight != 0, "PoolManager: pool has zero weight");

        poolInfo.nextPeriod = nextPeriod;
        currentPeriod.totalWeightAllocated = currentPeriod
            .totalWeightAllocated
            .add(poolInfo.weight);
        uint256 amountToStake =
            computePoolShare(_stakingToken, currentPeriod.amount);

        // Approve for transfer
        rewardsToken.approve(poolInfo.poolAddress, amountToStake);

        // Deploy the tokens into the pool
        rewardsToken.transfer(poolInfo.poolAddress, amountToStake);
        RewardsDistributionRecipient(poolInfo.poolAddress).notifyRewardAmount(
            amountToStake
        );
    }

    /**
     * Initialize a period in one transaction.
     * This function may not work in one block if there are a lot of pools.
     */
    function initializePeriod(address[] calldata _stakingTokens) external {
        beginInitializePeriod();
        batchRefreshPools(_stakingTokens);
        commitInitializePeriod();
    }

    /**
     * Batch refreshes pools. Used in case we have tons of pools but are past the gas limit.
     */
    function batchRefreshPools(address[] memory _stakingTokens) public {
        require(
            _stakingTokens.length <= 20,
            "PoolManager: can only refresh 20 pools at a time"
        );
        for (uint256 i = 0; i < _stakingTokens.length; i++) {
            refreshPool(_stakingTokens[i]);
        }
    }

    modifier notInitializingPeriod {
        require(
            !currentPeriod.isInitializing,
            "PoolManager: current period is still initializing"
        );
        _;
    }

    modifier initializingPeriod {
        require(
            currentPeriod.isInitializing,
            "PoolManager: current period must be initializing"
        );
        _;
    }

    // ---------
    // Proxy methods for StakingRewards.sol
    // ---------

    function recoverERC20(
        address _pool,
        address _tokenAddress,
        uint256 _tokenAmount
    ) external onlyOperator {
        // Allow the operator to recover any ERC20 tokens stuck in the pool.
        StakingRewards(_pool).recoverERC20(_tokenAddress, _tokenAmount);
        IERC20(_tokenAddress).transfer(msg.sender, _tokenAmount);
    }
}

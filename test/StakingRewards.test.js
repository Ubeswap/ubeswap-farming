const { expect } = require("chai");
const { parseEther } = require("@ethersproject/units");
const { ethers } = require("hardhat");
const Web3 = require("web3");
const ContractKit = require('@celo/contractkit');
require("dotenv/config");

const web3 = new Web3('https://alfajores-forno.celo-testnet.org');
const kit = ContractKit.newKitFromWeb3(web3);

const STAKING_REWARDS_ABI = require('../build/abi/StakingRewards.json');
const NFT_POOL_ABI = require('../build/abi/NFTPool.json');

describe("StakingRewards", () => {
  let deployer;
  let otherUser;

  let poolManager;
  let poolManagerAddress;
  let PoolManagerFactory;

  let tokenAllocator;
  let tokenAllocatorAddress;
  let TokenAllocatorFactory;

  let releaseSchedule;
  let releaseScheduleAddress;
  let ReleaseScheduleFactory;

  let stakingRewards;
  let stakingRewardsAddress;
  let StakingRewardsFactory;

  let testToken;
  let testTokenAddress;
  let TestTokenFactory;

  let deployedNFTPool;
  const deployedNFTPoolAddress = "0x3e820DAAAE5A31DA7458cdd14696524C5F4b6AEF";

  before(async () => {
    const signers = await ethers.getSigners();

    deployer = signers[0];
    otherUser = signers[1];

    PoolManagerFactory = await ethers.getContractFactory('PoolManager');
    TokenAllocatorFactory = await ethers.getContractFactory('TokenAllocator');
    ReleaseScheduleFactory = await ethers.getContractFactory('HalveningReleaseSchedule');
    StakingRewardsFactory = await ethers.getContractFactory('StakingRewards');
    TestTokenFactory = await ethers.getContractFactory('TestToken');

    deployedNFTPool = await new ethers.Contract(deployedNFTPoolAddress, NFT_POOL_ABI, deployer);
  });

  beforeEach(async () => {
    testToken = await TestTokenFactory.deploy("Test token", "TEST");
    await testToken.deployed();
    testTokenAddress = testToken.address;

    tokenAllocator = await TokenAllocatorFactory.deploy("Token Allocator", "TOK", 0, deployer.address, testTokenAddress);
    await tokenAllocator.deployed();
    tokenAllocatorAddress = tokenAllocator.address;

    let tx = await testToken.transfer(tokenAllocatorAddress, parseEther("80000000"));
    await tx.wait();

    releaseSchedule = await ReleaseScheduleFactory.deploy(parseEther("10000"), 26, 12);
    await releaseSchedule.deployed();
    releaseScheduleAddress = releaseSchedule.address;

    poolManager = await PoolManagerFactory.deploy(deployer.address, deployer.address, testTokenAddress, tokenAllocatorAddress, releaseScheduleAddress);
    await poolManager.deployed();
    poolManagerAddress = poolManager.address;

    let tx2 = await tokenAllocator.addBeneficiary(poolManagerAddress, 1);
    await tx2.wait();

    let tx3 = await tokenAllocator.lockBeneficiaries();
    await tx3.wait();

    let tx4 = await poolManager.setWeight(deployedNFTPoolAddress, 1);
    await tx4.wait();

    let stakingRewardsInfo = await poolManager.pools(deployedNFTPoolAddress);
    stakingRewardsAddress = stakingRewardsInfo.poolAddress;

    stakingRewards = await new ethers.Contract(stakingRewardsAddress, STAKING_REWARDS_ABI, deployer);

    let tx5 = await poolManager.initializePeriod([deployedNFTPoolAddress]);
    await tx5.wait();

    console.log(stakingRewardsAddress);

    let tx6 = await deployedNFTPool.setFarmAddress(stakingRewardsAddress);
    await tx6.wait();
  });
  
  describe("#stake", () => {
    it('stake with no other investors', async () => {
      kit.connection.addAccount(process.env.PRIVATE_KEY1);
      kit.connection.addAccount(process.env.PRIVATE_KEY2);
      const stabletoken = await kit._web3Contracts.getStableToken();

      const txo = await stabletoken.methods.approve(deployedNFTPoolAddress, parseEther("2"))
      const tx0 = await kit.sendTransactionObject(txo, { from: deployer.address })
      const hash = await tx0.getHash()
      const receipt = await tx0.waitReceipt()

      const allowance = await stabletoken.methods.allowance(deployer.address, deployedNFTPoolAddress).call();
      console.log(allowance);

      let tx = await deployedNFTPool.deposit(1);
      await tx.wait();

      console.log(1);

      const balance = await deployedNFTPool.balance(deployer.address);
      console.log(balance);

      let tx1 = await stakingRewards.stake(1, 1);
      await tx1.wait();

      const balanceC1 = await stakingRewards.balanceOf(deployer.address, 1);
      expect(balanceC1).to.equal(1);

      const balanceC2 = await stakingRewards.balanceOf(deployer.address, 2);
      expect(balanceC2).to.equal(0);

      const balanceC3 = await stakingRewards.balanceOf(deployer.address, 3);
      expect(balanceC3).to.equal(0);

      const balanceC4 = await stakingRewards.balanceOf(deployer.address, 4);
      expect(balanceC4).to.equal(0);

      const totalSupply = await stakingRewards.totalSupply();
      expect(totalSupply).to.equal(1);
    });

    it('attempt to stake without tokens in class', async () => {
        kit.connection.addAccount(process.env.PRIVATE_KEY1);
        kit.connection.addAccount(process.env.PRIVATE_KEY2);
        const stabletoken = await kit._web3Contracts.getStableToken();

        const txo = await stabletoken.methods.approve(deployedNFTPoolAddress, parseEther("2"))
        const tx0 = await kit.sendTransactionObject(txo, { from: deployer.address })
        const hash = await tx0.getHash()
        const receipt = await tx0.waitReceipt()

        const allowance = await stabletoken.methods.allowance(deployer.address, deployedNFTPoolAddress).call();
        console.log(allowance);

        let tx = await deployedNFTPool.deposit(1);
        await tx.wait();

        console.log("deposit");

        const balance1 = await deployedNFTPool.balanceOf(deployer.address, 1);
        console.log(balance1);

        const balance2 = await deployedNFTPool.balanceOf(deployer.address, 2);
        console.log(balance2);

        const balance3 = await deployedNFTPool.balanceOf(deployer.address, 3);
        console.log(balance3);

        const balance4 = await deployedNFTPool.balanceOf(deployer.address, 4);
        console.log(balance4);

        const availableTokens = await deployedNFTPool.getAvailableTokensPerClass();
        console.log(availableTokens);
  
        let tx1 = await stakingRewards.stake(1, 2);
        await expect(tx1.wait()).to.be.reverted;

        console.log("reverted");
  
        const balanceC1 = await stakingRewards.balanceOf(deployer.address, 1);
        expect(balanceC1).to.equal(0);
  
        const balanceC2 = await stakingRewards.balanceOf(deployer.address, 2);
        expect(balanceC2).to.equal(0);
  
        const balanceC3 = await stakingRewards.balanceOf(deployer.address, 3);
        expect(balanceC3).to.equal(0);
  
        const balanceC4 = await stakingRewards.balanceOf(deployer.address, 4);
        expect(balanceC4).to.equal(0);
  
        const totalSupply = await stakingRewards.totalSupply();
        expect(totalSupply).to.equal(0);
    });
  });
  
  describe("withdraw", () => {
    it('withdraw partial position with no other investors', async () => {
        kit.connection.addAccount(process.env.PRIVATE_KEY1);
        kit.connection.addAccount(process.env.PRIVATE_KEY2);
        const stabletoken = await kit._web3Contracts.getStableToken();

        const txo = await stabletoken.methods.approve(deployedNFTPoolAddress, parseEther("3"))
        const tx0 = await kit.sendTransactionObject(txo, { from: deployer.address })
        const hash = await tx0.getHash()
        const receipt = await tx0.waitReceipt()

        let tx = await deployedNFTPool.deposit(2);
        await tx.wait();

        let tx1 = await stakingRewards.stake(2, 2);
        await tx1.wait();

        let tx2 = await stakingRewards.withdraw(1, 2);
        await tx2.wait();

        const balanceC1 = await stakingRewards.balanceOf(deployer.address, 1);
        expect(balanceC1).to.equal(0);

        const balanceC2 = await stakingRewards.balanceOf(deployer.address, 2);
        expect(balanceC2).to.equal(1);

        const balanceC3 = await stakingRewards.balanceOf(deployer.address, 3);
        expect(balanceC3).to.equal(0);

        const balanceC4 = await stakingRewards.balanceOf(deployer.address, 4);
        expect(balanceC4).to.equal(0);

        const totalSupply = await stakingRewards.totalSupply();
        expect(totalSupply).to.equal(1);
    });
    
    it('attempt to withdraw without tokens in class', async () => {
        kit.connection.addAccount(process.env.PRIVATE_KEY1);
        kit.connection.addAccount(process.env.PRIVATE_KEY2);
        const stabletoken = await kit._web3Contracts.getStableToken();

        const txo = await stabletoken.methods.approve(deployedNFTPoolAddress, parseEther("3"))
        const tx0 = await kit.sendTransactionObject(txo, { from: deployer.address })
        const hash = await tx0.getHash()
        const receipt = await tx0.waitReceipt()

        let tx = await deployedNFTPool.deposit(2);
        await tx.wait();
  
        let tx1 = await stakingRewards.stake(2, 2);
        await tx1.wait();

        let tx2 = await stakingRewards.withdraw(1, 4);
        await expect(tx2.wait()).to.be.reverted;
  
        const balanceC1 = await stakingRewards.balanceOf(deployer.address, 1);
        expect(balanceC1).to.equal(0);
  
        const balanceC2 = await stakingRewards.balanceOf(deployer.address, 2);
        expect(balanceC2).to.equal(2);
  
        const balanceC3 = await stakingRewards.balanceOf(deployer.address, 3);
        expect(balanceC3).to.equal(0);
  
        const balanceC4 = await stakingRewards.balanceOf(deployer.address, 4);
        expect(balanceC4).to.equal(0);
  
        const totalSupply = await stakingRewards.totalSupply();
        expect(totalSupply).to.equal(2);
    });
  });
  
  describe("#getReward", () => {
    it('get reward with no other investors', async () => {
        kit.connection.addAccount(process.env.PRIVATE_KEY1);
        kit.connection.addAccount(process.env.PRIVATE_KEY2);
        const stabletoken = await kit._web3Contracts.getStableToken();

        const txo = await stabletoken.methods.approve(deployedNFTPoolAddress, parseEther("3"))
        const tx0 = await kit.sendTransactionObject(txo, { from: deployer.address })
        const hash = await tx0.getHash()
        const receipt = await tx0.waitReceipt()

        let tx = await deployedNFTPool.deposit(1);
        await tx.wait();

        let tx1 = await stakingRewards.stake(1, 2);
        await tx1.wait();

        //Wait 20 seconds
        console.log("waiting 20 seconds");
        let currentTimestamp = Math.floor(Date.now() / 1000);
        while (Math.floor(Date.now() / 1000) < currentTimestamp + 20)
        {}

        const earned = await stakingRewards.earned(deployer.address);
        console.log(earned);
        expect(earned).to.be.gt(0);

        let tx2 = await stakingRewards.getReward();
        expect(tx2).to.emit(stakingRewards, "RewardPaid");
        await tx2.wait();

        const reward = await stakingRewards.rewards(deployer.address);
        console.log(reward);
        expect(reward).to.equal(0);
    });
  });
});
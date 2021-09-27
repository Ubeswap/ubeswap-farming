const { ethers } = require("hardhat");
const { parseEther } = require("@ethersproject/units");

const TGEN = "0x58aaFAe9790163Db1899d9be3C145230D0430F3A";
const deployedNFTPoolAddress = "0x3e820DAAAE5A31DA7458cdd14696524C5F4b6AEF";

const TradegenERC20ABI = require('./build/abi/TradegenERC20');
const PoolManagerABI = require('./build/abi/PoolManager');
const ReleaseEscrowABI = require('./build/abi/ReleaseEscrow');

async function main() {
    const signers = await ethers.getSigners();
    deployer = signers[0];

    let TradegenERC20 = new ethers.Contract(TGEN, TradegenERC20ABI, deployer);
    
    let PoolManagerFactory = await ethers.getContractFactory('PoolManager');
    let TokenAllocatorFactory = await ethers.getContractFactory('TokenAllocator');
    let HalveningReleaseScheduleFactory = await ethers.getContractFactory('HalveningReleaseSchedule');
    let ReleaseEscrowFactory = await ethers.getContractFactory('ReleaseEscrow');

    let releaseSchedule = await HalveningReleaseScheduleFactory.deploy(parseEther("3000000"), 26, 6);
    await releaseSchedule.deployed();
    console.log("ReleaseSchedule: " + releaseSchedule.address);

    let tokenAllocator = await TokenAllocatorFactory.deploy("Tradegen Mining Token Allocator", "MTA", 18, deployer.address, TGEN);
    await tokenAllocator.deployed();
    console.log("TokenAllocator: " + tokenAllocator.address);

    let poolManager = await PoolManagerFactory.deploy(deployer.address, deployer.address, TGEN, tokenAllocator.address, releaseSchedule.address);
    await poolManager.deployed();
    console.log("PoolManager: " + poolManager.address);

    let tx = await tokenAllocator.addBeneficiary(poolManager.address, parseEther("153562500"));
    await tx.wait();

    console.log("tx");

    let tx2 = await tokenAllocator.lockBeneficiaries();
    await tx2.wait();

    console.log("tx2");

    //8:10PM CST, September 26, 2021
    const timestamp = 1632707807 + 120;

    let releaseEscrow = await ReleaseEscrowFactory.deploy(tokenAllocator.address, TGEN, releaseSchedule.address, timestamp);
    await releaseEscrow.deployed();
    console.log("ReleaseEscrow: " + releaseEscrow.address);

    let tx3 = await poolManager.setWeight(deployedNFTPoolAddress, 100);
    await tx3.wait();

    console.log("tx3");
    /*
    let tx4 = await releaseEscrow.withdraw(1);
    await tx4.wait();

    console.log("tx4");

    let tx5 = await poolManager.initializePeriod([deployedNFTPoolAddress]);
    await tx5.wait();*/
}

async function initialize() {
  const signers = await ethers.getSigners();
  deployer = signers[0];

  const releaseEscrowAddress = "0x98464Cc955aA0d59988f47c99d3507d19A1f02d0";
  const poolManagerAddress = "0xF7834aD83a32FA97A687E659b7C9120fd7bf710d";

  let ReleaseEscrow = new ethers.Contract(releaseEscrowAddress, ReleaseEscrowABI, deployer);
  let PoolManager = new ethers.Contract(poolManagerAddress, PoolManagerABI, deployer);
  let TradegenERC20 = new ethers.Contract(TGEN, TradegenERC20ABI, deployer);
  
  await TradegenERC20.approve(releaseEscrowAddress, parseEther("153562500"));
  await TradegenERC20.transfer(releaseEscrowAddress, parseEther("153562500"));

  let balance = await TradegenERC20.balanceOf(releaseEscrowAddress);
  console.log(balance);

  let tx4 = await ReleaseEscrow.withdraw(1);
  await tx4.wait();

  console.log("tx4");

  let tx5 = await PoolManager.initializePeriod([deployedNFTPoolAddress]);
  await tx5.wait();
}
/*
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })*/

initialize()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
})
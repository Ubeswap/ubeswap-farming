import { parseEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { doTx } from "@ubeswap/hardhat-celo";
import { increaseTime } from "@ubeswap/hardhat-celo/lib/testing";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { getAddress } from "ethers/lib/utils";
import hre from "hardhat";
import {
  HalveningReleaseSchedule__factory,
  PoolManager,
  PoolManager__factory,
  StakingRewards__factory,
  TestToken,
  TestToken__factory,
  TokenAllocator__factory,
} from "../build/types/";

const randAddr = () => {
  const randNumber = Math.floor(Math.random() * 0xffffffff).toString(16);
  return `0xdc28d9d983e60a998dcedaa3b1b7ebb7${randNumber}${Array(
    8 - randNumber.length
  )
    .fill("0")
    .join("")}`;
};

describe("PoolManager", () => {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;

  let ube: TestToken;
  let tok1: TestToken;
  let tok2: TestToken;

  let poolManager: PoolManager;

  let ownerPM: PoolManager;
  let operatorPM: PoolManager;

  before(async () => {
    const signers = await hre.ethers.getSigners();

    deployer = signers[0]!;
    owner = signers[1]!;
    operator = signers[2]!;
  });

  beforeEach(async () => {
    // deploy manager
    const tokenFactory = new TestToken__factory(deployer);
    ube = await tokenFactory.deploy("Ubeswap", "UBE");
    tok1 = await tokenFactory.deploy("Token 1", "TOK2");
    tok2 = await tokenFactory.deploy("Token 2", "TOK2");

    const miningAllocator = await new TokenAllocator__factory(deployer).deploy(
      "Mining Allocator",
      "MIN",
      0,
      deployer.address,
      ube.address
    );
    await ube.transfer(miningAllocator.address, parseEther("80000000"));

    const releaseSchedule = await new HalveningReleaseSchedule__factory(
      deployer
    ).deploy(parseEther("10000"), 26, 12);

    poolManager = await new PoolManager__factory(deployer).deploy(
      owner.address,
      operator.address,
      ube.address,
      miningAllocator.address,
      releaseSchedule.address
    );

    await miningAllocator.addBeneficiary(poolManager.address, 1);
    await miningAllocator.lockBeneficiaries();

    ownerPM = PoolManager__factory.connect(poolManager.address, owner);
    operatorPM = PoolManager__factory.connect(poolManager.address, operator);
  });

  describe("#setWeight", () => {
    beforeEach(async () => {
      await tok1.approve(poolManager.address, parseEther("1000000000000"));
      await tok2.approve(poolManager.address, parseEther("1000000000000"));
    });

    it("onlyOwner", async () => {
      await expect(operatorPM.setWeight(tok1.address, 10)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("not initializing period", async () => {
      await ownerPM.setWeight(tok1.address, 1);
      await operatorPM.beginInitializePeriod();
      await expect(ownerPM.setWeight(tok1.address, 2)).to.be.revertedWith(
        "PoolManager: current period is still initializing"
      );
    });

    it("add multiple pools", async () => {
      await ownerPM.setWeight(tok1.address, 1);
      await ownerPM.setWeight(tok2.address, 3);

      expect((await ownerPM.pools(tok1.address)).weight).to.equal(1);
      expect((await ownerPM.pools(tok2.address)).weight).to.equal(3);
    });

    it("modify pools", async () => {
      await ownerPM.setWeight(tok1.address, 1);
      await ownerPM.setWeight(tok2.address, 3);

      expect((await ownerPM.pools(tok1.address)).weight).to.equal(1);
      expect((await ownerPM.pools(tok2.address)).weight).to.equal(3);
      expect(await ownerPM.totalWeight()).to.equal(4);

      const tok2Pool = await ownerPM.pools(tok2.address);

      await expect(ownerPM.setWeight(tok2.address, 2))
        .to.emit(ownerPM, "UpdatePoolWeight")
        .withArgs(getAddress(tok2.address), tok2Pool.index, 2, false);

      // new pool
      await expect(ownerPM.setWeight(ube.address, 4))
        .to.emit(ownerPM, "UpdatePoolWeight")
        .withArgs(getAddress(ube.address), 2, 4, true);
      expect(await ownerPM.totalWeight()).to.equal(7);
    });
  });

  describe("#batchRefreshPools", () => {
    it("can support 40 pools", async () => {
      const pools = Array(40)
        .fill(null)
        .map(
          () => [randAddr(), Math.floor(Math.random() * 10000 + 1)] as const
        );
      for (const [address, weight] of pools) {
        await ownerPM.setWeight(address, weight);
      }
      await operatorPM.beginInitializePeriod();
      const slices = Array(Math.floor(pools.length / 20))
        .fill(null)
        .map((_, i) => pools.slice(i * 20, i * 20 + 20));
      for (const slice of slices) {
        const result = await doTx(
          "refresh pools",
          operatorPM.batchRefreshPools(slice.map((s) => s[0]))
        );
        // 5 million gas limit
        expect(result.cumulativeGasUsed.lt(5000000)).to.be.true;
      }
      await operatorPM.commitInitializePeriod();
      expect(await operatorPM.poolsCount()).to.equal(40);
    });
  });

  describe("#initializePeriod", () => {
    it("can support 20 pools", async () => {
      const pools = Array(20)
        .fill(null)
        .map(() => [randAddr(), Math.floor(Math.random() * 100 + 2)] as const);
      for (const [address, weight] of pools) {
        await ownerPM.setWeight(address, weight);
      }
      const result = await doTx(
        "initialize period",
        operatorPM.initializePeriod(pools.map((p) => p[0]))
      );
      // 5 million gas limit
      expect(result.cumulativeGasUsed.lt(5000000)).to.be.true;
      expect(await operatorPM.poolsCount()).to.equal(20);

      // and batch reweight them
      expect(await ownerPM.totalWeight()).to.not.equal(20);
      await ownerPM.batchSetWeight(
        pools.map((p) => p[0]),
        pools.map(() => 1)
      );
      expect(await ownerPM.totalWeight()).to.equal(20);
    });

    it("cannot support more than 20 pools at once", async () => {
      const pools = Array(21)
        .fill(null)
        .map(() => [randAddr(), Math.floor(Math.random() * 100 + 2)] as const);
      for (const [address, weight] of pools) {
        await ownerPM.setWeight(address, weight);
      }

      await expect(
        operatorPM.initializePeriod(pools.map((p) => p[0]))
      ).to.be.revertedWith("PoolManager: can only refresh 20 pools at a time");
    });

    it("allow batch", async () => {
      const deployerAddr = await deployer.getAddress();

      expect((await poolManager.currentPeriod()).isInitializing).to.be.false;

      const amount = parseEther("10000");

      await ownerPM.setWeight(tok1.address, 1);
      await ownerPM.setWeight(tok2.address, 4);

      // set up staking
      const pool1 = await poolManager.pools(await poolManager.poolsByIndex(0));
      const pool2 = await poolManager.pools(await poolManager.poolsByIndex(1));
      const stake1 = StakingRewards__factory.connect(
        pool1.poolAddress,
        deployer
      );
      const stake2 = StakingRewards__factory.connect(
        pool2.poolAddress,
        deployer
      );
      await tok1.approve(stake1.address, amount);
      await stake1.stake(amount);
      await tok2.approve(stake2.address, amount);
      await stake2.stake(amount);

      // initialize the period
      expect((await poolManager.currentPeriod()).isInitializing).to.be.false;
      await doTx(
        "initialize period",
        operatorPM.initializePeriod([tok1.address, tok2.address])
      );
      expect((await poolManager.currentPeriod()).isInitializing).to.be.false;

      // post-epoch -- see how many staking rewards we have
      await increaseTime(
        24 * 7 * 60 * 60 + 1000 // 1 week in seconds
      );

      // check that the staking rewards are basically correct
      const EPSILON = BigNumber.from(10).pow(8);
      expect(
        parseEther("2000")
          .sub(await stake1.earned(deployerAddr))
          .abs()
          .lt(EPSILON)
      ).to.be.true;
      expect(
        parseEther("8000")
          .sub(await stake2.earned(deployerAddr))
          .abs()
          .lt(EPSILON)
      ).to.be.true;
    });
  });

  it("allow creating pools", async () => {
    const deployerAddr = await deployer.getAddress();

    expect((await poolManager.currentPeriod()).isInitializing).to.be.false;

    const amount = parseEther("10000");

    await ownerPM.setWeight(tok1.address, 1);
    await ownerPM.setWeight(tok2.address, 4);

    // set up staking
    const pool1 = await poolManager.pools(await poolManager.poolsByIndex(0));
    const pool2 = await poolManager.pools(await poolManager.poolsByIndex(1));
    const stake1 = StakingRewards__factory.connect(pool1.poolAddress, deployer);
    const stake2 = StakingRewards__factory.connect(pool2.poolAddress, deployer);
    await tok1.approve(stake1.address, amount);
    await stake1.stake(amount);
    await tok2.approve(stake2.address, amount);
    await stake2.stake(amount);

    // initialize the epoch
    await operatorPM.beginInitializePeriod();

    expect((await poolManager.currentPeriod()).isInitializing).to.be.true;

    await operatorPM.refreshPool(tok1.address);
    await operatorPM.refreshPool(tok2.address);

    await operatorPM.commitInitializePeriod();

    expect((await poolManager.currentPeriod()).isInitializing).to.be.false;

    // post-epoch -- see how many staking rewards we have
    await hre.network.provider.send("evm_increaseTime", [
      24 * 7 * 60 * 60 + 1000, // 1 week in seconds
    ]);
    await hre.network.provider.send("evm_mine");

    // check that the staking rewards are basically correct
    const EPSILON = BigNumber.from(10).pow(8);
    expect(
      parseEther("2000")
        .sub(await stake1.earned(deployerAddr))
        .abs()
        .lt(EPSILON)
    ).to.be.true;
    expect(
      parseEther("8000")
        .sub(await stake2.earned(deployerAddr))
        .abs()
        .lt(EPSILON)
    ).to.be.true;
  });
});

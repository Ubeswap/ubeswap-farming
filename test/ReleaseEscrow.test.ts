import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { doTx, makeCommonEnvironment } from "@ubeswap/hardhat-celo";
import { deployCreate2 } from "@ubeswap/solidity-create2-deployer";
import { expect } from "chai";
import { Signer } from "ethers";
import { getAddress, parseEther } from "ethers/lib/utils";
import hre from "hardhat";
import {
  ReleaseEscrow,
  IERC20,
  HalveningReleaseSchedule,
  TestToken__factory,
  ReleaseEscrow__factory,
  HalveningReleaseSchedule__factory,
} from "../build/types/";
import { allocFirstWeekDistribution, allocMined } from "../tasks/deploy/config";
import {
  getCurrentTime,
  increaseTime,
} from "@ubeswap/hardhat-celo/lib/testing";

describe("ReleaseEscrow", () => {
  let signer: Signer;
  let ube: IERC20;
  let schedule: HalveningReleaseSchedule;
  let escrow: ReleaseEscrow;
  let allocator: SignerWithAddress;

  beforeEach(async () => {
    const { signer: deployer } = await makeCommonEnvironment(hre);
    signer = deployer;

    // deploy manager
    const tokenFactory = new TestToken__factory(signer);
    ube = await tokenFactory.deploy("Ubeswap", "UBE");

    const [_, ec, beneficiary] = await hre.ethers.getSigners();

    // Deploy schedule
    const halveningReleaseSchedule = await deployCreate2({
      salt: `${Math.random()}`,
      factory: HalveningReleaseSchedule__factory,
      signer: deployer,
      args: [allocFirstWeekDistribution, 26, 12],
    });

    const ts = await getCurrentTime();

    // Deploy mining escrow
    const miningEscrow = await deployCreate2({
      salt: `${Math.random()}`,
      factory: ReleaseEscrow__factory,
      signer: deployer,
      args: [
        // beneficiary_
        beneficiary!.address,
        // rewardToken_
        ube.address,
        // schedule_
        halveningReleaseSchedule.address,
        // startTime_
        ts + 1800,
      ],
    });

    doTx(
      "Transfer UBE to escrow",
      ube.transfer(miningEscrow.address, allocMined)
    );

    schedule = halveningReleaseSchedule.contract;
    escrow = miningEscrow.contract;
    allocator = beneficiary!;
  });

  it("correct schedule", async () => {
    const cases = [
      [0, allocFirstWeekDistribution],
      [25, allocFirstWeekDistribution],
      [26, allocFirstWeekDistribution.div(2)],
      [51, allocFirstWeekDistribution.div(2)],
      [52, allocFirstWeekDistribution.div(4)],
      [26 * 12 - 1, allocFirstWeekDistribution.div(2 ** 11)],
      [26 * 12, parseEther("0")],
    ] as const;

    for (const [weekIndex, amount] of cases) {
      expect(
        await schedule.getTokensForPeriod(weekIndex),
        `Week ${weekIndex}`
      ).to.equal(amount);
    }
  });

  const startMining = async () => {
    await increaseTime(
      60 * 60 // 1 hour
    );
  };

  describe("#withdraw", () => {
    it("cannot withdraw before mining has started", async () => {
      await expect(escrow.withdraw(1)).to.revertedWith(
        "ReleaseEscrow: release has not started yet"
      );
    });

    it("cannot withdraw week 0", async () => {
      await startMining();
      expect(await escrow.currentWeekIndex()).to.equal(0);
      await expect(escrow.withdraw(0)).to.revertedWith(
        "ReleaseEscrow: week must be greater than 0"
      );
    });

    it("cannot withdraw week that has not been started", async () => {
      await startMining();
      expect(await escrow.currentWeekIndex()).to.equal(0);
      await expect(escrow.withdraw(10)).to.revertedWith(
        "ReleaseEscrow: latest week is too late"
      );
    });

    it("cannot withdraw same week multiple times", async () => {
      await startMining();
      expect(await escrow.currentWeekIndex()).to.equal(0);
      await expect(escrow.withdraw(2), "withdraw 2 weeks")
        .to.emit(ube, "Transfer")
        .withArgs(
          getAddress(escrow.address),
          getAddress(allocator.address),
          allocFirstWeekDistribution.mul(2)
        );
      await expect(
        escrow.withdraw(2),
        "cannot withdraw multiple times"
      ).to.be.revertedWith(
        "ReleaseEscrow: those weeks have already been withdrawn"
      );
      expect(await ube.balanceOf(allocator.address)).to.equal(
        allocFirstWeekDistribution.mul(2)
      );
    });

    it("can withdraw up to two weeks ahead of time", async () => {
      await startMining();
      expect(await escrow.currentWeekIndex()).to.equal(0);
      await expect(escrow.withdraw(2), "withdraw 2 weeks")
        .to.emit(ube, "Transfer")
        .withArgs(
          getAddress(escrow.address),
          getAddress(allocator.address),
          allocFirstWeekDistribution.mul(2)
        );
      expect(await ube.balanceOf(allocator.address)).to.equal(
        allocFirstWeekDistribution.mul(2)
      );
    });

    it("can withdraw multiple times", async () => {
      await startMining();
      await expect(await escrow.currentWeekIndex()).to.equal(0);
      await expect(escrow.withdraw(2), "withdraw 2 weeks")
        .to.emit(ube, "Transfer")
        .withArgs(
          getAddress(escrow.address),
          getAddress(allocator.address),
          allocFirstWeekDistribution.mul(2)
        );
      expect(await ube.balanceOf(allocator.address)).to.equal(
        allocFirstWeekDistribution.mul(2)
      );

      // fast forward 5 weeks
      await increaseTime(5 * 7 * 24 * 60 * 60);

      expect(await escrow.currentWeekIndex()).to.equal(5); // 6th week
      await expect(escrow.withdraw(4), "withdraw 2 more weeks")
        .to.emit(ube, "Transfer")
        .withArgs(
          getAddress(escrow.address),
          getAddress(allocator.address),
          allocFirstWeekDistribution.mul(2)
        );
      expect(await ube.balanceOf(allocator.address)).to.equal(
        allocFirstWeekDistribution.mul(4)
      );

      await expect(
        escrow.withdraw(7),
        "withdraw up to the latest week + 2 (start of 8th week, so 7)"
      )
        .to.emit(ube, "Transfer")
        .withArgs(
          getAddress(escrow.address),
          getAddress(allocator.address),
          allocFirstWeekDistribution.mul(3)
        );

      expect(await ube.balanceOf(allocator.address)).to.equal(
        allocFirstWeekDistribution.mul(7)
      );

      await expect(escrow.withdraw(8)).to.be.revertedWith(
        "ReleaseEscrow: latest week is too late"
      );

      expect(await ube.balanceOf(allocator.address)).to.equal(
        allocFirstWeekDistribution.mul(7)
      );
    });
  });
});

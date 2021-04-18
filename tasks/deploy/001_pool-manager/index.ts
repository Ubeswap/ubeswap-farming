import { DeployerFn, doTx } from "@ubeswap/hardhat-celo";
import { formatEther } from "ethers/lib/utils";
import {
  HalveningReleaseSchedule__factory,
  IStartTime__factory,
  PoolManager__factory,
  TokenAllocator__factory,
} from "../../../build/types";
import {
  allocCeloReserve,
  allocCGF,
  allocFirstWeekDistribution,
  allocLiquidityMining,
} from "../config";
import {
  ReleaseUbe,
  TimelockCeloReserve,
  TimelockCommunity,
  UbeToken,
} from "../governance.json";

interface IAddresses {
  PoolManager: string;
  HalveningReleaseSchedule: string;
  MiningTokenAllocator: string;
}

export const deployPoolManager: DeployerFn<IAddresses> = async ({
  deployCreate2,
  deployer,
  provider,
}) => {
  // Get start time from ReleaseUBE
  const startTime = (
    await IStartTime__factory.connect(ReleaseUbe, provider).startTime()
  ).toNumber();

  console.log(
    "Mining start time is",
    startTime,
    new Date(startTime * 1000).toLocaleString()
  );

  // Deploy schedule
  const halveningReleaseSchedule = await deployCreate2(
    "HalveningReleaseSchedule",
    {
      factory: HalveningReleaseSchedule__factory,
      signer: deployer,
      args: [allocFirstWeekDistribution, 26, 12],
    }
  );

  // Deploy mining allocator
  const miningTokenAllocator = await deployCreate2("MiningTokenAllocator", {
    factory: TokenAllocator__factory,
    signer: deployer,
    args: [
      "Ubeswap Mining Token Allocator",
      "MTA",
      18,
      // owner_
      await deployer.getAddress(),
      // token_
      UbeToken,
    ],
  });

  const poolManager = await deployCreate2("PoolManager", {
    factory: PoolManager__factory,
    signer: deployer,
    args: [
      // owner
      await deployer.getAddress(),
      // operator
      await deployer.getAddress(),
      // rewardToken
      UbeToken,
      // mining allocator
      miningTokenAllocator.address,
      // release schedule
      halveningReleaseSchedule.address,
    ],
  });

  const miningAllocatorContract = miningTokenAllocator.contract;
  await doTx(
    `Add liquidity mining fund as beneficiary for ${formatEther(
      allocLiquidityMining
    )} shares`,
    miningAllocatorContract.addBeneficiary(
      poolManager.address,
      allocLiquidityMining
    )
  );
  await doTx(
    `Add CGF as beneficiary for ${formatEther(allocCGF)} shares`,
    miningAllocatorContract.addBeneficiary(TimelockCommunity, allocCGF)
  );
  await doTx(
    `Add Celo Reserve as beneficiary for ${formatEther(
      allocCeloReserve
    )} shares`,
    miningAllocatorContract.addBeneficiary(
      TimelockCeloReserve,
      allocCeloReserve
    )
  );
  await doTx(
    `Lock mining allocator`,
    miningAllocatorContract.lockBeneficiaries()
  );

  return {
    PoolManager: poolManager.address,
    MiningTokenAllocator: miningTokenAllocator.address,
    HalveningReleaseSchedule: halveningReleaseSchedule.address,
  };
};

import { DeployerFn } from "@ubeswap/hardhat-celo";
import { DeployersMap } from "..";
import {
  IStartTime__factory,
  ReleaseEscrow__factory,
} from "../../../build/types";
import { ReleaseUbe, UbeToken } from "../governance.json";

interface IResult {
  MiningReleaseEscrow: string;
}

export const deployMiningEscrow: DeployerFn<IResult> = async ({
  deployCreate2,
  deployer,
  getAddresses,
  provider,
}) => {
  // Get start time from ReleaseUBE
  const startTime = (
    await IStartTime__factory.connect(ReleaseUbe, provider).startTime()
  ).toNumber();

  const addrs = getAddresses<DeployersMap, "pool-manager">("pool-manager");
  const { MiningTokenAllocator, HalveningReleaseSchedule } = addrs;

  // Deploy mining escrow
  const miningEscrow = await deployCreate2("MiningReleaseEscrow", {
    factory: ReleaseEscrow__factory,
    signer: deployer,
    args: [
      // beneficiary_
      MiningTokenAllocator,
      // rewardToken_
      UbeToken,
      // schedule_
      HalveningReleaseSchedule,
      // startTime_
      startTime,
    ],
  });

  return {
    MiningReleaseEscrow: miningEscrow.address,
  };
};

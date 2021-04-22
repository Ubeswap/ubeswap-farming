import { DeployerFn, doTx } from "@ubeswap/hardhat-celo";
import { DeployersMap } from "..";
import {
  PoolManager__factory,
  ReleaseEscrow__factory,
} from "../../../build/types";
import { OPERATOR } from "../config";
import { TimelockExecutive } from "../governance.json";

/**
 * This task should be run after rewards.
 */
export const startFarming: DeployerFn<{}> = async ({
  deployer,
  getAddresses,
}) => {
  const { PoolManager, MiningReleaseEscrow } = getAddresses<
    DeployersMap,
    "mining-escrow" | "pool-manager"
  >("mining-escrow", "pool-manager");

  const stakingTokens = [
    "0x8C89f7bB791d94E10EEd4Eb78D0E886C82D7A2e3",
    "0x59b22100751b7fda0c88201FB7a0eAf6fC30BCc7",
    "0xf5b1BC6C9c180b64F5711567b1d6a51A350f8422",
    "0x427c95a1379182121791cc415125acD73ea02e97",
    "0x27616d3DBa43f55279726c422daf644bc60128a8",
    "0x148C4ce0019a2e53f63DF50a6D9E9C09c5969629",
    "0x6626da55d43425A4EC1067b091Cf87a7EFBDAD6b",
    "0xa813Bb1DF70128d629F1A41830578fA616dAEeEc",
  ];

  const poolManager = PoolManager__factory.connect(PoolManager, deployer);

  await doTx(
    "Release mining rewards",
    ReleaseEscrow__factory.connect(MiningReleaseEscrow, deployer).withdraw(1)
  );
  await doTx("Initialize period", poolManager.initializePeriod(stakingTokens));

  await doTx(
    "Make the Operator the Operator",
    poolManager.setOperator(OPERATOR)
  );

  await doTx(
    "Hand off PoolManager ownership to the Executive Timelock",
    poolManager.transferOwnership(TimelockExecutive)
  );

  return {};
};

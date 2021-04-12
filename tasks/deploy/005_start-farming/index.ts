import { DeployerFn, doTx } from "@ubeswap/hardhat-celo";
import { DeployersMap } from "..";
import {
  PoolManager__factory,
  ReleaseEscrow__factory,
} from "../../../build/types/";
import { TimelockExecutiveCouncil } from "../governance.json";

/**
 * This task should be run after rewards.
 */
export const startFarming: DeployerFn<{}> = async ({
  deployer,
  getAddresses,
}) => {
  const { PoolManager, MiningReleaseEscrow, pairs } = getAddresses<
    DeployersMap,
    "distribution" | "pool-manager" | "create-pools"
  >("distribution", "pool-manager", "create-pools");

  const poolManager = PoolManager__factory.connect(PoolManager, deployer);

  await doTx(
    "Release mining rewards",
    ReleaseEscrow__factory.connect(MiningReleaseEscrow, deployer).withdraw(2)
  );
  await doTx(
    "Initialize period",
    poolManager.initializePeriod(pairs.map((pair) => pair.pairAddress))
  );

  await doTx(
    "Hand off PoolManager ownership to the Executive Council",
    poolManager.transferOwnership(TimelockExecutiveCouncil)
  );

  return {};
};

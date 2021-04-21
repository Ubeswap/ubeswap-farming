import { DeployerFn, doTx } from "@ubeswap/hardhat-celo";
import { DeployersMap } from "..";
import {
  PoolManager__factory,
  ReleaseEscrow__factory,
} from "../../../build/types";
import { loadPairs, OPERATOR } from "../config";
import { TimelockExecutive } from "../governance.json";

/**
 * This task should be run after rewards.
 */
export const startFarming: DeployerFn<{}> = async ({
  deployer,
  provider,
  getAddresses,
}) => {
  const { PoolManager, MiningReleaseEscrow } = getAddresses<
    DeployersMap,
    "mining-escrow" | "pool-manager"
  >("mining-escrow", "pool-manager");

  const pairs = await loadPairs(provider);
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
    "Make the Operator the Operator",
    poolManager.setOperator(OPERATOR)
  );

  await doTx(
    "Hand off PoolManager ownership to the Executive Timelock",
    poolManager.transferOwnership(TimelockExecutive)
  );

  return {};
};

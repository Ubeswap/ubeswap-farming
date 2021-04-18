import { DeployerFn, log } from "@ubeswap/hardhat-celo";
import { DeployersMap } from "..";
import { PoolManager__factory } from "../../../build/types";
import { loadPairs } from "../config";
import { createPools as doCreatePools } from "./createPools";

export const createPools: DeployerFn<{}> = async ({
  deployer,
  provider,
  getAddresses,
}) => {
  const { PoolManager } = getAddresses<DeployersMap, "pool-manager">(
    "pool-manager"
  );

  const pairs = await loadPairs(provider);
  console.log(
    "Pools to deploy:",
    JSON.stringify(
      pairs.map((pair) => ({
        pair: pair.name,
        address: pair.pairAddress,
        weight: pair.weight,
      })),
      null,
      2
    )
  );

  // Create the first few pools
  log("Creating pools");
  await doCreatePools({
    poolManagerAddress: PoolManager,
    deployer,
    pairs,
  });

  // get the pool addresses
  const poolAddressMap: Record<string, string> = {};
  for (const pair of pairs) {
    const { poolAddress } = await PoolManager__factory.connect(
      PoolManager as string,
      deployer
    ).pools(pair.pairAddress);
    poolAddressMap[`${pair.name}LPPool`] = poolAddress;
  }

  return {
    ...poolAddressMap,
  };
};

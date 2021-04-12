import { DeployerFn, ISupportedChain, log } from "@ubeswap/hardhat-celo";
import { DeployersMap } from "..";
import { PoolManager__factory } from "../../../build/types/";
import { UbeToken } from "../governance.json";
import { addInitialLiquidity, IPairInfo } from "./addInitialLiquidity";
import { createPools as doCreatePools } from "./createPools";

interface IResult {
  pairs: readonly Pick<IPairInfo, "name" | "pairAddress">[];
}

export const createPools: DeployerFn<IResult> = async ({
  deployer,
  provider,
  getAddresses,
}) => {
  const { PoolManager } = getAddresses<DeployersMap, "pool-manager">(
    "pool-manager"
  );
  // Deploy initial liquidity
  log("Adding initial liquidity...");
  const { pairs } = await addInitialLiquidity({
    chainId: (await deployer.getChainId()) as ISupportedChain,
    ubeTokenAddress: UbeToken,
    provider,
  });
  console.log(
    "Pairs to deploy:",
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
  let poolAddressMap: Record<string, string> = {};
  for (const pair of pairs) {
    const { poolAddress } = await PoolManager__factory.connect(
      PoolManager as string,
      deployer
    ).pools(pair.pairAddress);
    poolAddressMap[`${pair.name}LPPool`] = poolAddress;
  }

  return {
    ...poolAddressMap,
    pairs: pairs.map(({ name, pairAddress }) => ({ name, pairAddress })),
  };
};

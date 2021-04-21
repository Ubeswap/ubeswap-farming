import { doTx, log } from "@ubeswap/hardhat-celo";
import { ChainId, Pair, Token } from "@ubeswap/sdk";
import { ethers, Signer } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { IERC20, PoolManager__factory } from "../../build/types";
import { PoolManager } from "../../deployments/pool-manager.mainnet.addresses.json";
import { getTokenByName, ITokenName } from "./tokenAddresses";

export interface IPair {
  tokenA: ITokenName;
  tokenB: ITokenName;
}

export interface ILoadedPair {
  tokenA: { token: Token; contract: IERC20 };
  tokenB: { token: Token; contract: IERC20 };
  tokenAName: ITokenName;
  tokenBName: ITokenName;
  pairAddress: string;
  name: string;
}

export interface ILoadedPairWithWeight extends ILoadedPair {
  weight: number;
}

export const loadPair = async ({
  provider,
  pair,
}: {
  provider: ethers.providers.BaseProvider;
  pair: IPair;
}): Promise<ILoadedPair> => {
  const chainId = ((await provider.detectNetwork())
    .chainId as unknown) as ChainId;
  const tokenA = await getTokenByName(chainId, provider, pair.tokenA);
  const tokenB = await getTokenByName(chainId, provider, pair.tokenB);
  return {
    tokenA,
    tokenB,
    tokenAName: pair.tokenA,
    tokenBName: pair.tokenB,
    pairAddress: Pair.getAddress(tokenA.token, tokenB.token),
    name: `${pair.tokenA}-${pair.tokenB}`,
  };
};

/**
 * Updates weights of pools
 * TODO(igm): this should support the Timelock
 */
export const updatePoolWeights = async ({
  provider,
  deployer,
  pairWeights,
}: {
  provider: ethers.providers.BaseProvider;
  deployer: Signer;
  pairWeights: readonly (IPair & { weight: number })[];
}): Promise<Record<string, string>> => {
  const pairs = await Promise.all(
    pairWeights.map(async (pair) => {
      const p = await loadPair({ provider, pair });
      return { ...p, weight: pair.weight };
    })
  );
  log(
    "Pair weights to update:",
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
  const poolManager = PoolManager__factory.connect(PoolManager, deployer);
  await doTx(
    `Set weights`,
    poolManager.batchSetWeight(
      pairs.map((pair) => pair.pairAddress),
      pairs.map((pair) => pair.weight)
    )
  );

  log(`Total weight: ${(await poolManager.totalWeight()).toString()}`);
  for (const pair of pairs) {
    log(
      `Distribution for ${pair.name}: ${formatEther(
        await poolManager.computeAmountForPool(pair.pairAddress, 0)
      )} UBE`
    );
  }

  const poolAddressMap: Record<string, string> = {};
  for (const pair of pairs) {
    const { poolAddress } = await poolManager.pools(pair.pairAddress);
    poolAddressMap[`${pair.name}LPPool`] = poolAddress;
  }

  return {
    ...pairs.reduce(
      (acc, pair) => ({ ...acc, [`${pair.name}LP`]: pair.pairAddress }),
      {}
    ),
    ...poolAddressMap,
  };
};

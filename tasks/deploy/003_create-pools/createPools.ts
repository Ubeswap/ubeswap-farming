import { doTx, log } from "@ubeswap/hardhat-celo";
import { Signer } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { PoolManager__factory } from "../../../build/types";
import { ILaunchPair } from "../config";

export const createPools = async ({
  poolManagerAddress,
  deployer,
  pairs,
}: {
  poolManagerAddress: string;
  deployer: Signer;
  pairs: readonly ILaunchPair[];
}): Promise<void> => {
  const poolManager = PoolManager__factory.connect(
    poolManagerAddress,
    deployer
  );

  for (const pair of pairs) {
    await doTx(
      `Set weight for ${pair.name} to ${pair.weight}`,
      poolManager.setWeight(pair.pairAddress, pair.weight)
    );
  }

  log(`Total weight: ${(await poolManager.totalWeight()).toString()}`);

  for (const pair of pairs) {
    log(
      `Distribution for ${pair.name}: ${formatEther(
        await poolManager.computeAmountForPool(pair.pairAddress, 0)
      )} UBE`
    );
  }
};

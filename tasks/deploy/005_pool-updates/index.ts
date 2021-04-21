import { DeployerFn } from "@ubeswap/hardhat-celo";
import { updatePoolWeights } from "../../lib/updatePoolWeights";

export const updatePools0420: DeployerFn<{}> = async ({
  deployer,
  provider,
}) => {
  const pairs = await updatePoolWeights({
    deployer,
    provider,
    pairWeights: [
      {
        tokenA: "UBE",
        tokenB: "mcUSD",
        weight: 31,
      },
      {
        tokenA: "UBE",
        tokenB: "mcEUR",
        weight: 43,
      },
      {
        tokenA: "UBE",
        tokenB: "cMCO2",
        weight: 2,
      },
      {
        tokenA: "cUSD",
        tokenB: "cMCO2",
        weight: 1,
      },
      {
        tokenA: "CELO",
        tokenB: "sCELO",
        weight: 3,
      },
    ],
  });
  return {
    ...pairs,
  };
};

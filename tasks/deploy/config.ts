import { Web3Provider } from "@ethersproject/providers";
import { ChainId, Fetcher, Pair, Token } from "@ubeswap/sdk";
import { ethers } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ERC20__factory, IERC20, IERC20__factory } from "../../build/types";
import { tokenAddresses } from "../lib/tokenAddresses";
import { UbeToken } from "./governance.json";

/**
 * Initial operator address that controls all Timelocks.
 */
export const OPERATOR = "0x489AAc7Cb9A3B233e4a289Ec92284C8d83d49c6f";

// ----------------------------------------------------------------
// Allocation (all numbers are in tokens)
// ----------------------------------------------------------------
// Mined
const ALLOC_LIQUIDITY_MINING = 34000000;
const ALLOC_CGF = 30000000;
const ALLOC_CELO_RESERVE = 8000000;
const ALLOC_MINED = ALLOC_LIQUIDITY_MINING + ALLOC_CGF + ALLOC_CELO_RESERVE;

// First week distribution comes from:
// https://docs.google.com/spreadsheets/d/1-pOYidiOgABNh8mAr33gyToeoTB-W9ZuKqv88BnJ7OY/edit#gid=1182169671&range=B14
export const allocFirstWeekDistribution = parseEther("1384953.508");

// ----------------------------------------------------------------
// Initial pools and their weights
// ----------------------------------------------------------------

// initial liquidity is 100,000 UBE

export const weights = [
  // Two incentivized pools: UBE-mcUSD and UBE-mcEUR
  // Initial price of the tokens is $0.10.
  {
    tokenA: "UBE",
    tokenB: "mcEUR",
    weight: 48,

    initialLiquidityA: "50000",
    // EUR-USD is ~1.2
    initialLiquidityB: "6000",
  },
  {
    tokenA: "UBE",
    tokenB: "mcUSD",
    weight: 32,

    initialLiquidityA: "50000",
    initialLiquidityB: "5000",
  },
  // below pairs should already exist. no need to add liquidity
  {
    tokenA: "mcUSD",
    tokenB: "CELO",
    weight: 6,
  },
  {
    tokenA: "mcEUR",
    tokenB: "CELO",
    weight: 9,
  },
  {
    tokenA: "mcEUR",
    tokenB: "mcUSD",
    weight: 5,
  },
];

// ----------------------------------------------------------------
// Computed values
// ----------------------------------------------------------------

// Compute allocation
export const allocLiquidityMining = parseEther(
  ALLOC_LIQUIDITY_MINING.toString()
);
export const allocCGF = parseEther(ALLOC_CGF.toString());
export const allocCeloReserve = parseEther(ALLOC_CELO_RESERVE.toString());
export const allocMined = parseEther(ALLOC_MINED.toString());

const loadTokenData = async (
  address: string,
  provider: ethers.providers.BaseProvider
) => {
  const token = ERC20__factory.connect(address, provider);
  return {
    token: await Fetcher.fetchTokenData(
      ((await provider.detectNetwork()).chainId as unknown) as ChainId,
      address,
      provider,
      await token.symbol(),
      await token.name()
    ),
    contract: token,
  };
};

export interface ILoadedPair {
  tokenA: { token: Token; contract: IERC20 };
  tokenB: { token: Token; contract: IERC20 };
  tokenAName: string;
  tokenBName: string;
  pairAddress: string;
  weight: number;
  name: string;
  initialLiquidityA?: string;
  initialLiquidityB?: string;
}

export const loadPairs = async (
  provider: ethers.providers.BaseProvider
): Promise<readonly ILoadedPair[]> => {
  const chainId = ((await provider.detectNetwork())
    .chainId as unknown) as ChainId;
  if (chainId === ChainId.BAKLAVA) {
    throw new Error("invalid chain");
  }

  const getTokenByName = async (
    name: string
  ): Promise<{ token: Token; contract: IERC20 }> => {
    if (name === "UBE") {
      return await loadTokenData(UbeToken, provider);
    }
    const address = tokenAddresses[name]?.[chainId];
    if (!address) {
      throw new Error(`Could not find token: ${name}`);
    }
    return await loadTokenData(address, provider);
  };

  return Promise.all(
    weights.map(
      async ({
        tokenA: tokenAName,
        tokenB: tokenBName,
        weight,
        initialLiquidityA,
        initialLiquidityB,
      }) => {
        const tokenA = await getTokenByName(tokenAName);
        const tokenB = await getTokenByName(tokenBName);
        return {
          tokenA,
          tokenB,
          tokenAName,
          tokenBName,
          pairAddress: Pair.getAddress(tokenA.token, tokenB.token),
          weight,
          name: `${tokenAName}-${tokenBName}`,
          initialLiquidityA,
          initialLiquidityB,
        };
      }
    )
  );
};

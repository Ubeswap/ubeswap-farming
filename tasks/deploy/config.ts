import { parseEther } from "ethers/lib/utils";

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
  // Initial price of the tokens is $1.
  {
    tokenA: "UBE",
    tokenB: "mcEUR",
    weight: 12,

    initialLiquidityA: "50000",
    // EUR-USD is ~1.2
    initialLiquidityB: "600",
  },
  {
    tokenA: "UBE",
    tokenB: "mcUSD",
    weight: 10,

    initialLiquidityA: "50000",
    initialLiquidityB: "500",
  },
  // below pairs should already exist. no need to add liquidity
  {
    tokenA: "mcUSD",
    tokenB: "CELO",
    weight: 2,
  },
  {
    tokenA: "mcEUR",
    tokenB: "CELO",
    weight: 3,
  },
  {
    tokenA: "mcEUR",
    tokenB: "mcUSD",
    weight: 1,
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

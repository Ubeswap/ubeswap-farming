import { formatEther } from "@ethersproject/units";
import { doTx } from "@ubeswap/hardhat-celo";
import { Token } from "@ubeswap/sdk";
import { BigNumber } from "ethers";
import {
  ERC20,
  IERC20__factory,
  IUbeswapRouter__factory,
} from "../../../build/types";
import { IOperator } from "../../lib/ledger";
import { loadPairs } from "../config";

const UBESWAP_ROUTER_ADDRESS = "0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121";

interface IToken {
  token: Token;
  tokenContract: ERC20;
}

/**
 * Adds initial liquidity to pools if the liqudity does not exist.
 */
export const addInitialLiquidity = async ({
  operator,
}: {
  operator: IOperator;
}): Promise<Record<string, string>> => {
  // operator creates the pools here
  // three tokens: mcUSD, mcEUR, UBE
  console.log("Now creating initial pools. Keep your ledger ready!");
  const pairs = await loadPairs(operator.provider);
  const router = IUbeswapRouter__factory.connect(
    UBESWAP_ROUTER_ADDRESS,
    operator.signer
  );

  const ret: Record<string, string> = {};
  for (const {
    name,
    tokenA,
    tokenB,
    pairAddress,
    initialLiquidityA,
    initialLiquidityB,
  } of pairs) {
    ret[`${name}LP`] = pairAddress;
    if (!initialLiquidityA || !initialLiquidityB) {
      // only create pairs if we are supplying liquidity
      continue;
    }

    // check if there is liquidity
    const pair = IERC20__factory.connect(pairAddress, operator.provider);
    const totalSupply = await pair.totalSupply().catch(() => BigNumber.from(0));

    if (!totalSupply.isZero()) {
      console.warn("Non-zero supply found for pair " + name);
      // we can skip this pair
      continue;
    }

    console.log(`Pair for ${name} not found. Deploying liquidity...`);
    // Approve deposits
    await doTx(
      `Approve ${formatEther(initialLiquidityA)} ${tokenA}`,
      tokenA.contract
        .connect(operator.signer)
        .approve(router.address, initialLiquidityA)
    );
    await doTx(
      `Approve ${formatEther(initialLiquidityB)} ${tokenB.token.symbol}`,
      tokenB.contract
        .connect(operator.signer)
        .approve(router.address, initialLiquidityB)
    );

    // need to add initial liquidity if pool does not exist
    await doTx(
      `Deploy liquidity to ${name} (${pairAddress})`,
      router.addLiquidity(
        // tokenA
        tokenA.token.address,
        // tokenB
        tokenB.token.address,

        // We will set these prices manually whenever we deploy

        // amountADesired
        initialLiquidityA,
        // amountBDesired
        initialLiquidityB,
        // amountAMin
        0,
        // amountBMin
        0,
        // ultimate holder of the liquidity tokens (is the operator)
        operator.address,
        // deadline
        Math.floor(Date.now() / 1000 + 1800)
      )
    );
  }
  return ret;
};

import { formatEther } from "@ethersproject/units";
import { doTx, ISupportedChain } from "@ubeswap/hardhat-celo";
import { ChainId, Fetcher, Pair, Token } from "@ubeswap/sdk";
import { BigNumber, ethers, Signer } from "ethers";
import {
  IUbeswapRouter__factory,
  ERC20,
  IERC20__factory,
  ERC20__factory,
} from "../../../build/types/";
import { LedgerKit } from "../../lib/ledger";
import { tokenAddresses } from "../../lib/tokenAddresses";
import { weights } from "../config";

const UBESWAP_ROUTER_ADDRESS = "0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121";

interface IToken {
  token: Token;
  tokenContract: ERC20;
}

export interface IPairInfo {
  tokenA: IToken;
  tokenB: IToken;
  pairAddress: string;
  name: string;
  weight: number;
}

/**
 * Adds initial liquidity to pools if the liqudity does not exist.
 */
export const addInitialLiquidity = async ({
  chainId,
  ubeTokenAddress,
  provider,
}: {
  chainId: ISupportedChain;
  ubeTokenAddress: string;
  provider: ethers.providers.BaseProvider;
}): Promise<{
  pairs: readonly IPairInfo[];
}> => {
  // operator creates the pools here
  // three tokens: mcUSD, mcEUR, UBE
  const operator = await LedgerKit.initOperator();
  console.log("Now creating initial pools. Keep your ledger ready!");

  const tokenData = await Promise.all(
    Object.entries(tokenAddresses)
      .map(async ([key, tokInfo]) => {
        const address = tokInfo[chainId];
        if (!address) {
          return null;
        }

        const tokenContract = ERC20__factory.connect(
          address,
          operator.provider
        );

        return Fetcher.fetchTokenData(
          (chainId as unknown) as ChainId,
          address,
          provider,
          await tokenContract.symbol(),
          await tokenContract.name()
        ).then(
          (d) =>
            [
              key,
              {
                token: d,
                tokenContract,
              },
            ] as const
        );
      })
      .filter((x): x is Promise<[string, IToken]> => !!x)
  );

  const ubeContract = ERC20__factory.connect(
    ubeTokenAddress,
    operator.provider
  );
  const ubeTokenData = await Fetcher.fetchTokenData(
    (chainId as unknown) as ChainId,
    ubeTokenAddress,
    provider,
    await ubeContract.symbol(),
    await ubeContract.name()
  );
  console.log({ tokenData, ubeTokenData });

  const getTokenByName = (
    name: string
  ): { token: Token; tokenContract: ERC20 } => {
    if (name === "UBE") {
      return { token: ubeTokenData, tokenContract: ubeContract };
    }
    const result = tokenData.find((d) => d[0] === name);
    if (!result) {
      throw new Error(`Could not find token: ${name}`);
    }
    return result[1];
  };

  const pairs = weights.map(
    ({
      tokenA: tokenAName,
      tokenB: tokenBName,
      weight,
      initialLiquidityA,
      initialLiquidityB,
    }) => {
      const tokenA = getTokenByName(tokenAName);
      const tokenB = getTokenByName(tokenBName);
      const pairName = `${tokenA.token.symbol}-${tokenB.token.symbol}`;
      return {
        tokenA,
        tokenB,
        pairAddress: Pair.getAddress(tokenA.token, tokenB.token),
        weight,
        name: pairName,
        initialLiquidityA,
        initialLiquidityB,
      };
    }
  );

  const router = IUbeswapRouter__factory.connect(
    UBESWAP_ROUTER_ADDRESS,
    operator.signer
  );

  for (const {
    name,
    tokenA,
    tokenB,
    pairAddress,
    initialLiquidityA,
    initialLiquidityB,
  } of pairs) {
    if (!initialLiquidityA || !initialLiquidityB) {
      // only create pairs if we are supplying liquidity
      continue;
    }

    // check if there is liquidity
    const pair = IERC20__factory.connect(pairAddress, provider);
    const totalSupply = await pair.totalSupply().catch(() => BigNumber.from(0));

    if (!totalSupply.isZero()) {
      console.warn("Non-zero supply found for pair " + name);
      // we can skip this pair
      continue;
    }

    console.log(`Pair for ${name} not found. Deploying liquidity...`);
    // Approve deposits
    await doTx(
      `Approve ${formatEther(initialLiquidityA)} ${tokenA.token.symbol}`,
      tokenA.tokenContract.approve(router.address, initialLiquidityA)
    );
    await doTx(
      `Approve ${formatEther(initialLiquidityB)} ${tokenB.token.symbol}`,
      tokenB.tokenContract.approve(router.address, initialLiquidityB)
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

  return { pairs };
};

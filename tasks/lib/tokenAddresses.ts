import { CELO, ChainId, Fetcher, Token } from "@ubeswap/sdk";
import { ethers } from "ethers";
import { ERC20__factory, IERC20 } from "../../build/types";
import { UbeToken } from "../deploy/governance.json";

export const tokenAddresses = {
  // Addresses from: https://github.com/moolamarket/moola
  mcUSD: {
    [ChainId.ALFAJORES]: "0x71DB38719f9113A36e14F409bAD4F07B58b4730b",
    [ChainId.MAINNET]: "0x64dEFa3544c695db8c535D289d843a189aa26b98",
  },
  mcEUR: {
    [ChainId.ALFAJORES]: "0x32974C7335e649932b5766c5aE15595aFC269160",
    [ChainId.MAINNET]: "0xa8d0E6799FF3Fd19c6459bf02689aE09c4d78Ba7",
  },
  cEUR: {
    [ChainId.ALFAJORES]: "0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F",
    [ChainId.MAINNET]: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  },
  cUSD: {
    [ChainId.ALFAJORES]: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
    [ChainId.MAINNET]: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  },
  CELO: {
    [ChainId.ALFAJORES]: CELO[ChainId.ALFAJORES].address,
    [ChainId.MAINNET]: CELO[ChainId.MAINNET].address,
  },
  UBE: {
    [ChainId.ALFAJORES]: UbeToken,
    [ChainId.MAINNET]: UbeToken,
  },
  cMCO2: {
    [ChainId.ALFAJORES]: "0xe1Aef5200e6A38Ea69aD544c479bD1a176C8a510",
    [ChainId.MAINNET]: "0x32A9FE697a32135BFd313a6Ac28792DaE4D9979d",
  },
  sCELO: {
    [ChainId.ALFAJORES]: "0x5DF3aD9D6F8bE54C288a96C6ED970124f60333E6",
    [ChainId.MAINNET]: "0x2879BFD5e7c4EF331384E908aaA3Bd3014b703fA",
  },
} as const;

export type ITokenName = keyof typeof tokenAddresses;

export const getTokenAddress = (
  token: ITokenName,
  chain: ChainId
): string | null => {
  const addrs: Record<number, string> = tokenAddresses[token];
  return addrs[chain] ?? null;
};

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

export const getTokenByName = async (
  chainId: ChainId,
  provider: ethers.providers.BaseProvider,
  name: ITokenName
): Promise<{ token: Token; contract: IERC20 }> => {
  const address = getTokenAddress(name, chainId);
  if (!address) {
    throw new Error(`Could not find token ${name} on chain ${chainId}`);
  }
  return await loadTokenData(address, provider);
};

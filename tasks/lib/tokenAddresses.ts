import { ISupportedChain } from "@ubeswap/hardhat-celo";
import { CELO, ChainId, cUSD } from "@ubeswap/sdk";

export const tokenAddresses: Record<
  string,
  { [network in ISupportedChain]: string }
> = {
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
  CELO: {
    [ChainId.ALFAJORES]: CELO[ChainId.ALFAJORES].address,
    [ChainId.MAINNET]: CELO[ChainId.MAINNET].address,
  },
};

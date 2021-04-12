// Largely based off of CeloVote
// https://github.com/zviadm/celovote-app/blob/main/src/ledger.ts
import { ContractKit, newKit } from "@celo/contractkit";
import {
  AddressValidation,
  LedgerWallet,
  newLedgerWalletWithSetup,
} from "@celo/wallet-ledger";
import { JsonRpcSigner, Web3Provider } from "@ethersproject/providers";
import TransportNodeHID from "@ledgerhq/hw-transport-node-hid";
import { ChainId, CHAIN_INFO } from "@ubeswap/sdk";
import { getAddress } from "ethers/lib/utils";
import { OPERATOR } from "../deploy/config";

export class LedgerKit {
  private closed = false;
  private constructor(
    public chainId: ChainId,
    public kit: ContractKit,
    public wallet: LedgerWallet
  ) {}

  public static async init(chainId: ChainId, idxs: number[]) {
    const transport = await TransportNodeHID.create();
    try {
      const wallet = await newLedgerWalletWithSetup(
        transport,
        idxs,
        undefined,
        AddressValidation.everyTransaction
      );
      const kit = newKit(CHAIN_INFO[chainId].fornoURL, wallet);
      return new LedgerKit(chainId, kit, wallet);
    } catch (e) {
      transport.close();
      throw e;
    }
  }

  public static async initOperator(): Promise<{
    ledger: LedgerKit;
    provider: Web3Provider;
    address: string;
    signer: JsonRpcSigner;
  }> {
    const ledger = await LedgerKit.init(ChainId.ALFAJORES, [0]);
    const provider = new Web3Provider(ledger.kit.web3.currentProvider as any);
    const rawAddress = ledger.wallet.getAccounts()[0];
    if (!rawAddress) {
      throw new Error("ledger address error");
    }
    const address = getAddress(rawAddress);
    if (address !== OPERATOR) {
      throw new Error(
        `ledger not operator (found ${address}, want ${OPERATOR})`
      );
    }
    return {
      ledger,
      provider,
      address,
      signer: provider.getSigner(address),
    };
  }

  close = () => {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.wallet.transport.close();
    this.kit.stop();
  };
}

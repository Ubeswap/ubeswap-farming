import { DeployerFn, doTx, log } from "@ubeswap/hardhat-celo";
import { formatEther } from "ethers/lib/utils";
import { DeployersMap } from "..";
import { IERC20__factory } from "../../../build/types";
import { LedgerKit } from "../../lib/ledger";
import { allocMined } from "../config";
import { UbeToken } from "../governance.json";

type IResult = Record<string, string>;

/**
 * This task should be run after rewards.
 */
export const seedUbe: DeployerFn<IResult> = async ({
  getAddresses,
  provider,
}) => {
  const { MiningReleaseEscrow } = getAddresses<DeployersMap, "mining-escrow">(
    "mining-escrow"
  );

  const operator = await LedgerKit.initOperator(provider.network.chainId);

  log("Deploy UBE to mining escrow");
  const ubeTokenContract = IERC20__factory.connect(UbeToken, operator.signer);
  const currentBalance = await ubeTokenContract.balanceOf(operator.address);
  const requiredBalance = allocMined;
  if (currentBalance.lt(requiredBalance)) {
    console.log("Operator address:", operator.address);
    throw new Error(
      `Need more UBE (want ${formatEther(requiredBalance)}, have ${formatEther(
        currentBalance
      )})`
    );
  }

  await doTx(
    `Send ${formatEther(allocMined)} UBE to mining escrow on network ${
      provider.network.chainId
    } (open your ledger!)`,
    ubeTokenContract.transfer(MiningReleaseEscrow, allocMined)
  );

  // Deploy initial liquidity
  // We can do this manually
  // log("Adding initial liquidity...");
  // const pairs = await addInitialLiquidity({
  //   operator,
  // });

  return {};
};

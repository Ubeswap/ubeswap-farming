import { DeployerFn, doTx } from "@ubeswap/hardhat-celo";
import { formatEther } from "ethers/lib/utils";
import { DeployersMap } from "..";
import {
  IERC20__factory,
  IStartTime__factory,
  ReleaseEscrow__factory,
} from "../../../build/types/";
import { LedgerKit } from "../../lib/ledger";
import { allocMined } from "../config";
import { ReleaseUBE, UbeToken } from "../governance.json";

interface IResult {
  MiningReleaseEscrow: string;
}

export const distributeTokens: DeployerFn<IResult> = async ({
  deployCreate2,
  deployer,
  getAddresses,
  provider,
}) => {
  // Get start time from ReleaseUBE
  const startTime = (
    await IStartTime__factory.connect(ReleaseUBE, provider).startTime()
  ).toNumber();

  const addrs = getAddresses<DeployersMap, "pool-manager">("pool-manager");
  const { MiningTokenAllocator, HalveningReleaseSchedule } = addrs;

  const operator = await LedgerKit.initOperator();
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

  // Deploy mining escrow
  const miningEscrow = await deployCreate2("MiningReleaseEscrow", {
    factory: ReleaseEscrow__factory,
    signer: deployer,
    args: [
      // beneficiary_
      MiningTokenAllocator,
      // rewardToken_
      UbeToken,
      // schedule_
      HalveningReleaseSchedule,
      // startTime_
      startTime,
    ],
  });

  await doTx(
    `Send ${formatEther(allocMined)} UBE to mining escrow (open your ledger!)`,
    ubeTokenContract.transfer(miningEscrow.address, allocMined)
  );

  return {
    MiningReleaseEscrow: miningEscrow.address,
  };
};

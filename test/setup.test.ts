import { makeCommonEnvironment } from "@ubeswap/hardhat-celo";
import {
  deployerAddress,
  deployFactory,
} from "@ubeswap/solidity-create2-deployer";
import { parseEther } from "ethers/lib/utils";
import hre from "hardhat";

before(async () => {
  const { signer: deployer, provider } = await makeCommonEnvironment(hre);
  // deploy create2 factory
  await deployer.sendTransaction({
    to: deployerAddress,
    value: parseEther("1"),
  });
  await deployFactory(provider);
});

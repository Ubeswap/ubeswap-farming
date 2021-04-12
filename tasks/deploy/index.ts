import { makeDeployTask, ResultsMap } from "@ubeswap/hardhat-celo";
import * as path from "path";
import { deployPoolManager } from "./002_pool-manager";
import { distributeTokens } from "./003_distribution";
import { createPools } from "./004_create-pools";
import { startFarming } from "./005_start-farming";

const deployers = {
  "pool-manager": deployPoolManager,
  distribution: distributeTokens,
  "create-pools": createPools,
  "start-farming": startFarming,
};

export type DeployersMap = ResultsMap<typeof deployers>;

export const { deploy } = makeDeployTask({
  deployers,
  rootDir: path.resolve(__dirname + "/../.."),
});

import { makeDeployTask, ResultsMap } from "@ubeswap/hardhat-celo";
import * as path from "path";
import { deployPoolManager } from "./001_pool-manager";
import { deployMiningEscrow } from "./002_mining-escrow";
import { createPools } from "./003_create-pools";
import { seedUbe } from "./004_seed-ube";
import { startFarming } from "./005_start-farming";

const deployers = {
  "pool-manager": deployPoolManager,
  "mining-escrow": deployMiningEscrow,
  "create-pools": createPools,
  "seed-ube": seedUbe,
  "start-farming": startFarming,
};

export type DeployersMap = ResultsMap<typeof deployers>;

export const { deploy } = makeDeployTask({
  deployers,
  rootDir: path.resolve(__dirname + "/../.."),
});

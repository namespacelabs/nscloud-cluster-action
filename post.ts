import * as core from "@actions/core";
import { execSync } from "child_process";
import * as common from "./common";

async function run(): Promise<void> {
	try {
		const clusterId = core.getState(common.clusterIdKey);

		if (clusterId != "" && core.getInput("preview") != "true") {
			execSync("ns exchange-github-token", { stdio: "inherit" });

			// TODO replace with suspend & print instructions how to revive it.
			execSync(`ns cluster destroy ${clusterId} --force`, { stdio: "inherit" });
		}
	} catch (error) {
		core.setFailed(error.message);
	}
}

run();

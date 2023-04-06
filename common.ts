import * as path from "path";
import * as fs from "fs";
import * as exec from "@actions/exec";
import * as core from "@actions/core";

export const ClusterIdKey = "clusterId";

export function tmpFile(file: string): string {
	const tmpDir = path.join(process.env.RUNNER_TEMP, "ns");

	if (!fs.existsSync(tmpDir)) {
		fs.mkdirSync(tmpDir);
	}

	return path.join(tmpDir, file);
}

export async function ensureNscloudToken() {
	const tokenFile = "/var/run/nsc/token.json";
	if (fs.existsSync(tokenFile)) {
		core.exportVariable("NSC_TOKEN_FILE", tokenFile);
		return
	}

	// We only need a valid token when opening the proxy
	await exec.exec("nsc auth exchange-github-token --ensure=5m");
}

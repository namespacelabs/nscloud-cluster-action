import * as core from "@actions/core";
import * as fs from "fs";
import * as exec from "@actions/exec";
import { ClusterIdKey, ensureNscloudToken, tmpFile } from "./common";

async function run(): Promise<void> {
	const commandExists = require("command-exists");

	commandExists("nsc")
		.then(prepareCluster)
		.catch(() => {
			core.setFailed(`Namespace Cloud CLI not found.

Please add a step this step to your workflow's job definition:

- uses: namespacelabs/nscloud-setup@v0`);
		});
}

async function prepareCluster(): Promise<void> {
	try {
		// Start downloading kubectl while we prepare the cluster.
		const kubectlDir = downloadKubectl();

		const registryFile = tmpFile("registry.txt");
		const cluster = await core.group("Create Namespace Cloud cluster", async () => {
			await ensureNscloudToken();

			return await createCluster(registryFile);
		});
		core.saveState(ClusterIdKey, cluster.cluster_id);
		core.setOutput("instance-id", cluster.cluster_id);
		core.setOutput("instance-url", cluster.cluster_url);

		await core.group("Configure kubectl", async () => {
			const kubeConfig = await prepareKubeconfig(cluster.cluster_id);
			core.exportVariable("KUBECONFIG", kubeConfig);

			core.setOutput("kubeconfig", fs.readFileSync(kubeConfig, "utf8"));

			core.addPath(await kubectlDir);
		});

		const registry = fs.readFileSync(registryFile, "utf8");
		await core.group("Registry address", async () => {
			core.info(registry);
			core.setOutput("registry-address", registry);
		});

		// New line to separate from groups.
		core.info(`
Successfully created an nscloud cluster.
\`kubectl\` has been installed and preconfigured.

You can find logs and jump into SSH at ${cluster.cluster_url}
Or install \`nsc\` from https://github.com/namespacelabs/foundation/releases/latest
and follow the cluster logs with \`nsc cluster logs ${cluster.cluster_id} -f\``);
	} catch (error) {
		core.setFailed(error.message);
	}
}

// Returns the path to the generated kubeconfig.
async function prepareKubeconfig(clusterId: string) {
	const out = tmpFile("kubeconfig.txt");

	await exec.exec(`nsc cluster kubeconfig ${clusterId} --output_to=${out}`);

	return fs.readFileSync(out, "utf8");
}

// Returns the path to the downloaded kubectl binary's directory.
async function downloadKubectl() {
	const out = tmpFile("kubectl.txt");

	await exec.exec(`nsc sdk download --sdks=kubectl --output_to=${out} --log_actions=false`);

	return fs.readFileSync(out, "utf8");
}

interface Cluster {
	cluster_url: string;
	cluster_id: string;
}

async function createCluster(registryFile: string): Promise<Cluster> {
	const platform = core.getInput("platform");
	const shape = core.getInput("machine-shape");

	let cmd = `nsc cluster create -o json --machine_type ${platform}:${shape} --output_registry_to=${registryFile}`;

	if (core.getInput("wait-kube-system") === "true") {
		cmd = `${cmd} --wait_kube_system`;
	}

	const tag = core.getInput("unique-tag");
	if (tag !== "") {
		cmd = `${cmd} --unique_tag ${tag}`;
	}

	const dur = core.getInput("duration");
	if (dur !== "") {
		cmd = `${cmd} --duration ${dur}`;
	}

	const ing = core.getInput("ingress");
	if (ing !== "") {
		cmd = `${cmd} --ingress ${ing}`;
	}

	const out = await exec.getExecOutput(cmd);

	return JSON.parse(out.stdout);
}

run();

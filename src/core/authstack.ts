export const AUTHSTACK_REPO = "scalekit-inc/authstack";
export const AUTHSTACK_MARKETPLACE = "authstack";
export const AUTHSTACK_KITS = ["agentkit", "saaskit"] as const;

export const AUTHSTACK_URL =
	`https://github.com/${AUTHSTACK_REPO}/archive/refs/heads/main.tar.gz`;

export const AUTHSTACK_ARCHIVE_DIR = `${AUTHSTACK_REPO.split("/").pop()}-main`;

export const CLI_PACKAGE = "@scalekit-inc/cli";

export function getSetupCommand(stack: string) {
	return `npx ${CLI_PACKAGE} setup ${stack}`;
}

export function getPluginMarketplaceCommands(tool: "claude" | "copilot") {
	return [
		`${tool} plugin marketplace add ${AUTHSTACK_REPO}`,
		`${tool} plugin install agentkit@${AUTHSTACK_MARKETPLACE}`,
		`${tool} plugin install saaskit@${AUTHSTACK_MARKETPLACE}`,
	];
}

export function getPluginUninstallCommands(tool: "claude" | "copilot") {
	return [
		`${tool} plugin uninstall agentkit@${AUTHSTACK_MARKETPLACE}`,
		`${tool} plugin uninstall saaskit@${AUTHSTACK_MARKETPLACE}`,
		`${tool} plugin marketplace remove ${AUTHSTACK_MARKETPLACE}`,
	];
}

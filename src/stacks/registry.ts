import { claudeStack } from "./claude.js";
import { codexStack } from "./codex.js";
import { cursorStack } from "./cursor.js";

export interface Stack {
	id: string;
	name: string;
	description: string;
	commands: string[];
	detect: () => boolean;
	install: () => Promise<void>;
}

export const stacks: Stack[] = [cursorStack, claudeStack, codexStack];

export function findStack(id: string): Stack | undefined {
	return stacks.find((s) => s.id === id);
}

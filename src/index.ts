import { Command } from "commander";

const program = new Command();

program.name("scalekit").description("Scalekit CLI").version("0.1.0");

program.parse();

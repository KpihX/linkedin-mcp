#!/usr/bin/env node
/**
 * linkedin-mcp — Admin entrypoint (linkedin-admin).
 * Delegates to src/admin/cli.js.
 */

"use strict";

const { program } = require("./admin/cli");
program.parseAsync(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});

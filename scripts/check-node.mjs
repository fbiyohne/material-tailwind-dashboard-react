// Guard against running with an unsupported Node version.
// CreaticTV targets Node 20+ (developed on Node 22).
const MIN_MAJOR = 20;
const major = Number(process.versions.node.split('.')[0]);

if (Number.isNaN(major) || major < MIN_MAJOR) {
  console.error(
    `\n✖ Node ${process.versions.node} detected. CreaticTV needs Node ${MIN_MAJOR}+ (22 LTS recommended).\n` +
      `  Install it from https://nodejs.org or via nvm: nvm install 22 && nvm use 22\n`,
  );
  process.exit(1);
}

console.log(`✓ Node ${process.versions.node} OK`);

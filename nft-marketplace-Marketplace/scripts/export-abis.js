const fs = require("fs");
const path = require("path");

// Source: Hardhat artifacts
const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts", "src");

// Destination: Frontend-ready exports
const outputDir = path.join(__dirname, "..", "exports");
// Also export to main app's exports folder
const appExportsDir = path.join(__dirname, "..", "..", "exports");

// Contracts to export
const contracts = [
  "Registry",
  "EventFactory", 
  "EventTicket",
  "TicketMarketplace",
  "RoyaltySplitter"
];

function extractABI(contractName) {
  const artifactPath = path.join(artifactsDir, `${contractName}.sol`, `${contractName}.json`);
  
  if (!fs.existsSync(artifactPath)) {
    console.error(`❌ Artifact not found: ${artifactPath}`);
    return null;
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return artifact.abi;
}

function main() {
  console.log("📦 Exporting ABIs for frontend...\n");
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const abis = {};
  
  for (const contractName of contracts) {
    const abi = extractABI(contractName);
    if (abi) {
      abis[contractName] = abi;
      
      // Also save individual ABI file
      const abiPath = path.join(outputDir, `${contractName}.json`);
      fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
      console.log(`✅ ${contractName} ABI exported`);
    }
  }
  
  // Save combined ABIs file
  const combinedPath = path.join(outputDir, "abis.json");
  fs.writeFileSync(combinedPath, JSON.stringify(abis, null, 2));
  console.log(`\n📁 Combined ABIs saved to: ${combinedPath}`);
  
  // Load deployment info and create complete frontend config
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const networks = fs.readdirSync(deploymentsDir).filter(f => f.endsWith(".json"));
  
  const frontendConfig = {
    abis,
    deployments: {}
  };
  
  for (const networkFile of networks) {
    const networkName = networkFile.replace(".json", "");
    const deployment = JSON.parse(fs.readFileSync(path.join(deploymentsDir, networkFile), "utf8"));
    frontendConfig.deployments[networkName] = deployment;
  }
  
  const configPath = path.join(outputDir, "contracts.json");
  fs.writeFileSync(configPath, JSON.stringify(frontendConfig, null, 2));
  console.log(`📁 Complete frontend config saved to: ${configPath}`);
  
  // Also copy to main app exports folder
  if (!fs.existsSync(appExportsDir)) {
    fs.mkdirSync(appExportsDir, { recursive: true });
  }
  const appConfigPath = path.join(appExportsDir, "contracts.json");
  fs.writeFileSync(appConfigPath, JSON.stringify(frontendConfig, null, 2));
  console.log(`📁 Complete frontend config also saved to: ${appConfigPath}`);
  
  // Copy ABIs to app exports
  const appAbisPath = path.join(appExportsDir, "abis.json");
  fs.writeFileSync(appAbisPath, JSON.stringify(abis, null, 2));
  
  // Generate TypeScript types
  generateTypeScriptExports(abis, frontendConfig.deployments);
}

function generateTypeScriptExports(abis, deployments) {
  const tsContent = `// Auto-generated contract exports
// Generated at: ${new Date().toISOString()}

export const CONTRACT_ADDRESSES = ${JSON.stringify(deployments, null, 2)} as const;

export const ABIS = {
${Object.keys(abis).map(name => `  ${name}: ${JSON.stringify(abis[name])}`).join(",\n")}
} as const;

export type ContractName = keyof typeof ABIS;
export type NetworkName = keyof typeof CONTRACT_ADDRESSES;
`;

  const tsPath = path.join(outputDir, "contracts.ts");
  fs.writeFileSync(tsPath, tsContent);
  console.log(`📁 TypeScript exports saved to: ${tsPath}`);
  
  // Also copy to main app exports folder
  const appTsPath = path.join(appExportsDir, "contracts.ts");
  fs.writeFileSync(appTsPath, tsContent);
  console.log(`📁 TypeScript exports also saved to: ${appTsPath}`);
}

main();

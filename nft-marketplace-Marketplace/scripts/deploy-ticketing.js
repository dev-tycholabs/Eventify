const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const signers = await hre.ethers.getSigners();

  if (signers.length === 0) {
    throw new Error("No signers available. Make sure PRIVATE_KEY is set in .env file");
  }

  const deployer = signers[0];

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Wait for extra confirmations on public RPCs to avoid nonce race conditions
  const CONFIRMATIONS = hre.network.name === "hardhat" ? 1 : 2;

  // ============================================
  // 1. Deploy Registry
  // ============================================
  console.log("\n📋 Deploying Registry...");

  const Registry = await hre.ethers.getContractFactory("Registry");
  const registry = await Registry.deploy(
    deployer.address, // systemWallet - receives platform fees
    250,              // feeNumerator - 2.5% fee
    10000             // feeScale - basis points
  );
  await registry.deployTransaction.wait(CONFIRMATIONS);

  console.log(`✅ Registry deployed to: ${registry.address}`);

  // ============================================
  // 2. Deploy TicketMarketplace
  // ============================================
  console.log("\n🏪 Deploying TicketMarketplace...");

  const TicketMarketplace = await hre.ethers.getContractFactory("TicketMarketplace");
  const marketplace = await TicketMarketplace.deploy(registry.address);
  await marketplace.deployTransaction.wait(CONFIRMATIONS);

  console.log(`✅ TicketMarketplace deployed to: ${marketplace.address}`);

  // ============================================
  // 3. Deploy RoyaltySplitter (implementation for cloning)
  // ============================================
  console.log("\n💰 Deploying RoyaltySplitter implementation...");

  const RoyaltySplitter = await hre.ethers.getContractFactory("RoyaltySplitter");
  const splitterImpl = await RoyaltySplitter.deploy();
  await splitterImpl.deployTransaction.wait(CONFIRMATIONS);

  console.log(`✅ RoyaltySplitter implementation deployed to: ${splitterImpl.address}`);

  // ============================================
  // 4. Deploy EventFactory
  // ============================================
  console.log("\n🏭 Deploying EventFactory...");

  const EventFactory = await hre.ethers.getContractFactory("EventFactory");
  const factory = await EventFactory.deploy(
    registry.address,
    500,                // defaultRoyaltyPercent - 5% royalty in basis points
    110,                // defaultMaxResalePercent - 110% max resale price
    splitterImpl.address // splitterImplementation for cloning
  );
  await factory.deployTransaction.wait(CONFIRMATIONS);

  console.log(`✅ EventFactory deployed to: ${factory.address}`);

  // ============================================
  // 5. Configure Registry
  // ============================================
  console.log("\n⚙️  Configuring Registry...");

  // Approve TicketMarketplace
  let tx = await registry.setContractStatus(marketplace.address, true);
  await tx.wait(CONFIRMATIONS);
  console.log("   ✓ TicketMarketplace approved in Registry");

  // Approve EventFactory
  tx = await registry.setContractStatus(factory.address, true);
  await tx.wait(CONFIRMATIONS);
  console.log("   ✓ EventFactory approved in Registry");

  // Transfer Registry ownership to EventFactory so it can register new event contracts
  tx = await registry.transferOwnership(factory.address);
  await tx.wait(CONFIRMATIONS);
  console.log("   ✓ Registry ownership transferred to EventFactory");

  // ============================================
  // Summary
  // ============================================
  console.log("\n" + "=".repeat(50));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(50));
  console.log("\nContract Addresses:");
  console.log(`  Registry:              ${registry.address}`);
  console.log(`  TicketMarketplace:     ${marketplace.address}`);
  console.log(`  RoyaltySplitter impl:  ${splitterImpl.address}`);
  console.log(`  EventFactory:          ${factory.address}`);
  console.log("\nConfiguration:");
  console.log(`  Platform Fee:          2.5%`);
  console.log(`  Default Royalty:       5%`);
  console.log(`  Max Resale Price:      110%`);
  console.log(`  System Wallet:         ${deployer.address}`);

  // ============================================
  // Save deployment info
  // ============================================
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId || "unknown",
    deployer: deployer.address,
    contracts: {
      Registry: registry.address,
      TicketMarketplace: marketplace.address,
      RoyaltySplitter: splitterImpl.address,
      EventFactory: factory.address,
    },
    config: {
      platformFeePercent: 2.5,
      defaultRoyaltyPercent: 5,
      maxResalePricePercent: 110,
    },
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${hre.network.name}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📁 Deployment info saved to: ${outputPath}`);

  // ============================================
  // Update frontend contracts.ts with new addresses
  // ============================================
  const frontendContractsPath = path.join(
    __dirname, "..", "..", "src", "hooks", "contracts.ts"
  );

  if (fs.existsSync(frontendContractsPath)) {
    let content = fs.readFileSync(frontendContractsPath, "utf8");

    // Replace contract addresses
    content = content.replace(
      /EventFactory:\s*"0x[a-fA-F0-9]+"/,
      `EventFactory: "${factory.address}"`
    );
    content = content.replace(
      /TicketMarketplace:\s*"0x[a-fA-F0-9]+"/,
      `TicketMarketplace: "${marketplace.address}"`
    );
    content = content.replace(
      /Registry:\s*"0x[a-fA-F0-9]+"/,
      `Registry: "${registry.address}"`
    );
    content = content.replace(
      /RoyaltySplitterImpl:\s*"0x[a-fA-F0-9]+"/,
      `RoyaltySplitterImpl: "${splitterImpl.address}"`
    );

    fs.writeFileSync(frontendContractsPath, content);
    console.log(`✅ Frontend contracts.ts updated with new addresses`);
  } else {
    console.log(`⚠️  Frontend contracts.ts not found at ${frontendContractsPath}`);
    console.log("   Update CONTRACT_ADDRESSES manually in your frontend.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

const hre = require("hardhat");

async function main() {
  // Ensure the contract name matches the name in your Solidity file
  const Voting = await hre.ethers.getContractFactory("HealthRecordSystem");

  // Deploy the contract
  const voting = await Voting.deploy();

  // Wait for deployment to complete
  await voting.waitForDeployment();

  // Log the contract address
  console.log("Contract deployed to:", await voting.getAddress());
}

// Run the main function and catch any errors
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
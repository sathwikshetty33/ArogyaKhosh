async function main() {
    const HealthRecordSystem = await ethers.getContractFactory("HealthRecordSystem");
    console.log("Deploying contract...");
    
    // Deploy without arguments if your contract doesn't have constructor parameters
    const healthRecordSystem = await HealthRecordSystem.deploy();
    
    await healthRecordSystem.waitForDeployment();
    console.log("HealthRecordSystem deployed to:", await healthRecordSystem.getAddress());
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
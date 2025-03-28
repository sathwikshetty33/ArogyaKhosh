bcNode:
	npx hardhat node
bcDeploy:
	npx  hardhat run scripts/deploy2.js --network localhost
phony:
	bcDeploy bcNode
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import "../src/MockToken.sol";

contract DeployTokensScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        console.log("=== Deploying ERC20 Tokens ===");
        console.log("Deployer address:", msg.sender);

        // Deploy various tokens for testing
        MockToken usdc = new MockToken("USD Coin", "USDC", 6, 1000000);
        console.log("USDC deployed at:", address(usdc));

        MockToken usdt = new MockToken("Tether USD", "USDT", 6, 1000000);
        console.log("USDT deployed at:", address(usdt));

        MockToken dai = new MockToken("Dai Stablecoin", "DAI", 18, 1000000);
        console.log("DAI deployed at:", address(dai));

        MockToken weth = new MockToken("Wrapped Ether", "WETH", 18, 100000);
        console.log("WETH deployed at:", address(weth));

        MockToken wbtc = new MockToken("Wrapped Bitcoin", "WBTC", 8, 10000);
        console.log("WBTC deployed at:", address(wbtc));

        MockToken uni = new MockToken("Uniswap", "UNI", 18, 1000000);
        console.log("UNI deployed at:", address(uni));

        vm.stopBroadcast();

        console.log("\n=== Token Deployment Summary ===");
        console.log("USDC (6 decimals):", address(usdc));
        console.log("USDT (6 decimals):", address(usdt));
        console.log("DAI (18 decimals):", address(dai));
        console.log("WETH (18 decimals):", address(weth));
        console.log("WBTC (8 decimals):", address(wbtc));
        console.log("UNI (18 decimals):", address(uni));
        console.log("================================");
    }

    function deployCustomToken(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 initialSupply
    ) external {
        vm.startBroadcast();

        MockToken token = new MockToken(name, symbol, decimals, initialSupply);
        console.log("Custom token deployed:");
        console.log("Name:", name);
        console.log("Symbol:", symbol);
        console.log("Decimals:", decimals);
        console.log("Initial Supply:", initialSupply);
        console.log("Address:", address(token));

        vm.stopBroadcast();
    }
}
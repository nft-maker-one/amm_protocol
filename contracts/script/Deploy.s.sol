// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import "../src/AMMFactory.sol";
import "../src/MockToken.sol";
import "../src/libraries/TickMath.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy Factory
        AMMFactory factory = new AMMFactory();
        console.log("AMMFactory deployed at:", address(factory));

        // Deploy Mock Tokens
        MockToken tokenA = new MockToken("Token A", "TKNA", 18, 1000000);
        MockToken tokenB = new MockToken("Token B", "TKNB", 18, 1000000);

        // Ensure tokenA < tokenB for consistent ordering
        if (address(tokenA) > address(tokenB)) {
            (tokenA, tokenB) = (tokenB, tokenA);
        }

        console.log("TokenA deployed at:", address(tokenA));
        console.log("TokenB deployed at:", address(tokenB));

        // Create Pool
        address poolAddress = factory.createPool(address(tokenA), address(tokenB), 3000);
        console.log("Pool created at:", poolAddress);

        // Initialize Pool
        AMMPool pool = AMMPool(poolAddress);
        uint160 sqrtPriceX96 = 79228162514264337593543950336; // price = 1
        pool.initialize(sqrtPriceX96);
        console.log("Pool initialized with sqrtPriceX96:", sqrtPriceX96);

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary ===");
        console.log("Factory:", address(factory));
        console.log("TokenA:", address(tokenA));
        console.log("TokenB:", address(tokenB));
        console.log("Pool:", poolAddress);
        console.log("========================");
    }
}
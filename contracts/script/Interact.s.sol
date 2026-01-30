// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import "../src/AMMFactory.sol";
import "../src/AMMPool.sol";
import "../src/MockToken.sol";

contract InteractScript is Script {
    // Update these addresses after deployment
    address constant FACTORY_ADDRESS = 0x680D7aB71dB31610dE7A6ab07c848821E3bFD84f; // Replace with actual
    address constant TOKEN_A_ADDRESS = 0x480ce59387443A9Bf266a4657f0E2AE1E6a7B771; // Replace with actual
    address constant TOKEN_B_ADDRESS = 0x68B5f6a7ccD9EA0642d7B069135d84AD2CC26232; // Replace with actual
    address constant POOL_ADDRESS = 0x2708D48ccD3405ab509F9304223a0b0382F7E672; // Replace with actual

    function run() external {
        vm.startBroadcast();

        MockToken tokenA = MockToken(TOKEN_A_ADDRESS);
        MockToken tokenB = MockToken(TOKEN_B_ADDRESS);
        AMMPool pool = AMMPool(POOL_ADDRESS);

        console.log("=== Adding Liquidity ===");

        // Approve tokens
        tokenA.approve(POOL_ADDRESS, type(uint256).max);
        tokenB.approve(POOL_ADDRESS, type(uint256).max);

        // Add liquidity
        int24 tickLower = -60;
        int24 tickUpper = 60;
        uint128 liquidityAmount = 1000 * 1e18;

        uint256 balanceA_before = tokenA.balanceOf(msg.sender);
        uint256 balanceB_before = tokenB.balanceOf(msg.sender);

        (uint256 amount0, uint256 amount1) = pool.mint(
            msg.sender,
            tickLower,
            tickUpper,
            liquidityAmount,
            ""
        );

        console.log("Liquidity added:");
        console.log("Amount0 deposited:", amount0);
        console.log("Amount1 deposited:", amount1);
        console.log("TokenA balance before:", balanceA_before);
        console.log("TokenA balance after:", tokenA.balanceOf(msg.sender));
        console.log("TokenB balance before:", balanceB_before);
        console.log("TokenB balance after:", tokenB.balanceOf(msg.sender));

        console.log("\n=== Performing Swap ===");

        uint256 swapAmount = 100 * 1e18;
        balanceA_before = tokenA.balanceOf(msg.sender);
        balanceB_before = tokenB.balanceOf(msg.sender);

        (int256 swapAmount0, int256 swapAmount1) = pool.swap(
            msg.sender,
            true, // zeroForOne (tokenA for tokenB)
            int256(swapAmount),
            79228162514264337593543950336 / 2, // sqrt price limit
            ""
        );

        console.log("Swap completed:");
        console.log("Amount0 (paid):", uint256(swapAmount0));
        console.log("Amount1 (received):", uint256(-swapAmount1));
        console.log("TokenA balance before:", balanceA_before);
        console.log("TokenA balance after:", tokenA.balanceOf(msg.sender));
        console.log("TokenB balance before:", balanceB_before);
        console.log("TokenB balance after:", tokenB.balanceOf(msg.sender));

        vm.stopBroadcast();
    }
}
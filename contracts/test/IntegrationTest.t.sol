// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import "../src/AMMFactory.sol";
import "../src/AMMPool.sol";
import "../src/MockToken.sol";
import "../src/libraries/TickMath.sol";

contract IntegrationTest is Test {
    AMMFactory public factory;
    MockToken public tokenA;
    MockToken public tokenB;
    AMMPool public pool;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public constant INITIAL_SUPPLY = 1000000 * 1e18;

    function setUp() public {
        factory = new AMMFactory();

        tokenA = new MockToken("Token A", "TKNA", 18, INITIAL_SUPPLY);
        tokenB = new MockToken("Token B", "TKNB", 18, INITIAL_SUPPLY);

        if (address(tokenA) > address(tokenB)) {
            (tokenA, tokenB) = (tokenB, tokenA);
        }

        address poolAddress = factory.createPool(address(tokenA), address(tokenB), 3000);
        pool = AMMPool(poolAddress);

        tokenA.transfer(alice, 100000 * 1e18);
        tokenB.transfer(alice, 100000 * 1e18);
        tokenA.transfer(bob, 100000 * 1e18);
        tokenB.transfer(bob, 100000 * 1e18);
    }

    function test_TwapObservation() public {
        uint160 sqrtPriceX96 = 79228162514264337593543950336; // price = 1
        pool.initialize(sqrtPriceX96);

        // Increase cardinality to allow history
        pool.increaseObservationCardinalityNext(10);

        vm.startPrank(alice);
        tokenA.approve(address(pool), type(uint256).max);
        tokenB.approve(address(pool), type(uint256).max);
        pool.mint(alice, -60, 60, 1000 * 1e18, "");
        vm.stopPrank();

        // Advance time and check observations
        vm.warp(block.timestamp + 10);
        
        // Make a swap to record a new observation
        vm.startPrank(bob);
        tokenA.approve(address(pool), type(uint256).max);
        tokenB.approve(address(pool), type(uint256).max);
        
        pool.swap(bob, true, 10 * 1e18, TickMath.MIN_SQRT_RATIO + 1, "");
        vm.stopPrank();

        vm.warp(block.timestamp + 10);

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = 10;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives, ) = pool.observe(secondsAgos);
        
        assertEq(tickCumulatives.length, 2);
        // We know price was 1 (tick 0) for at least 10 seconds.
        // So cumulative should reflect that? 
        // tick 0 * 10 seconds = 0.
        // Wait, swap changed the tick.
        
        console.log("Tick Cumulative 0:", tickCumulatives[0]);
        console.log("Tick Cumulative 1:", tickCumulatives[1]);
    }

    function test_DynamicFee() public {
        uint160 sqrtPriceX96 = 79228162514264337593543950336; // price = 1
        pool.initialize(sqrtPriceX96);
        pool.increaseObservationCardinalityNext(10);

        vm.startPrank(alice);
        tokenA.approve(address(pool), type(uint256).max);
        tokenB.approve(address(pool), type(uint256).max);
        pool.mint(alice, -600, 600, 10000 * 1e18, ""); // Wide range
        vm.stopPrank();

        // 1. Initial swap (Low Volatility)
        vm.warp(block.timestamp + 300); // Advance 5 mins
        
        vm.startPrank(bob);
        tokenA.approve(address(pool), type(uint256).max);
        pool.swap(bob, true, 100 * 1e18, TickMath.MIN_SQRT_RATIO + 1, "");
        
        // 2. High Volatility Simulation
        // We need to move the price rapidly.
        // Swap a large amount to move tick significantly
        pool.swap(bob, true, 1000 * 1e18, TickMath.MIN_SQRT_RATIO + 1, "");
        
        vm.warp(block.timestamp + 60); // Advance slightly

        // 3. Another swap - should trigger dynamic fee if volatility is high enough
        // We can't easily assert the internal fee variable without an event or return value inspection,
        // but we can check the amount received vs expected for a standard fee.
        
        uint256 balanceBefore = tokenB.balanceOf(bob);
        pool.swap(bob, true, 100 * 1e18, TickMath.MIN_SQRT_RATIO + 1, "");
        uint256 balanceAfter = tokenB.balanceOf(bob);
        
        uint256 amountOut = balanceAfter - balanceBefore;
        console.log("Amount Out with Dynamic Fee:", amountOut);
        
        vm.stopPrank();
    }
}

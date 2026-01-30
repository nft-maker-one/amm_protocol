// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import "../src/AMMFactory.sol";
import "../src/AMMPool.sol";
import "../src/MockToken.sol";
import "../src/libraries/TickMath.sol";

contract AMMTest is Test {
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

    function test_CreatePool() public {
        assertEq(pool.token0(), address(tokenA));
        assertEq(pool.token1(), address(tokenB));
        assertEq(pool.fee(), 3000);
        assertEq(pool.tickSpacing(), 60);
    }

    function test_InitializePool() public {
        uint160 sqrtPriceX96 = 79228162514264337593543950336; // price = 1
        pool.initialize(sqrtPriceX96);

        (uint160 sqrtPrice, int24 tick,,,,,) = pool.slot0();
        assertEq(sqrtPrice, sqrtPriceX96);
        assertTrue(tick == 0 || tick == -1); // Allow for rounding
    }

    function test_AddLiquidity() public {
        uint160 sqrtPriceX96 = 79228162514264337593543950336; // price = 1
        pool.initialize(sqrtPriceX96);

        vm.startPrank(alice);
        tokenA.approve(address(pool), type(uint256).max);
        tokenB.approve(address(pool), type(uint256).max);

        int24 tickLower = -60;
        int24 tickUpper = 60;
        uint128 amount = 1000 * 1e18;

        uint256 balance0Before = tokenA.balanceOf(alice);
        uint256 balance1Before = tokenB.balanceOf(alice);

        (uint256 amount0, uint256 amount1) = pool.mint(
            alice,
            tickLower,
            tickUpper,
            amount,
            ""
        );

        assertGt(amount0, 0);
        assertGt(amount1, 0);
        assertEq(tokenA.balanceOf(alice), balance0Before - amount0);
        assertEq(tokenB.balanceOf(alice), balance1Before - amount1);

        vm.stopPrank();
    }

    function test_Swap() public {
        uint160 sqrtPriceX96 = 79228162514264337593543950336; // price = 1
        pool.initialize(sqrtPriceX96);

        vm.startPrank(alice);
        tokenA.approve(address(pool), type(uint256).max);
        tokenB.approve(address(pool), type(uint256).max);

        pool.mint(alice, -60, 60, 1000 * 1e18, "");
        vm.stopPrank();

        vm.startPrank(bob);
        tokenA.approve(address(pool), type(uint256).max);
        tokenB.approve(address(pool), type(uint256).max);

        uint256 amountIn = 100 * 1e18;
        uint256 balance0Before = tokenA.balanceOf(bob);
        uint256 balance1Before = tokenB.balanceOf(bob);

        (int256 amount0, int256 amount1) = pool.swap(
            bob,
            true, // zeroForOne
            int256(amountIn),
            TickMath.MIN_SQRT_RATIO + 1,
            ""
        );

        assertGt(amount0, 0); // Bob pays tokenA
        assertLt(amount1, 0); // Bob receives tokenB

        assertEq(tokenA.balanceOf(bob), balance0Before - uint256(amount0));
        assertEq(tokenB.balanceOf(bob), balance1Before + uint256(-amount1));

        vm.stopPrank();
    }

    function test_RemoveLiquidity() public {
        uint160 sqrtPriceX96 = 79228162514264337593543950336; // price = 1
        pool.initialize(sqrtPriceX96);

        vm.startPrank(alice);
        tokenA.approve(address(pool), type(uint256).max);
        tokenB.approve(address(pool), type(uint256).max);

        int24 tickLower = -60;
        int24 tickUpper = 60;
        uint128 liquidityAmount = 1000 * 1e18;

        pool.mint(alice, tickLower, tickUpper, liquidityAmount, "");

        bytes32 positionKey = keccak256(abi.encodePacked(alice, tickLower, tickUpper));
        (uint128 liquidity,,,,) = pool.positions(positionKey);
        assertEq(liquidity, liquidityAmount);

        (uint256 amount0, uint256 amount1) = pool.burn(tickLower, tickUpper, liquidityAmount / 2);

        assertGt(amount0, 0);
        assertGt(amount1, 0);

        pool.collect(alice, tickLower, tickUpper, type(uint128).max, type(uint128).max);

        vm.stopPrank();
    }

    function test_MultipleLiquidityProviders() public {
        uint160 sqrtPriceX96 = 79228162514264337593543950336; // price = 1
        pool.initialize(sqrtPriceX96);

        vm.startPrank(alice);
        tokenA.approve(address(pool), type(uint256).max);
        tokenB.approve(address(pool), type(uint256).max);
        pool.mint(alice, -60, 60, 500 * 1e18, "");
        vm.stopPrank();

        vm.startPrank(bob);
        tokenA.approve(address(pool), type(uint256).max);
        tokenB.approve(address(pool), type(uint256).max);
        pool.mint(bob, -120, 120, 800 * 1e18, "");
        vm.stopPrank();

        assertGt(pool.liquidity(), 0);

        uint256 swapAmount = 50 * 1e18;
        vm.startPrank(alice);
        pool.swap(alice, true, int256(swapAmount), TickMath.MIN_SQRT_RATIO + 1, "");
        vm.stopPrank();
    }

    function test_ConcentratedLiquidity() public {
        uint160 sqrtPriceX96 = 79228162514264337593543950336; // price = 1
        pool.initialize(sqrtPriceX96);

        vm.startPrank(alice);
        tokenA.approve(address(pool), type(uint256).max);
        tokenB.approve(address(pool), type(uint256).max);

        pool.mint(alice, -60, 60, 1000 * 1e18, "");

        pool.mint(alice, -120, -60, 500 * 1e18, "");

        pool.mint(alice, 60, 120, 500 * 1e18, "");

        bytes32 positionKey1 = keccak256(abi.encodePacked(alice, int24(-60), int24(60)));
        bytes32 positionKey2 = keccak256(abi.encodePacked(alice, int24(-120), int24(-60)));
        bytes32 positionKey3 = keccak256(abi.encodePacked(alice, int24(60), int24(120)));

        (uint128 liquidity1,,,,) = pool.positions(positionKey1);
        (uint128 liquidity2,,,,) = pool.positions(positionKey2);
        (uint128 liquidity3,,,,) = pool.positions(positionKey3);

        assertEq(liquidity1, 1000 * 1e18);
        assertEq(liquidity2, 500 * 1e18);
        assertEq(liquidity3, 500 * 1e18);

        vm.stopPrank();
    }
}
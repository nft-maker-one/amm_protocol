// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IAMMFactory.sol";
import "./AMMPool.sol";

contract AMMFactory is IAMMFactory {
    address public override owner;

    mapping(uint24 => int24) public override feeAmountTickSpacing;
    mapping(address => mapping(address => mapping(uint24 => address))) public override getPool;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit FeeAmountEnabled(3000, 60);
        feeAmountTickSpacing[3000] = 60;

        emit FeeAmountEnabled(500, 10);
        feeAmountTickSpacing[500] = 10;

        emit FeeAmountEnabled(10000, 200);
        feeAmountTickSpacing[10000] = 200;
    }

    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external override returns (address pool) {
        require(tokenA != tokenB, "Identical tokens");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "Zero address");

        int24 tickSpacing = feeAmountTickSpacing[fee];
        require(tickSpacing != 0, "Invalid fee");
        require(getPool[token0][token1][fee] == address(0), "Pool exists");

        pool = address(new AMMPool{
            salt: keccak256(abi.encode(token0, token1, fee))
        }());

        AMMPool(pool).initialize(token0, token1, fee, tickSpacing);

        getPool[token0][token1][fee] = pool;
        getPool[token1][token0][fee] = pool;

        emit PoolCreated(token0, token1, fee, tickSpacing, pool);
    }

    function enableFeeAmount(uint24 fee, int24 tickSpacing) external override onlyOwner {
        require(fee < 1000000, "Fee too high");
        require(tickSpacing > 0 && tickSpacing < 16384, "Invalid tick spacing");
        require(feeAmountTickSpacing[fee] == 0, "Fee already enabled");

        feeAmountTickSpacing[fee] = tickSpacing;
        emit FeeAmountEnabled(fee, tickSpacing);
    }
}
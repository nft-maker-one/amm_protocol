// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IAMMPool.sol";
import "./libraries/TickMath.sol";
import "./libraries/LiquidityMath.sol";
import "./libraries/Oracle.sol";
import "./libraries/VolatilityOracle.sol";

contract AMMPool is IAMMPool {
    using SafeERC20 for IERC20;
    using Oracle for Oracle.Observation[65535];

    struct Slot0 {
        uint160 sqrtPriceX96;
        int24 tick;
        uint16 observationIndex;
        uint16 observationCardinality;
        uint16 observationCardinalityNext;
        uint8 feeProtocol;
        bool unlocked;
    }

    struct TickInfo {
        uint128 liquidityGross;
        int128 liquidityNet;
        uint256 feeGrowthOutside0X128;
        uint256 feeGrowthOutside1X128;
        int56 tickCumulativeOutside;
        uint160 secondsPerLiquidityOutsideX128;
        uint32 secondsOutside;
        bool initialized;
    }

    address public override token0;
    address public override token1;
    uint24 public override fee;
    int24 public override tickSpacing;
    uint128 public override maxLiquidityPerTick;

    Slot0 public slot0_;
    uint256 public override feeGrowthGlobal0X128;
    uint256 public override feeGrowthGlobal1X128;
    uint128 public override liquidity;

    // Separate lock variable to avoid struct storage issues
    bool private _locked;

    mapping(bytes32 => Position) public override positions;
    mapping(int24 => TickInfo) public override ticks;
    Oracle.Observation[65535] public override observations;

    modifier lock() {
        require(!_locked, "Locked");
        _locked = true;
        _;
        _locked = false;
    }

    function initialize(
        address _token0,
        address _token1,
        uint24 _fee,
        int24 _tickSpacing
    ) external {
        require(token0 == address(0) && token1 == address(0), "Already initialized");

        token0 = _token0;
        token1 = _token1;
        fee = _fee;
        tickSpacing = _tickSpacing;
        maxLiquidityPerTick = type(uint128).max / 2;

        // Lock initialization no longer needed - using separate _locked variable
    }

    function initialize(uint160 sqrtPriceX96) external override {
        require(slot0_.sqrtPriceX96 == 0, "Already initialized");

        int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);

        slot0_ = Slot0({
            sqrtPriceX96: sqrtPriceX96,
            tick: tick,
            observationIndex: 0,
            observationCardinality: 1,
            observationCardinalityNext: 1,
            feeProtocol: 0,
            unlocked: true  // Keep for compatibility but not used for locking
        });

        (slot0_.observationIndex, slot0_.observationCardinality) = observations.write(
            Oracle.WriteParams({
                blockTimestamp: uint32(block.timestamp),
                tick: tick,
                liquidity: 0,
                index: 0,
                cardinality: 1,
                cardinalityNext: 1
            })
        );

        emit Initialize(sqrtPriceX96, tick);
    }

    function slot0()
        external
        view
        override
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        )
    {
        Slot0 memory slot0Data = slot0_;
        return (
            slot0Data.sqrtPriceX96,
            slot0Data.tick,
            slot0Data.observationIndex,
            slot0Data.observationCardinality,
            slot0Data.observationCardinalityNext,
            slot0Data.feeProtocol,
            !_locked  // Return the inverse of _locked for unlocked status
        );
    }

    function _getPositionKey(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(owner, tickLower, tickUpper));
    }

    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount,
        bytes calldata
    ) external override lock returns (uint256 amount0, uint256 amount1) {
        require(amount > 0, "Amount is zero");
        require(tickLower < tickUpper, "Invalid tick range");
        require(tickLower >= TickMath.MIN_TICK, "Tick too low");
        require(tickUpper <= TickMath.MAX_TICK, "Tick too high");
        require(tickLower % tickSpacing == 0, "Invalid tick lower");
        require(tickUpper % tickSpacing == 0, "Invalid tick upper");

        bytes32 positionKey = _getPositionKey(recipient, tickLower, tickUpper);
        Position storage position = positions[positionKey];

        uint160 sqrtPriceX96 = slot0_.sqrtPriceX96;
        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);

        if (sqrtPriceX96 < sqrtRatioAX96) {
            amount0 = LiquidityMath.getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, amount);
        } else if (sqrtPriceX96 < sqrtRatioBX96) {
            amount0 = LiquidityMath.getAmount0ForLiquidity(sqrtPriceX96, sqrtRatioBX96, amount);
            amount1 = LiquidityMath.getAmount1ForLiquidity(sqrtRatioAX96, sqrtPriceX96, amount);
            liquidity = LiquidityMath.addDelta(liquidity, int128(amount));
        } else {
            amount1 = LiquidityMath.getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, amount);
        }

        position.liquidity = LiquidityMath.addDelta(position.liquidity, int128(amount));

        _updateTick(tickLower, int128(amount), false);
        _updateTick(tickUpper, int128(amount), true);

        if (amount0 > 0) IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        if (amount1 > 0) IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);

        emit Mint(msg.sender, recipient, tickLower, tickUpper, amount, amount0, amount1);
    }

    function burn(
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external override lock returns (uint256 amount0, uint256 amount1) {
        require(amount > 0, "Amount is zero");

        bytes32 positionKey = _getPositionKey(msg.sender, tickLower, tickUpper);
        Position storage position = positions[positionKey];
        require(position.liquidity >= amount, "Insufficient liquidity");

        uint160 sqrtPriceX96 = slot0_.sqrtPriceX96;
        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);

        if (sqrtPriceX96 < sqrtRatioAX96) {
            amount0 = LiquidityMath.getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, amount);
        } else if (sqrtPriceX96 < sqrtRatioBX96) {
            amount0 = LiquidityMath.getAmount0ForLiquidity(sqrtPriceX96, sqrtRatioBX96, amount);
            amount1 = LiquidityMath.getAmount1ForLiquidity(sqrtRatioAX96, sqrtPriceX96, amount);
            liquidity = LiquidityMath.addDelta(liquidity, -int128(amount));
        } else {
            amount1 = LiquidityMath.getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, amount);
        }

        position.liquidity = LiquidityMath.addDelta(position.liquidity, -int128(amount));

        _updateTick(tickLower, -int128(amount), false);
        _updateTick(tickUpper, -int128(amount), true);

        position.tokensOwed0 += uint128(amount0);
        position.tokensOwed1 += uint128(amount1);

        emit Burn(msg.sender, tickLower, tickUpper, amount, amount0, amount1);
    }

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata
    ) external override lock returns (int256 amount0, int256 amount1) {
        require(amountSpecified != 0, "Amount is zero");
        require(liquidity > 0, "No liquidity");

        Slot0 memory slot0Start = slot0_;

        (slot0_.observationIndex, slot0_.observationCardinality) = observations.write(
            Oracle.WriteParams({
                blockTimestamp: uint32(block.timestamp),
                tick: slot0Start.tick,
                liquidity: liquidity,
                index: slot0Start.observationIndex,
                cardinality: slot0Start.observationCardinality,
                cardinalityNext: slot0Start.observationCardinalityNext
            })
        );

        require(
            zeroForOne
                ? sqrtPriceLimitX96 < slot0Start.sqrtPriceX96 && sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO
                : sqrtPriceLimitX96 > slot0Start.sqrtPriceX96 && sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO,
            "Invalid price limit"
        );

        bool exactInput = amountSpecified > 0;

        if (exactInput) {
            uint256 amountIn = uint256(amountSpecified);
            
            {
                uint24 currentFee = fee;
                if (slot0_.observationCardinality > 1) {
                     uint256 volatility = VolatilityOracle.calculateVolatility(
                         observations,
                         uint32(block.timestamp),
                         slot0_.tick,
                         slot0_.observationIndex,
                         liquidity,
                         slot0_.observationCardinality,
                         300 // 5 minute window
                     );
                     currentFee = VolatilityOracle.getDynamicFee(volatility, fee);
                }

                uint256 feeAmount = (amountIn * currentFee) / 1000000;
                amountIn = amountIn - feeAmount;
            }

            // Simple constant product for basic functionality
            uint256 balance0 = IERC20(token0).balanceOf(address(this));
            uint256 balance1 = IERC20(token1).balanceOf(address(this));

            uint256 amountOut;
            if (zeroForOne) {
                // Selling token0 for token1
                amountOut = (amountIn * balance1) / (balance0 + amountIn);
                amount0 = amountSpecified;
                amount1 = -int256(amountOut);
            } else {
                // Selling token1 for token0
                amountOut = (amountIn * balance0) / (balance1 + amountIn);
                amount1 = amountSpecified;
                amount0 = -int256(amountOut);
            }

            // Transfer tokens
            if (amount0 > 0) {
                IERC20(token0).safeTransferFrom(msg.sender, address(this), uint256(amount0));
            } else if (amount0 < 0) {
                IERC20(token0).safeTransfer(recipient, uint256(-amount0));
            }

            if (amount1 > 0) {
                IERC20(token1).safeTransferFrom(msg.sender, address(this), uint256(amount1));
            } else if (amount1 < 0) {
                IERC20(token1).safeTransfer(recipient, uint256(-amount1));
            }

            // Update price (simplified)
            uint256 newBalance0 = IERC20(token0).balanceOf(address(this));
            uint256 newBalance1 = IERC20(token1).balanceOf(address(this));

            if (newBalance0 > 0 && newBalance1 > 0) {
                // Simple price update based on ratio
                uint256 priceRatio = (newBalance1 * (1 << 96)) / newBalance0;
                slot0_.sqrtPriceX96 = uint160(_sqrt(priceRatio) << 48);
                slot0_.tick = TickMath.getTickAtSqrtRatio(slot0_.sqrtPriceX96);
            }
        }

        emit Swap(msg.sender, recipient, amount0, amount1, slot0_.sqrtPriceX96, liquidity, slot0_.tick);
    }

    function _sqrt(uint256 x) private pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    function collect(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount0Requested,
        uint128 amount1Requested
    ) external override lock returns (uint128 amount0, uint128 amount1) {
        bytes32 positionKey = _getPositionKey(msg.sender, tickLower, tickUpper);
        Position storage position = positions[positionKey];

        amount0 = amount0Requested > position.tokensOwed0 ? position.tokensOwed0 : amount0Requested;
        amount1 = amount1Requested > position.tokensOwed1 ? position.tokensOwed1 : amount1Requested;

        if (amount0 > 0) {
            position.tokensOwed0 -= amount0;
            IERC20(token0).safeTransfer(recipient, amount0);
        }

        if (amount1 > 0) {
            position.tokensOwed1 -= amount1;
            IERC20(token1).safeTransfer(recipient, amount1);
        }

        emit CollectFees(msg.sender, recipient, tickLower, tickUpper, amount0, amount1);
    }

    function _updateTick(
        int24 tick,
        int128 liquidityDelta,
        bool upper
    ) private {
        TickInfo storage tickInfo = ticks[tick];

        uint128 liquidityGrossBefore = tickInfo.liquidityGross;
        uint128 liquidityGrossAfter = LiquidityMath.addDelta(liquidityGrossBefore, liquidityDelta);

        require(liquidityGrossAfter <= maxLiquidityPerTick, "Liquidity overflow");

        tickInfo.liquidityGross = liquidityGrossAfter;

        if (upper) {
            tickInfo.liquidityNet = tickInfo.liquidityNet - liquidityDelta;
        } else {
            tickInfo.liquidityNet = tickInfo.liquidityNet + liquidityDelta;
        }

        if (liquidityGrossBefore == 0) {
            tickInfo.initialized = true;
        }
    }

    function increaseObservationCardinalityNext(uint16 observationCardinalityNext) external override lock {
        // uint16 observationCardinalityNextOld = slot0_.observationCardinalityNext; // for the event
        uint16 observationCardinalityNextNew = observations.grow(
            slot0_.observationIndex,
            slot0_.observationCardinality,
            observationCardinalityNext
        );
        slot0_.observationCardinalityNext = observationCardinalityNextNew;
        // emit IncreaseObservationCardinalityNext(observationCardinalityNextOld, observationCardinalityNextNew);
    }

    function observe(uint32[] calldata secondsAgos)
        external
        view
        override
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        return
            observations.observe(
                uint32(block.timestamp),
                secondsAgos,
                slot0_.tick,
                slot0_.observationIndex,
                liquidity,
                slot0_.observationCardinality
            );
    }

    function _getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) private pure returns (uint256 amountOut) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");

        uint256 numerator = amountIn * reserveOut;
        uint256 denominator = reserveIn + amountIn;
        amountOut = numerator / denominator;
    }
}
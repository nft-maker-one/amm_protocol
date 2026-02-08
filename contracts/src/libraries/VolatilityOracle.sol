// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Oracle.sol";

/// @title Volatility Oracle
/// @notice Helper library to calculate volatility from Oracle observations
library VolatilityOracle {
    /// @notice Calculates the realized volatility between two observations
    /// @dev Uses the difference in tick cumulative values to estimate volatility
    /// @param oracle The oracle array
    /// @param observationIndex The index of the most recent observation
    /// @param observationCardinality The cardinality of the oracle
    /// @param tick The current tick
    /// @param windowSize The time window to calculate volatility over (in seconds)
    /// @return volatility The calculated volatility metric (tick movement per second scaled)
    function calculateVolatility(
        Oracle.Observation[65535] storage oracle,
        uint32 blockTimestamp,
        int24 tick,
        uint16 observationIndex,
        uint128 liquidity,
        uint16 observationCardinality,
        uint32 windowSize
    ) internal view returns (uint256 volatility) {
        // We need at least 2 observations to calculate volatility
        if (observationCardinality < 2) return 0;

        uint32 timeStart = blockTimestamp - windowSize;
        
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = windowSize;
        secondsAgos[1] = 0; // consistent with current time

        (int56[] memory tickCumulatives, ) = oracle.observe(
            blockTimestamp,
            secondsAgos,
            tick,
            observationIndex,
            liquidity,
            observationCardinality
        );

        int56 tickCumulativesStart = tickCumulatives[0];
        int56 tickCumulativesEnd = tickCumulatives[1];

        // volatility = |(tickEnd - tickStart) / time| ? 
        // TWAP = (tickCumulativesEnd - tickCumulativesStart) / windowSize
        // That gives us the AVERAGE price over the window.
        // But volatility is the VARIANCE or deviation.
        // Calculating true variance requires more data points (sum of squares).
        // For on-chain gas efficiency, we can use a simpler metric:
        // Compare the instantaneous price (current tick) vs the TWAP price.
        // volatility ~= |currentTick - TWAP_tick|
        
        int56 tickAverage = (tickCumulativesEnd - tickCumulativesStart) / int56(int32(windowSize));
        
        int256 deviation = int256(int56(tick)) - int256(tickAverage);
        if (deviation < 0) {
            volatility = uint256(-deviation);
        } else {
            volatility = uint256(deviation);
        }
    }

    /// @notice Returns the fee tier based on volatility
    /// @param volatility The calculated volatility
    /// @param baseFee The base fee tier
    /// @return fee The adjusted fee tier
    function getDynamicFee(uint256 volatility, uint24 baseFee) internal pure returns (uint24) {
        // If volatility is low (e.g. < 5 ticks deviation), stick to base fee
        if (volatility < 10) {
            return baseFee;
        }
        // If volatility is medium (10-50 ticks), 2x the fee
        else if (volatility < 50) {
            return baseFee * 2;
        }
        // If volatility is high (> 50 ticks), 5x the fee (capped at 10%)
        else {
            uint24 highFee = baseFee * 5;
            if (highFee > 100000) return 100000; // Cap at 10%
            return highFee;
        }
    }
}

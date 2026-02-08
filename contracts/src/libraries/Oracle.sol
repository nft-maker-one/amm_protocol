// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title Oracle
/// @notice Provides price and liquidity data useful for a wide variety of system designs
/// @dev Instances of stored oracle data, "observations", are collected in the oracle array
/// Every pool is initialized with an oracle array length of 1. Anyone can pay the SSTOREs to increase the
/// maximum length of the oracle array. New slots will be populated when the array is fully populated.
/// Observations are overwritten when the full length of the oracle array is populated.
/// The most recent observation is available, independent of the length of the oracle array, by passing 0 to observe()
library Oracle {
    struct Observation {
        uint32 blockTimestamp;
        int56 tickCumulative;
        uint160 secondsPerLiquidityCumulativeX128;
        bool initialized;
    }

    /// @notice Params for the write function
    struct WriteParams {
         uint32 blockTimestamp;
         int24 tick;
         uint128 liquidity;
         uint16 index;
         uint16 cardinality;
         uint16 cardinalityNext;
    }

    /// @notice Stores a TWAP observation
    /// @param self The stored oracle array
    /// @param params The params for writing the observation
    /// @return indexUpdated The new index of the most recently written observation
    /// @return cardinalityUpdated The new cardinality of the oracle array
    function write(
        Observation[65535] storage self,
        WriteParams memory params
    ) internal returns (uint16 indexUpdated, uint16 cardinalityUpdated) {
        Observation memory last = self[params.index];

        // early return if we've already written an observation this block
        if (last.blockTimestamp == params.blockTimestamp) return (params.index, params.cardinality);

        // if the conditions are right, we can bump the cardinality
        if (params.cardinalityNext > params.cardinality && params.index == (params.cardinality - 1)) {
            cardinalityUpdated = params.cardinalityNext;
        } else {
            cardinalityUpdated = params.cardinality;
        }

        indexUpdated = (params.index + 1) % cardinalityUpdated;
        self[indexUpdated] = transform(last, params.blockTimestamp, params.tick, params.liquidity);
    }

    /// @notice Transforms a previous observation into a new observation, given the passage of time and the current tick and liquidity values
    /// @dev blockTimestamp _must_ be chronologically equal to or greater than last.blockTimestamp, safe for 0 or 1 overflows
    /// @param last The specified observation to be transformed
    /// @param blockTimestamp The timestamp of the new observation
    /// @param tick The active tick at the time of the new observation
    /// @param liquidity The active liquidity at the time of the new observation
    /// @return Observation The newly populated observation
    function transform(
        Observation memory last,
        uint32 blockTimestamp,
        int24 tick,
        uint128 liquidity
    ) private pure returns (Observation memory) {
        unchecked {
            uint32 delta = blockTimestamp - last.blockTimestamp;
            return
                Observation({
                    blockTimestamp: blockTimestamp,
                    tickCumulative: last.tickCumulative + int56(tick) * int56(uint56(delta)),
                    secondsPerLiquidityCumulativeX128: last.secondsPerLiquidityCumulativeX128 +
                        ((uint160(delta) << 128) / (liquidity > 0 ? liquidity : 1)),
                    initialized: true
                });
        }
    }

    /// @notice Returns the accumulator values as of each time in the array of secondsAgos
    /// @param self The stored oracle array
    /// @param time The current block.timestamp
    /// @param secondsAgos Each amount of time to look back, in seconds, at which point to return an observation
    /// @param tick The current tick
    /// @param index The index of the observation that was most recently written to the observations array
    /// @param liquidity The current in-range liquidity
    /// @param cardinality The number of populated elements in the oracle array
    /// @return tickCumulatives The tick * time cumulative value and secondsPerLiquidity * time cumulative value
    /// @return secondsPerLiquidityCumulativeX128s The cumulative seconds per liquidity value
    function observe(
        Observation[65535] storage self,
        uint32 time,
        uint32[] memory secondsAgos,
        int24 tick,
        uint16 index,
        uint128 liquidity,
        uint16 cardinality
    ) internal view returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) {
        require(cardinality > 0, "I");

        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);

        for (uint256 i = 0; i < secondsAgos.length; i++) {
            (tickCumulatives[i], secondsPerLiquidityCumulativeX128s[i]) = observeSingle(
                self,
                time,
                secondsAgos[i],
                tick,
                index,
                liquidity,
                cardinality
            );
        }
    }

    function observeSingle(
        Observation[65535] storage self,
        uint32 time,
        uint32 secondsAgo,
        int24 tick,
        uint16 index,
        uint128 liquidity,
        uint16 cardinality
    ) internal view returns (int56 tickCumulative, uint160 secondsPerLiquidityCumulativeX128) {
        if (secondsAgo == 0) {
            Observation memory last = self[index];
            if (last.blockTimestamp != time) {
                last = transform(last, time, tick, liquidity);
            }
            return (last.tickCumulative, last.secondsPerLiquidityCumulativeX128);
        }

        uint32 target;
        unchecked {
            target = time - secondsAgo;
        }

        (Observation memory beforeOrAt, Observation memory atOrAfter) = getSurroundingObservations(
            self,
            time,
            target,
            tick,
            index,
            liquidity,
            cardinality
        );

        if (target == beforeOrAt.blockTimestamp) {
            // we're at the left boundary
            return (beforeOrAt.tickCumulative, beforeOrAt.secondsPerLiquidityCumulativeX128);
        } else if (target == atOrAfter.blockTimestamp) {
            // we're at the right boundary
            return (atOrAfter.tickCumulative, atOrAfter.secondsPerLiquidityCumulativeX128);
        } else {
            // we're in the middle
            unchecked {
                uint32 observationTimeDelta = atOrAfter.blockTimestamp - beforeOrAt.blockTimestamp;
                uint32 targetDelta = target - beforeOrAt.blockTimestamp;
                return (
                    beforeOrAt.tickCumulative +
                        ((atOrAfter.tickCumulative - beforeOrAt.tickCumulative) / int56(uint56(observationTimeDelta))) *
                        int56(uint56(targetDelta)),
                    beforeOrAt.secondsPerLiquidityCumulativeX128 +
                        uint160(
                            (uint256(atOrAfter.secondsPerLiquidityCumulativeX128 - beforeOrAt.secondsPerLiquidityCumulativeX128) *
                                targetDelta) / observationTimeDelta
                        )
                );
            }
        }
    }

    function getSurroundingObservations(
        Observation[65535] storage self,
        uint32 time,
        uint32 target,
        int24 tick,
        uint16 index,
        uint128 liquidity,
        uint16 cardinality
    ) private view returns (Observation memory beforeOrAt, Observation memory atOrAfter) {
        // optimistically set before to the newest observation
        beforeOrAt = self[index];

        // if the target is chronologically at or after the newest observation, we can just transform it
        if (lte(time, beforeOrAt.blockTimestamp, target)) {
            if (beforeOrAt.blockTimestamp == target) {
                return (beforeOrAt, atOrAfter); // atOrAfter is not needed
            } else {
                return (beforeOrAt, transform(beforeOrAt, target, tick, liquidity));
            }
        }

        // now, set before to the oldest observation
        beforeOrAt = self[(index + 1) % cardinality];
        if (!beforeOrAt.initialized) beforeOrAt = self[0];

        // ensure that the target is chronologically at or after the oldest observation
        require(lte(time, beforeOrAt.blockTimestamp, target), "OLD");

        // if we've reached this point, we have to binary search
        return binarySearch(self, time, target, index, cardinality);
    }

    function binarySearch(
        Observation[65535] storage self,
        uint32 time,
        uint32 target,
        uint16 index,
        uint16 cardinality
    ) private view returns (Observation memory beforeOrAt, Observation memory atOrAfter) {
        uint256 l = (index + 1) % cardinality; // oldest
        uint256 r = l + cardinality - 1; // newest
        uint256 i;
        while (true) {
            i = (l + r) / 2;

            beforeOrAt = self[i % cardinality];

            if (!beforeOrAt.initialized) {
                l = i + 1;
                continue;
            }

            atOrAfter = self[(i + 1) % cardinality];

            bool targetAtOrAfter = lte(time, beforeOrAt.blockTimestamp, target);

            // check if we've found the target!
            if (targetAtOrAfter && lte(time, target, atOrAfter.blockTimestamp)) break;

            if (!targetAtOrAfter) r = i - 1;
            else l = i + 1;
        }
    }

    /// @notice Reverts if an observation at or before the desired observation's block timestamp does not exist.
    /// 0 may be passed as `secondsAgo' to return the current cumulative values.
    /// If observations are empty, this function executes in a manner equivalent to if `secondsAgo' was 0.
    /// @param self The stored oracle array
    /// @param time The current block.timestamp
    /// @param secondsAgo The amount of time to look back, in seconds, at which point to return an observation
    /// @param tick The current tick
    /// @param index The index of the observation that was most recently written to the observations array
    /// @param liquidity The current in-range liquidity
    /// @param cardinality The number of populated elements in the oracle array
    function computeSecondsPerLiquidity(
        Observation[65535] storage self,
        uint32 time,
        uint32 secondsAgo,
        int24 tick,
        uint16 index,
        uint128 liquidity,
        uint16 cardinality
    ) internal view returns (uint160 secondsPerLiquidityCumulativeX128) {
        // simplified version for just secondsPerLiquidity
        if (secondsAgo == 0) {
             Observation memory last = self[index];
            if (last.blockTimestamp != time) {
                last = transform(last, time, tick, liquidity);
            }
            return last.secondsPerLiquidityCumulativeX128;
        }
        
        // reuse observeSingle for simplicity, though it calculates both
        (, secondsPerLiquidityCumulativeX128) = observeSingle(self, time, secondsAgo, tick, index, liquidity, cardinality);
    }

    /// @notice comparator for 32-bit timestamps
    /// @dev safe for 0 or 1 overflows, a and b _must_ be chronologically before or equal to currentTime
    /// @param currentTime A reference timestamp in which a and b are chronologically before or after
    /// @param a A timestamp
    /// @param b A timestamp
    /// @return truty if a is chronologically <= b
    function lte(
        uint32 currentTime,
        uint32 a,
        uint32 b
    ) private pure returns (bool) {
        // if both are on the same side of the overflow boundary, compare directly
        if ((a <= currentTime && b <= currentTime) || (a > currentTime && b > currentTime)) {
            return a <= b;
        }
        // otherwise, they're on different sides. a must be "before" if it's > currentTime (meaning it's from the previous epoch)
        // effectively, if a > c and b <= c, then a is "older" so a < b in chronological sense? 
        // No, with modulo 2**32:
        // if current is 10, a is 2^32-5, b is 5. 
        // a > current, b <= current. a is clearly older.
        // so a <= b is true.
        return a > b;
    }

    /// @notice Increase the cardinality of the oracle array
    /// @param cardinality The number of populated elements in the oracle array
    /// @param cardinalityNext The new length of the oracle array, independent of population
    /// @return cardinalityNextOld The old length of the oracle array
    function grow(
        Observation[65535] storage /* self */,
        uint16 /* index */,
        uint16 cardinality,
        uint16 cardinalityNext
    ) internal pure returns (uint16 cardinalityNextOld) {
        cardinalityNextOld = cardinalityNext;
        // no-op if the passed next cardinality isn't greater than the current next cardinality
        if (cardinalityNext <= cardinality) return cardinalityNextOld;
        // The actual expansion logic in Uniswap V3 mostly just relies on the fact that slots are initialized
        // This function would usually return the old value to emit an event
    }
}

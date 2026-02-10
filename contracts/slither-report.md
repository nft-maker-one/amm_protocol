'forge clean' running (wd: /src) 
'forge config --json' running 
'forge build --build-info --skip */test/** */script/** --force' running (wd: /src)



INFO:Detectors: 

FullMath.mulDiv(uint256,uint256,uint256) (src/libraries/LiquidityMath.sol#79-127) has bitwise-xor operator ^ instead of the exponentiation operator **:  

​	inverse = (3 * denominator) ^ 2 (src/libraries/LiquidityMath.sol#116)  

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#incorrect-exponentiation 



INFO:Detectors: 

FullMath.mulDiv(uint256,uint256,uint256) (src/libraries/LiquidityMath.sol#79-127) performs a multiplication on the result of a division:  

​	denominator = denominator / twos (src/libraries/LiquidityMath.sol#109)  

​	inverse = (3 * denominator) ^ 2 (src/libraries/LiquidityMath.sol#116) 

FullMath.mulDiv(uint256,uint256,uint256) (src/libraries/LiquidityMath.sol#79-127) performs a multiplication on the result of a division:  

​	denominator = denominator / twos (src/libraries/LiquidityMath.sol#109)  

​	inverse *= 2 - denominator * inverse (src/libraries/LiquidityMath.sol#118)  

FullMath.mulDiv(uint256,uint256,uint256) (src/libraries/LiquidityMath.sol#79-127) performs a multiplication on the result of a division:  

​	denominator = denominator / twos (src/libraries/LiquidityMath.sol#109)  

​	inverse *= 2 - denominator * inverse (src/libraries/LiquidityMath.sol#119) 

FullMath.mulDiv(uint256,uint256,uint256) (src/libraries/LiquidityMath.sol#79-127) performs a multiplication on the result of a division:  

​	denominator = denominator / twos (src/libraries/LiquidityMath.sol#109)

​	inverse *= 2 - denominator * inverse (src/libraries/LiquidityMath.sol#120)  

FullMath.mulDiv(uint256,uint256,uint256) (src/libraries/LiquidityMath.sol#79-127) performs a multiplication on the result of a division:  

​	denominator = denominator / twos (src/libraries/LiquidityMath.sol#109)  

​	inverse *= 2 - denominator * inverse (src/libraries/LiquidityMath.sol#121)  

FullMath.mulDiv(uint256,uint256,uint256) (src/libraries/LiquidityMath.sol#79-127) performs a multiplication on the result of a division:  

​	denominator = denominator / twos (src/libraries/LiquidityMath.sol#109)  

​	inverse *= 2 - denominator * inverse (src/libraries/LiquidityMath.sol#122) 

FullMath.mulDiv(uint256,uint256,uint256) (src/libraries/LiquidityMath.sol#79-127) performs a multiplication on the result of a division:  

​	denominator = denominator / twos (src/libraries/LiquidityMath.sol#109)  

​	inverse *= 2 - denominator * inverse (src/libraries/LiquidityMath.sol#123)  

FullMath.mulDiv(uint256,uint256,uint256) (src/libraries/LiquidityMath.sol#79-127) performs a multiplication on the result of a division:

​	prod0 = prod0 / twos (src/libraries/LiquidityMath.sol#110)

​	result = prod0 * inverse (src/libraries/LiquidityMath.sol#125)

Oracle.observeSingle(Oracle.Observation[65535],uint32,uint32,int24,uint16,uint128,uint16) (src/libraries/Oracle.sol#115-165) performs a multiplication on the result of a division:

​	(beforeOrAt.tickCumulative + ((atOrAfter.tickCumulative - beforeOrAt.tickCumulative) / int56(uint56(observationTimeDelta))) * int56(uint56(targetDelta)),beforeOrAt.secondsPerLiquidityCumulativeX128 + uint160((uint256(atOrAfter.secondsPerLiquidityCumulativeX128 - beforeOrAt.secondsPerLiquidityCumulativeX128) * targetDelta) / observationTimeDelta)) (src/libraries/Oracle.sol#154-163)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128 (src/libraries/TickMath.sol#35)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128 (src/libraries/TickMath.sol#34)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128 (src/libraries/TickMath.sol#33)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128 (src/libraries/TickMath.sol#32)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128 (src/libraries/TickMath.sol#31)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128 (src/libraries/TickMath.sol#30)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128 (src/libraries/TickMath.sol#29)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128 (src/libraries/TickMath.sol#28)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128 (src/libraries/TickMath.sol#27)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128 (src/libraries/TickMath.sol#26)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128 (src/libraries/TickMath.sol#25)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128 (src/libraries/TickMath.sol#24)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128 (src/libraries/TickMath.sol#23)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128 (src/libraries/TickMath.sol#22)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128 (src/libraries/TickMath.sol#21)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128 (src/libraries/TickMath.sol#20)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128 (src/libraries/TickMath.sol#19)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128 (src/libraries/TickMath.sol#18)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) performs a multiplication on the result of a division:

​	ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128 (src/libraries/TickMath.sol#17)

​	ratio = type()(uint256).max / ratio (src/libraries/TickMath.sol#37)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#divide-before-multiply



INFO:Detectors:

AMMPool._sqrt(uint256) (src/AMMPool.sol#317-326) uses a dangerous strict equality:

​	x == 0 (src/AMMPool.sol#318)
AMMPool.initialize(uint160) (src/AMMPool.sol#79-106) uses a dangerous strict equality:

​	require(bool,string)(slot0_.sqrtPriceX96 == 0,Already initialized) (src/AMMPool.sol#80)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#dangerous-strict-equalities



INFO:Detectors:

Reentrancy in AMMFactory.createPool(address,address,uint24) (src/AMMFactory.sol#30-53):

External calls:

​	AMMPool(pool).initialize(token0,token1,fee,tickSpacing) (src/AMMFactory.sol#47)
State variables written after the call(s):

​	getPool[token0][token1][fee] = pool (src/AMMFactory.sol#49)

AMMFactory.getPool (src/AMMFactory.sol#11) can be used in cross function reentrancies:

​	AMMFactory.createPool(address,address,uint24) (src/AMMFactory.sol#30-53)

​	AMMFactory.getPool (src/AMMFactory.sol#11)

​	getPool[token1][token0][fee] = pool (src/AMMFactory.sol#50)

AMMFactory.getPool (src/AMMFactory.sol#11) can be used in cross function reentrancies:

​	AMMFactory.createPool(address,address,uint24) (src/AMMFactory.sol#30-53)

​	AMMFactory.getPool (src/AMMFactory.sol#11)

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-1



INFO:Detectors:

AMMPool.observe(uint32[]) (src/AMMPool.sol#390-405) ignores return value by observations.observe(uint32(block.timestamp),secondsAgos,slot0_.tick,slot0_.observationIndex,liquidity,slot0_.observationCardinality) (src/AMMPool.sol#396-404)

VolatilityOracle.calculateVolatility(Oracle.Observation[65535],uint32,int24,uint16,uint128,uint16,uint32) (src/libraries/VolatilityOracle.sol#18-65) ignores return value by (tickCumulatives,None) = oracle.observe(blockTimestamp,secondsAgos,tick,observationIndex,liquidity,observationCardinality) (src/libraries/VolatilityOracle.sol#36-43)

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#unused-return



INFO:Detectors:

MockToken.constructor(string,string,uint8,uint256).name (src/MockToken.sol#11) shadows:

​	ERC20.name() (lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol#52-54) (function)

​	IERC20Metadata.name() (lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol#15) (function)
MockToken.constructor(string,string,uint8,uint256).symbol (src/MockToken.sol#12) shadows:

​	ERC20.symbol() (lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol#60-62) (function)

​	IERC20Metadata.symbol() (lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol#20) (function)

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#local-variable-shadowing



INFO:Detectors:

AMMPool.initialize(address,address,uint24,int24)._token0 (src/AMMPool.sol#63) lacks a zero-check on :

​	token0 = _token0 (src/AMMPool.sol#70)
AMMPool.initialize(address,address,uint24,int24)._token1 (src/AMMPool.sol#64) lacks a zero-check on :

​	token1 = _token1 (src/AMMPool.sol#71)

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#missing-zero-address-validation



INFO:Detectors:

Reentrancy in AMMFactory.createPool(address,address,uint24) (src/AMMFactory.sol#30-53):

External calls:

​	AMMPool(pool).initialize(token0,token1,fee,tickSpacing) (src/AMMFactory.sol#47)
Event emitted after the call(s):

​	PoolCreated(token0,token1,fee,tickSpacing,pool) (src/AMMFactory.sol#52)

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-3



INFO:Detectors:

AMMPool.initialize(uint160) (src/AMMPool.sol#79-106) uses timestamp for comparisons

Dangerous comparisons:

​	require(bool,string)(slot0_.sqrtPriceX96 == 0,Already initialized) (src/AMMPool.sol#80)

AMMPool.swap(address,bool,int256,uint160,bytes) (src/AMMPool.sol#220-315) uses timestamp for comparisons

Dangerous comparisons:

​	slot0_.observationCardinality > 1 (src/AMMPool.sol#256)

​	amount0 > 0 (src/AMMPool.sol#290)

​	amount0 < 0 (src/AMMPool.sol#292)

​	amount1 > 0 (src/AMMPool.sol#296)

​	amount1 < 0 (src/AMMPool.sol#298)

​	require(bool,string)(sqrtPriceLimitX96 < slot0Start.sqrtPriceX96 && sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO,Invalid price limit) (src/AMMPool.sol#243-248)

​	require(bool,string)(sqrtPriceLimitX96 > slot0Start.sqrtPriceX96 && sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO,Invalid price limit) (src/AMMPool.sol#243-248)

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#block-timestamp



INFO:Detectors:

SafeERC20._safeTransfer(IERC20,address,uint256,bool) (lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#176-200) uses assembly

​	INLINE ASM (lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#179-199)

SafeERC20._safeTransferFrom(IERC20,address,address,uint256,bool) (lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#212-244) uses assembly

​	INLINE ASM (lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#221-243)

SafeERC20._safeApprove(IERC20,address,uint256,bool) (lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#255-279) uses assembly

​	INLINE ASM (lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#258-278)
FullMath.mulDiv(uint256,uint256,uint256) (src/libraries/LiquidityMath.sol#79-127) uses assembly

​	INLINE ASM (src/libraries/LiquidityMath.sol#88-92)

​	INLINE ASM (src/libraries/LiquidityMath.sol#101-105)

​	INLINE ASM (src/libraries/LiquidityMath.sol#108-112)

TickMath.getTickAtSqrtRatio(uint160) (src/libraries/TickMath.sol#42-185) uses assembly

​	INLINE ASM (src/libraries/TickMath.sol#50-54)

​	INLINE ASM (src/libraries/TickMath.sol#55-59)

​	INLINE ASM (src/libraries/TickMath.sol#60-64)

​	INLINE ASM (src/libraries/TickMath.sol#65-69)

​	INLINE ASM (src/libraries/TickMath.sol#70-74)

​	INLINE ASM (src/libraries/TickMath.sol#75-79)

​	INLINE ASM (src/libraries/TickMath.sol#80-84)

​	INLINE ASM (src/libraries/TickMath.sol#85-88)

​	INLINE ASM (src/libraries/TickMath.sol#95-100)

​	INLINE ASM (src/libraries/TickMath.sol#101-106)

​	INLINE ASM (src/libraries/TickMath.sol#107-112)

​	INLINE ASM (src/libraries/TickMath.sol#113-118)

​	INLINE ASM (src/libraries/TickMath.sol#119-124)

​	INLINE ASM (src/libraries/TickMath.sol#125-130)

​	INLINE ASM (src/libraries/TickMath.sol#131-136)

​	INLINE ASM (src/libraries/TickMath.sol#137-142)

​	INLINE ASM (src/libraries/TickMath.sol#143-148)

​	INLINE ASM (src/libraries/TickMath.sol#149-154)

​	INLINE ASM (src/libraries/TickMath.sol#155-160)

​	INLINE ASM (src/libraries/TickMath.sol#161-166)

​	INLINE ASM (src/libraries/TickMath.sol#167-172)

​	INLINE ASM (src/libraries/TickMath.sol#173-177)

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#assembly-usage



INFO:Detectors:

6 different versions of Solidity are used:

Version constraint ^0.8.20 is used by:
	-^0.8.20 (lib/openzeppelin-contracts/contracts/access/Ownable.sol#4)
	-^0.8.20 (lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol#4)
	-^0.8.20 (lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#4)
	-^0.8.20 (lib/openzeppelin-contracts/contracts/utils/Context.sol#4)

Version constraint >=0.6.2 is used by:
	->=0.6.2 (lib/openzeppelin-contracts/contracts/interfaces/IERC1363.sol#4)
	->=0.6.2 (lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol#4)

Version constraint >=0.4.16 is used by:
	->=0.4.16 (lib/openzeppelin-contracts/contracts/interfaces/IERC165.sol#4)
	->=0.4.16 (lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol#4)
	->=0.4.16 (lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol#4)
	->=0.4.16 (lib/openzeppelin-contracts/contracts/utils/introspection/IERC165.sol#4)

Version constraint >=0.8.4 is used by:
	->=0.8.4 (lib/openzeppelin-contracts/contracts/interfaces/draft-IERC6093.sol#4)

Version constraint ^0.8.19 is used by:
	-^0.8.19 (src/AMMFactory.sol#2)
	-^0.8.19 (src/AMMPool.sol#2)
	-^0.8.19 (src/MockToken.sol#2)
	-^0.8.19 (src/interfaces/IAMMFactory.sol#2)
	-^0.8.19 (src/interfaces/IAMMPool.sol#2)
	-^0.8.19 (src/libraries/LiquidityMath.sol#2)
	-^0.8.19 (src/libraries/Oracle.sol#2)
	-^0.8.19 (src/libraries/TickMath.sol#2)
	-^0.8.19 (src/libraries/VolatilityOracle.sol#2)

Version constraint ^0.8.13 is used by:
	-^0.8.13 (src/Counter.sol#2)

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#different-pragma-directives-are-used



INFO:Detectors:

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) has a high cyclomatic complexity (24).

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#cyclomatic-complexity



INFO:Detectors:

AMMPool._getAmountOut(uint256,uint256,uint256) (src/AMMPool.sol#407-418) is never used and should be removed

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#dead-code



INFO:Detectors:
Version constraint ^0.8.20 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)

​	VerbatimInvalidDeduplication

​	FullInlinerNonExpressionSplitArgumentEvaluationOrder

​	MissingSideEffectsOnSelectorAccess.
It is used by:

​	^0.8.20 (lib/openzeppelin-contracts/contracts/access/Ownable.sol#4)

​	^0.8.20 (lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol#4)

​	^0.8.20 (lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#4)

​	^0.8.20 (lib/openzeppelin-contracts/contracts/utils/Context.sol#4)
Version constraint >=0.6.2 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)

​	MissingSideEffectsOnSelectorAccess

​	AbiReencodingHeadOverflowWithStaticArrayCleanup

​	DirtyBytesArrayToStorage

​	NestedCalldataArrayAbiReencodingSizeValidation

​	ABIDecodeTwoDimensionalArrayMemory

​	KeccakCaching

​	EmptyByteArrayCopy

​	DynamicArrayCleanup

​	MissingEscapingInFormatting

​	ArraySliceDynamicallyEncodedBaseType

​	ImplicitConstructorCallvalueCheck

​	TupleAssignmentMultiStackSlotComponents

​	MemoryArrayCreationOverflow.
It is used by:

​	=0.6.2 (lib/openzeppelin-contracts/contracts/interfaces/IERC1363.sol#4)

​	=0.6.2 (lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol#4)

Version constraint >=0.4.16 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)

​	DirtyBytesArrayToStorage

​	ABIDecodeTwoDimensionalArrayMemory

​	KeccakCaching

​	EmptyByteArrayCopy

​	DynamicArrayCleanup

​	ImplicitConstructorCallvalueCheck

​	TupleAssignmentMultiStackSlotComponents

​	MemoryArrayCreationOverflow

​	privateCanBeOverridden

​	SignedArrayStorageCopy

​	ABIEncoderV2StorageArrayWithMultiSlotElement

​	DynamicConstructorArgumentsClippedABIV2

​	UninitializedFunctionPointerInConstructor_0.4.x

​	IncorrectEventSignatureInLibraries_0.4.x

​	ExpExponentCleanup

​	NestedArrayFunctionCallDecoder

​	ZeroFunctionSelector.
It is used by:

​	=0.4.16 (lib/openzeppelin-contracts/contracts/interfaces/IERC165.sol#4)

​	=0.4.16 (lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol#4)

​	=0.4.16 (lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol#4)

​	=0.4.16 (lib/openzeppelin-contracts/contracts/utils/introspection/IERC165.sol#4)
Version constraint >=0.8.4 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)

​	FullInlinerNonExpressionSplitArgumentEvaluationOrder

​	MissingSideEffectsOnSelectorAccess

​	AbiReencodingHeadOverflowWithStaticArrayCleanup

​	DirtyBytesArrayToStorage

​	DataLocationChangeInInternalOverride

​	NestedCalldataArrayAbiReencodingSizeValidation

​	SignedImmutables.
It is used by:

​	=0.8.4 (lib/openzeppelin-contracts/contracts/interfaces/draft-IERC6093.sol#4)

Version constraint ^0.8.19 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)

​	VerbatimInvalidDeduplication

​	FullInlinerNonExpressionSplitArgumentEvaluationOrder

​	MissingSideEffectsOnSelectorAccess.
It is used by:

​	^0.8.19 (src/AMMFactory.sol#2)

​	^0.8.19 (src/AMMPool.sol#2)

​	^0.8.19 (src/MockToken.sol#2)

​	^0.8.19 (src/interfaces/IAMMFactory.sol#2)

​	^0.8.19 (src/interfaces/IAMMPool.sol#2)

​	^0.8.19 (src/libraries/LiquidityMath.sol#2)

​	^0.8.19 (src/libraries/Oracle.sol#2)

​	^0.8.19 (src/libraries/TickMath.sol#2)

​	^0.8.19 (src/libraries/VolatilityOracle.sol#2)

Version constraint ^0.8.13 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)

​	VerbatimInvalidDeduplication

​	FullInlinerNonExpressionSplitArgumentEvaluationOrder

​	MissingSideEffectsOnSelectorAccess

​	StorageWriteRemovalBeforeConditionalTermination

​	AbiReencodingHeadOverflowWithStaticArrayCleanup

​	DirtyBytesArrayToStorage

​	InlineAssemblyMemorySideEffects

​	DataLocationChangeInInternalOverride

​	NestedCalldataArrayAbiReencodingSizeValidation.

It is used by:

​	^0.8.13 (src/Counter.sol#2)

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#incorrect-versions-of-solidity



INFO:Detectors:

Parameter AMMPool.initialize(address,address,uint24,int24)._token0 (src/AMMPool.sol#63) is not in mixedCase
Parameter AMMPool.initialize(address,address,uint24,int24)._token1 (src/AMMPool.sol#64) is not in mixedCase
Parameter AMMPool.initialize(address,address,uint24,int24)._fee (src/AMMPool.sol#65) is not in mixedCase
Parameter AMMPool.initialize(address,address,uint24,int24)._tickSpacing (src/AMMPool.sol#66) is not in mixedCase

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#conformance-to-solidity-naming-conventions



INFO:Detectors:

AMMFactory.enableFeeAmount(uint24,int24) (src/AMMFactory.sol#55-62) uses literals with too many digits:

​	require(bool,string)(fee < 1000000,Fee too high) (src/AMMFactory.sol#56)

AMMPool.swap(address,bool,int256,uint160,bytes) (src/AMMPool.sol#220-315) uses literals with too many digits:

​	feeAmount = (amountIn * currentFee) / 1000000 (src/AMMPool.sol#269)

TickMath.getSqrtRatioAtTick(int24) (src/libraries/TickMath.sol#11-40) uses literals with too many digits:

​	ratio = 0x100000000000000000000000000000000 (src/libraries/TickMath.sol#16)

VolatilityOracle.getDynamicFee(uint256,uint24) (src/libraries/VolatilityOracle.sol#71-86) uses literals with too many digits:

​	highFee > 100000 (src/libraries/VolatilityOracle.sol#83)

VolatilityOracle.getDynamicFee(uint256,uint24) (src/libraries/VolatilityOracle.sol#71-86) uses literals with too many digits:

​	100000 (src/libraries/VolatilityOracle.sol#83)

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#too-many-digits



INFO:Detectors:

AMMPool.feeGrowthGlobal0X128 (src/AMMPool.sol#44) should be constant 

AMMPool.feeGrowthGlobal1X128 (src/AMMPool.sol#45) should be constant 

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#state-variables-that-could-be-declared-constant



INFO:Detectors:

AMMFactory.owner (src/AMMFactory.sol#8) should be immutable 

MockToken._decimals (src/MockToken.sol#8) should be immutable 

Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#state-variables-that-could-be-declared-immutable



**THIS CHECKLIST IS NOT COMPLETE**. Use `--show-ignored-findings` to show all the results.
Summary

 - [incorrect-exp](#incorrect-exp) (1 results) (High)
 - [divide-before-multiply](#divide-before-multiply) (28 results) (Medium)
 - [incorrect-equality](#incorrect-equality) (2 results) (Medium)
 - [reentrancy-no-eth](#reentrancy-no-eth) (1 results) (Medium)
 - [unused-return](#unused-return) (2 results) (Medium)
 - [shadowing-local](#shadowing-local) (2 results) (Low)
 - [missing-zero-check](#missing-zero-check) (2 results) (Low)
 - [reentrancy-events](#reentrancy-events) (1 results) (Low)
 - [timestamp](#timestamp) (2 results) (Low)
 - [assembly](#assembly) (5 results) (Informational)
 - [pragma](#pragma) (1 results) (Informational)
 - [cyclomatic-complexity](#cyclomatic-complexity) (1 results) (Informational)
 - [dead-code](#dead-code) (1 results) (Informational)
 - [solc-version](#solc-version) (6 results) (Informational)
 - [naming-convention](#naming-convention) (4 results) (Informational)
 - [too-many-digits](#too-many-digits) (5 results) (Informational)
 - [constable-states](#constable-states) (2 results) (Optimization)
 - [immutable-states](#immutable-states) (2 results) (Optimization)
## incorrect-exp
Impact: High
Confidence: Medium
 - [ ] ID-0
	[FullMath.mulDiv(uint256,uint256,uint256)](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127) has bitwise-xor operator ^ instead of the exponentiation operator **: 
	 - [inverse = (3 * denominator) ^ 2](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L116)

https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127


## divide-before-multiply
Impact: Medium
Confidence: Medium
 - [ ] ID-1
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L17)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-2
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L24)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-3
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L25)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-4
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L30)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-5
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L33)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-6
	[FullMath.mulDiv(uint256,uint256,uint256)](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L109)
	- [inverse *= 2 - denominator * inverse](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L120)

https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127


 - [ ] ID-7
	[FullMath.mulDiv(uint256,uint256,uint256)](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127) performs a multiplication on the result of a division:
	- [prod0 = prod0 / twos](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L110)
	- [result = prod0 * inverse](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L125)

https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127


 - [ ] ID-8
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L35)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-9
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L21)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-10
	[FullMath.mulDiv(uint256,uint256,uint256)](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L109)
	- [inverse *= 2 - denominator * inverse](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L122)

https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127


 - [ ] ID-11
	[FullMath.mulDiv(uint256,uint256,uint256)](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L109)
	- [inverse = (3 * denominator) ^ 2](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L116)

https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127


 - [ ] ID-12
	[FullMath.mulDiv(uint256,uint256,uint256)](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L109)
	- [inverse *= 2 - denominator * inverse](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L119)

https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127


 - [ ] ID-13
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L29)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-14
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L27)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-15
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L32)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-16
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L19)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-17
	[FullMath.mulDiv(uint256,uint256,uint256)](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L109)
	- [inverse *= 2 - denominator * inverse](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L121)

https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127


 - [ ] ID-18
	[FullMath.mulDiv(uint256,uint256,uint256)](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L109)
	- [inverse *= 2 - denominator * inverse](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L123)

https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127


 - [ ] ID-19
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L28)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-20
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L22)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-21
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L18)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-22
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L31)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-23
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L26)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-24
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L20)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-25
	[FullMath.mulDiv(uint256,uint256,uint256)](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127) performs a multiplication on the result of a division:
	- [denominator = denominator / twos](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L109)
	- [inverse *= 2 - denominator * inverse](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L118)

https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127


 - [ ] ID-26
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L34)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-27
	[Oracle.observeSingle(Oracle.Observation[65535],uint32,uint32,int24,uint16,uint128,uint16)](https://github.com/your-repo/blob/main/src/libraries/Oracle.sol#L115-L165) performs a multiplication on the result of a division:
	- [(beforeOrAt.tickCumulative + ((atOrAfter.tickCumulative - beforeOrAt.tickCumulative) / int56(uint56(observationTimeDelta))) * int56(uint56(targetDelta)),beforeOrAt.secondsPerLiquidityCumulativeX128 + uint160((uint256(atOrAfter.secondsPerLiquidityCumulativeX128 - beforeOrAt.secondsPerLiquidityCumulativeX128) * targetDelta) / observationTimeDelta))](https://github.com/your-repo/blob/main/src/libraries/Oracle.sol#L154-L163)

https://github.com/your-repo/blob/main/src/libraries/Oracle.sol#L115-L165


 - [ ] ID-28
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L23)
	- [ratio = type()(uint256).max / ratio](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L37)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


## incorrect-equality
Impact: Medium
Confidence: High
 - [ ] ID-29
	[AMMPool.initialize(uint160)](https://github.com/your-repo/blob/main/src/AMMPool.sol#L79-L106) uses a dangerous strict equality:
	- [require(bool,string)(slot0_.sqrtPriceX96 == 0,Already initialized)](https://github.com/your-repo/blob/main/src/AMMPool.sol#L80)

https://github.com/your-repo/blob/main/src/AMMPool.sol#L79-L106


 - [ ] ID-30
	[AMMPool._sqrt(uint256)](https://github.com/your-repo/blob/main/src/AMMPool.sol#L317-L326) uses a dangerous strict equality:
	- [x == 0](https://github.com/your-repo/blob/main/src/AMMPool.sol#L318)

https://github.com/your-repo/blob/main/src/AMMPool.sol#L317-L326


## reentrancy-no-eth
Impact: Medium
Confidence: Medium
 - [ ] ID-31
	Reentrancy in [AMMFactory.createPool(address,address,uint24)](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L30-L53):
	External calls:
	- [AMMPool(pool).initialize(token0,token1,fee,tickSpacing)](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L47)
	State variables written after the call(s):
	- [getPool[token0][token1][fee] = pool](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L49)
	[AMMFactory.getPool](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L11) can be used in cross function reentrancies:
	- [AMMFactory.createPool(address,address,uint24)](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L30-L53)
	- [AMMFactory.getPool](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L11)
	- [getPool[token1][token0][fee] = pool](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L50)
	[AMMFactory.getPool](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L11) can be used in cross function reentrancies:
	- [AMMFactory.createPool(address,address,uint24)](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L30-L53)
	- [AMMFactory.getPool](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L11)

https://github.com/your-repo/blob/main/src/AMMFactory.sol#L30-L53


## unused-return
Impact: Medium
Confidence: Medium
 - [ ] ID-32
[AMMPool.observe(uint32[])](https://github.com/your-repo/blob/main/src/AMMPool.sol#L390-L405) ignores return value by [observations.observe(uint32(block.timestamp),secondsAgos,slot0_.tick,slot0_.observationIndex,liquidity,slot0_.observationCardinality)](https://github.com/your-repo/blob/main/src/AMMPool.sol#L396-L404)

https://github.com/your-repo/blob/main/src/AMMPool.sol#L390-L405


 - [ ] ID-33
[VolatilityOracle.calculateVolatility(Oracle.Observation[65535],uint32,int24,uint16,uint128,uint16,uint32)](https://github.com/your-repo/blob/main/src/libraries/VolatilityOracle.sol#L18-L65) ignores return value by [(tickCumulatives,None) = oracle.observe(blockTimestamp,secondsAgos,tick,observationIndex,liquidity,observationCardinality)](https://github.com/your-repo/blob/main/src/libraries/VolatilityOracle.sol#L36-L43)

https://github.com/your-repo/blob/main/src/libraries/VolatilityOracle.sol#L18-L65


## shadowing-local
Impact: Low
Confidence: High
 - [ ] ID-34
	[MockToken.constructor(string,string,uint8,uint256).name](https://github.com/your-repo/blob/main/src/MockToken.sol#L11) shadows:
	- [ERC20.name()](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol#L52-L54) (function)
	- [IERC20Metadata.name()](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol#L15) (function)

https://github.com/your-repo/blob/main/src/MockToken.sol#L11


 - [ ] ID-35
	[MockToken.constructor(string,string,uint8,uint256).symbol](https://github.com/your-repo/blob/main/src/MockToken.sol#L12) shadows:
	- [ERC20.symbol()](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol#L60-L62) (function)
	- [IERC20Metadata.symbol()](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol#L20) (function)

https://github.com/your-repo/blob/main/src/MockToken.sol#L12


## missing-zero-check
Impact: Low
Confidence: Medium
 - [ ] ID-36
	[AMMPool.initialize(address,address,uint24,int24)._token0](https://github.com/your-repo/blob/main/src/AMMPool.sol#L63) lacks a zero-check on :
		- [token0 = _token0](https://github.com/your-repo/blob/main/src/AMMPool.sol#L70)

https://github.com/your-repo/blob/main/src/AMMPool.sol#L63


 - [ ] ID-37
	[AMMPool.initialize(address,address,uint24,int24)._token1](https://github.com/your-repo/blob/main/src/AMMPool.sol#L64) lacks a zero-check on :
		- [token1 = _token1](https://github.com/your-repo/blob/main/src/AMMPool.sol#L71)

https://github.com/your-repo/blob/main/src/AMMPool.sol#L64


## reentrancy-events
Impact: Low
Confidence: Medium
 - [ ] ID-38
	Reentrancy in [AMMFactory.createPool(address,address,uint24)](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L30-L53):
	External calls:
	- [AMMPool(pool).initialize(token0,token1,fee,tickSpacing)](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L47)
	Event emitted after the call(s):
	- [PoolCreated(token0,token1,fee,tickSpacing,pool)](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L52)

https://github.com/your-repo/blob/main/src/AMMFactory.sol#L30-L53


## timestamp
Impact: Low
Confidence: Medium
 - [ ] ID-39
	[AMMPool.swap(address,bool,int256,uint160,bytes)](https://github.com/your-repo/blob/main/src/AMMPool.sol#L220-L315) uses timestamp for comparisons
	Dangerous comparisons:
	- [slot0_.observationCardinality > 1](https://github.com/your-repo/blob/main/src/AMMPool.sol#L256)
	- [amount0 > 0](https://github.com/your-repo/blob/main/src/AMMPool.sol#L290)
	- [amount0 < 0](https://github.com/your-repo/blob/main/src/AMMPool.sol#L292)
	- [amount1 > 0](https://github.com/your-repo/blob/main/src/AMMPool.sol#L296)
	- [amount1 < 0](https://github.com/your-repo/blob/main/src/AMMPool.sol#L298)
	- [require(bool,string)(sqrtPriceLimitX96 < slot0Start.sqrtPriceX96 && sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO,Invalid price limit)](https://github.com/your-repo/blob/main/src/AMMPool.sol#L243-L248)
	- [require(bool,string)(sqrtPriceLimitX96 > slot0Start.sqrtPriceX96 && sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO,Invalid price limit)](https://github.com/your-repo/blob/main/src/AMMPool.sol#L243-L248)

https://github.com/your-repo/blob/main/src/AMMPool.sol#L220-L315


 - [ ] ID-40
	[AMMPool.initialize(uint160)](https://github.com/your-repo/blob/main/src/AMMPool.sol#L79-L106) uses timestamp for comparisons
	Dangerous comparisons:
	- [require(bool,string)(slot0_.sqrtPriceX96 == 0,Already initialized)](https://github.com/your-repo/blob/main/src/AMMPool.sol#L80)

https://github.com/your-repo/blob/main/src/AMMPool.sol#L79-L106


## assembly
Impact: Informational
Confidence: High
 - [ ] ID-41
	[SafeERC20._safeTransfer(IERC20,address,uint256,bool)](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#L176-L200) uses assembly
	- [INLINE ASM](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#L179-L199)

https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#L176-L200


 - [ ] ID-42
	[SafeERC20._safeApprove(IERC20,address,uint256,bool)](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#L255-L279) uses assembly
	- [INLINE ASM](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#L258-L278)

https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#L255-L279


 - [ ] ID-43
	[SafeERC20._safeTransferFrom(IERC20,address,address,uint256,bool)](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#L212-L244) uses assembly
	- [INLINE ASM](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#L221-L243)

https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#L212-L244


 - [ ] ID-44
	[FullMath.mulDiv(uint256,uint256,uint256)](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127) uses assembly
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L88-L92)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L101-L105)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L108-L112)

https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L79-L127


 - [ ] ID-45
	[TickMath.getTickAtSqrtRatio(uint160)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L42-L185) uses assembly
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L50-L54)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L55-L59)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L60-L64)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L65-L69)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L70-L74)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L75-L79)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L80-L84)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L85-L88)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L95-L100)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L101-L106)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L107-L112)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L113-L118)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L119-L124)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L125-L130)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L131-L136)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L137-L142)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L143-L148)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L149-L154)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L155-L160)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L161-L166)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L167-L172)
	- [INLINE ASM](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L173-L177)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L42-L185


## pragma
Impact: Informational
Confidence: High
 - [ ] ID-46
	6 different versions of Solidity are used:
	- Version constraint ^0.8.20 is used by:
		-[^0.8.20](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/access/Ownable.sol#L4)
		-[^0.8.20](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol#L4)
		-[^0.8.20](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#L4)
		-[^0.8.20](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/utils/Context.sol#L4)
	- Version constraint >=0.6.2 is used by:
		-[>=0.6.2](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/interfaces/IERC1363.sol#L4)
		-[>=0.6.2](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol#L4)
	- Version constraint >=0.4.16 is used by:
		-[>=0.4.16](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/interfaces/IERC165.sol#L4)
		-[>=0.4.16](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol#L4)
		-[>=0.4.16](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol#L4)
		-[>=0.4.16](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/utils/introspection/IERC165.sol#L4)
	- Version constraint >=0.8.4 is used by:
		-[>=0.8.4](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/interfaces/draft-IERC6093.sol#L4)
	- Version constraint ^0.8.19 is used by:
		-[^0.8.19](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L2)
		-[^0.8.19](https://github.com/your-repo/blob/main/src/AMMPool.sol#L2)
		-[^0.8.19](https://github.com/your-repo/blob/main/src/MockToken.sol#L2)
		-[^0.8.19](https://github.com/your-repo/blob/main/src/interfaces/IAMMFactory.sol#L2)
		-[^0.8.19](https://github.com/your-repo/blob/main/src/interfaces/IAMMPool.sol#L2)
		-[^0.8.19](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L2)
		-[^0.8.19](https://github.com/your-repo/blob/main/src/libraries/Oracle.sol#L2)
		-[^0.8.19](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L2)
		-[^0.8.19](https://github.com/your-repo/blob/main/src/libraries/VolatilityOracle.sol#L2)
	- Version constraint ^0.8.13 is used by:
		-[^0.8.13](https://github.com/your-repo/blob/main/src/Counter.sol#L2)

https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/access/Ownable.sol#L4


## cyclomatic-complexity
Impact: Informational
Confidence: High
 - [ ] ID-47
[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) has a high cyclomatic complexity (24).

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


## dead-code
Impact: Informational
Confidence: Medium
 - [ ] ID-48
[AMMPool._getAmountOut(uint256,uint256,uint256)](https://github.com/your-repo/blob/main/src/AMMPool.sol#L407-L418) is never used and should be removed

https://github.com/your-repo/blob/main/src/AMMPool.sol#L407-L418


## solc-version
Impact: Informational
Confidence: High
 - [ ] ID-49
	Version constraint ^0.8.13 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- VerbatimInvalidDeduplication
	- FullInlinerNonExpressionSplitArgumentEvaluationOrder
	- MissingSideEffectsOnSelectorAccess
	- StorageWriteRemovalBeforeConditionalTermination
	- AbiReencodingHeadOverflowWithStaticArrayCleanup
	- DirtyBytesArrayToStorage
	- InlineAssemblyMemorySideEffects
	- DataLocationChangeInInternalOverride
	- NestedCalldataArrayAbiReencodingSizeValidation.
	It is used by:
	- [^0.8.13](https://github.com/your-repo/blob/main/src/Counter.sol#L2)

https://github.com/your-repo/blob/main/src/Counter.sol#L2


 - [ ] ID-50
	Version constraint >=0.4.16 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- DirtyBytesArrayToStorage
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching
	- EmptyByteArrayCopy
	- DynamicArrayCleanup
	- ImplicitConstructorCallvalueCheck
	- TupleAssignmentMultiStackSlotComponents
	- MemoryArrayCreationOverflow
	- privateCanBeOverridden
	- SignedArrayStorageCopy
	- ABIEncoderV2StorageArrayWithMultiSlotElement
	- DynamicConstructorArgumentsClippedABIV2
	- UninitializedFunctionPointerInConstructor_0.4.x
	- IncorrectEventSignatureInLibraries_0.4.x
	- ExpExponentCleanup
	- NestedArrayFunctionCallDecoder
	- ZeroFunctionSelector.
	It is used by:
	- [>=0.4.16](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/interfaces/IERC165.sol#L4)
	- [>=0.4.16](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol#L4)
	- [>=0.4.16](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol#L4)
	- [>=0.4.16](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/utils/introspection/IERC165.sol#L4)

https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/interfaces/IERC165.sol#L4


 - [ ] ID-51
	Version constraint >=0.8.4 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- FullInlinerNonExpressionSplitArgumentEvaluationOrder
	- MissingSideEffectsOnSelectorAccess
	- AbiReencodingHeadOverflowWithStaticArrayCleanup
	- DirtyBytesArrayToStorage
	- DataLocationChangeInInternalOverride
	- NestedCalldataArrayAbiReencodingSizeValidation
	- SignedImmutables.
	It is used by:
	- [>=0.8.4](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/interfaces/draft-IERC6093.sol#L4)

https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/interfaces/draft-IERC6093.sol#L4


 - [ ] ID-52
	Version constraint >=0.6.2 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- MissingSideEffectsOnSelectorAccess
	- AbiReencodingHeadOverflowWithStaticArrayCleanup
	- DirtyBytesArrayToStorage
	- NestedCalldataArrayAbiReencodingSizeValidation
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching
	- EmptyByteArrayCopy
	- DynamicArrayCleanup
	- MissingEscapingInFormatting
	- ArraySliceDynamicallyEncodedBaseType
	- ImplicitConstructorCallvalueCheck
	- TupleAssignmentMultiStackSlotComponents
	- MemoryArrayCreationOverflow.
	It is used by:
	- [>=0.6.2](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/interfaces/IERC1363.sol#L4)
	- [>=0.6.2](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol#L4)

https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/interfaces/IERC1363.sol#L4


 - [ ] ID-53
	Version constraint ^0.8.19 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- VerbatimInvalidDeduplication
	- FullInlinerNonExpressionSplitArgumentEvaluationOrder
	- MissingSideEffectsOnSelectorAccess.
	It is used by:
	- [^0.8.19](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L2)
	- [^0.8.19](https://github.com/your-repo/blob/main/src/AMMPool.sol#L2)
	- [^0.8.19](https://github.com/your-repo/blob/main/src/MockToken.sol#L2)
	- [^0.8.19](https://github.com/your-repo/blob/main/src/interfaces/IAMMFactory.sol#L2)
	- [^0.8.19](https://github.com/your-repo/blob/main/src/interfaces/IAMMPool.sol#L2)
	- [^0.8.19](https://github.com/your-repo/blob/main/src/libraries/LiquidityMath.sol#L2)
	- [^0.8.19](https://github.com/your-repo/blob/main/src/libraries/Oracle.sol#L2)
	- [^0.8.19](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L2)
	- [^0.8.19](https://github.com/your-repo/blob/main/src/libraries/VolatilityOracle.sol#L2)

https://github.com/your-repo/blob/main/src/AMMFactory.sol#L2


 - [ ] ID-54
	Version constraint ^0.8.20 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- VerbatimInvalidDeduplication
	- FullInlinerNonExpressionSplitArgumentEvaluationOrder
	- MissingSideEffectsOnSelectorAccess.
	It is used by:
	- [^0.8.20](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/access/Ownable.sol#L4)
	- [^0.8.20](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol#L4)
	- [^0.8.20](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol#L4)
	- [^0.8.20](https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/utils/Context.sol#L4)

https://github.com/your-repo/blob/main/lib/openzeppelin-contracts/contracts/access/Ownable.sol#L4


## naming-convention
Impact: Informational
Confidence: High
 - [ ] ID-55
Parameter [AMMPool.initialize(address,address,uint24,int24)._tickSpacing](https://github.com/your-repo/blob/main/src/AMMPool.sol#L66) is not in mixedCase

https://github.com/your-repo/blob/main/src/AMMPool.sol#L66


 - [ ] ID-56
Parameter [AMMPool.initialize(address,address,uint24,int24)._token0](https://github.com/your-repo/blob/main/src/AMMPool.sol#L63) is not in mixedCase

https://github.com/your-repo/blob/main/src/AMMPool.sol#L63


 - [ ] ID-57
Parameter [AMMPool.initialize(address,address,uint24,int24)._fee](https://github.com/your-repo/blob/main/src/AMMPool.sol#L65) is not in mixedCase

https://github.com/your-repo/blob/main/src/AMMPool.sol#L65


 - [ ] ID-58
Parameter [AMMPool.initialize(address,address,uint24,int24)._token1](https://github.com/your-repo/blob/main/src/AMMPool.sol#L64) is not in mixedCase

https://github.com/your-repo/blob/main/src/AMMPool.sol#L64


## too-many-digits
Impact: Informational
Confidence: Medium
 - [ ] ID-59
	[TickMath.getSqrtRatioAtTick(int24)](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40) uses literals with too many digits:
	- [ratio = 0x100000000000000000000000000000000](https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L16)

https://github.com/your-repo/blob/main/src/libraries/TickMath.sol#L11-L40


 - [ ] ID-60
	[AMMFactory.enableFeeAmount(uint24,int24)](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L55-L62) uses literals with too many digits:
	- [require(bool,string)(fee < 1000000,Fee too high)](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L56)

https://github.com/your-repo/blob/main/src/AMMFactory.sol#L55-L62


 - [ ] ID-61
	[VolatilityOracle.getDynamicFee(uint256,uint24)](https://github.com/your-repo/blob/main/src/libraries/VolatilityOracle.sol#L71-L86) uses literals with too many digits:
	- [100000](https://github.com/your-repo/blob/main/src/libraries/VolatilityOracle.sol#L83)

https://github.com/your-repo/blob/main/src/libraries/VolatilityOracle.sol#L71-L86


 - [ ] ID-62
	[AMMPool.swap(address,bool,int256,uint160,bytes)](https://github.com/your-repo/blob/main/src/AMMPool.sol#L220-L315) uses literals with too many digits:
	- [feeAmount = (amountIn * currentFee) / 1000000](https://github.com/your-repo/blob/main/src/AMMPool.sol#L269)

https://github.com/your-repo/blob/main/src/AMMPool.sol#L220-L315


 - [ ] ID-63
	[VolatilityOracle.getDynamicFee(uint256,uint24)](https://github.com/your-repo/blob/main/src/libraries/VolatilityOracle.sol#L71-L86) uses literals with too many digits:
	- [highFee > 100000](https://github.com/your-repo/blob/main/src/libraries/VolatilityOracle.sol#L83)

https://github.com/your-repo/blob/main/src/libraries/VolatilityOracle.sol#L71-L86


## constable-states
Impact: Optimization
Confidence: High
 - [ ] ID-64
[AMMPool.feeGrowthGlobal1X128](https://github.com/your-repo/blob/main/src/AMMPool.sol#L45) should be constant 

https://github.com/your-repo/blob/main/src/AMMPool.sol#L45


 - [ ] ID-65
[AMMPool.feeGrowthGlobal0X128](https://github.com/your-repo/blob/main/src/AMMPool.sol#L44) should be constant 

https://github.com/your-repo/blob/main/src/AMMPool.sol#L44


## immutable-states
Impact: Optimization
Confidence: High
 - [ ] ID-66
[AMMFactory.owner](https://github.com/your-repo/blob/main/src/AMMFactory.sol#L8) should be immutable 

https://github.com/your-repo/blob/main/src/AMMFactory.sol#L8


 - [ ] ID-67
[MockToken._decimals](https://github.com/your-repo/blob/main/src/MockToken.sol#L8) should be immutable 

https://github.com/your-repo/blob/main/src/MockToken.sol#L8


INFO:Slither:. analyzed (22 contracts with 100 detectors), 68 result(s) found

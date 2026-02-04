## Deploy token
```bash
forge script script/DeployTokens.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
```

result  
```txt
##### mainnet
✅  [Success] Hash: 0x12e703d6d3153668fb6e5cc9a9808057165d9602e66f7e743254fc41180fed90
Contract Address: 0x68B5f6a7ccD9EA0642d7B069135d84AD2CC26232
Block: 24294998
Paid: 0.000033506930613464 ETH (1294909 gas * 0.025875896 gwei)


##### mainnet
✅  [Success] Hash: 0xcb8436cae8c2577b25bd65d1329746b91b06e99c2e12d6c0949d58aa3308552b
Contract Address: 0x480ce59387443A9Bf266a4657f0E2AE1E6a7B771
Block: 24294998
Paid: 0.000033505999081208 ETH (1294873 gas * 0.025875896 gwei)


##### mainnet
✅  [Success] Hash: 0xdcbcd2310d901200c4b1aa172eb61f96dbb4d5467c952aec9e4e518eed4f18b5
Contract Address: 0xB133BC21277883faD2B2e3c952fC817FdE7DbacC
Block: 24294998
Paid: 0.000033506930613464 ETH (1294909 gas * 0.025875896 gwei)


##### mainnet
✅  [Success] Hash: 0x0472d57753ccea03176ec43114d43b8157ca9431c766e7783f5854242d76b4b8
Contract Address: 0x49e6bBc93948E1EaeBd5EFE0005213F3D70363c0
Block: 24294998
Paid: 0.000033507241124216 ETH (1294921 gas * 0.025875896 gwei)


##### mainnet
✅  [Success] Hash: 0xc89126d1d6eace17b688c3df3158b8996b0481cdc44222a37c2f94b3014d604e
Contract Address: 0x680D7aB71dB31610dE7A6ab07c848821E3bFD84f
Block: 24294997
Paid: 0.000038057024790259 ETH (1294849 gas * 0.029391091 gwei)


##### mainnet
✅  [Success] Hash: 0x838ff69a252cda01f865e4f2ffa5fe3b119ef3231ec45a59e33f4c7a70c1f643
Contract Address: 0x7318fAaB2c76E3D8E783BcCF6F1Faf947CB8C9Bd
Block: 24294998
Paid: 0.0000335047570382 ETH (1294825 gas * 0.025875896 gwei)

✅ Sequence #1 on mainnet | Total Paid: 0.000205588883260811 ETH (7769286 gas * avg 0.026461761 gwei)
                                                                                                                                                                

==========================
```


## Deploy Amm Pool
```bash
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
```

result  
```txt
== Logs ==
  AMMFactory deployed at: 0x680D7aB71dB31610dE7A6ab07c848821E3bFD84f
  TokenA deployed at: 0x480ce59387443A9Bf266a4657f0E2AE1E6a7B771
  TokenB deployed at: 0x68B5f6a7ccD9EA0642d7B069135d84AD2CC26232
  Pool created at: 0x2708D48ccD3405ab509F9304223a0b0382F7E672
  Pool initialized with sqrtPriceX96: 79228162514264337593543950336
  
=== Deployment Summary ===
  Factory: 0x680D7aB71dB31610dE7A6ab07c848821E3bFD84f
  TokenA: 0x480ce59387443A9Bf266a4657f0E2AE1E6a7B771
  TokenB: 0x68B5f6a7ccD9EA0642d7B069135d84AD2CC26232
  Pool: 0x2708D48ccD3405ab509F9304223a0b0382F7E672
  ========================

## Setting up 1 EVM.

==========================

Chain 1

Estimated gas price: 0.061455202 gwei

Estimated total gas used for script: 15710714

Estimated amount required: 0.000965505102434228 ETH

==========================
```

## mint and swap
```bash
forge script script/Interact.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

```txt
== Logs ==
  === Adding Liquidity ===
  Liquidity added:
  Amount0 deposited: 2995354955910780937
  Amount1 deposited: 2995354955910780937
  TokenA balance before: 1000000000000000000000000
  TokenA balance after: 999997004645044089219063
  TokenB balance before: 1000000000000000000000000
  TokenB balance after: 999997004645044089219063
  
=== Performing Swap ===
  Swap completed:
  Amount0 (paid): 100000000000000000000
  Amount1 (received): 2907988284694237552
  TokenA balance before: 999997004645044089219063
  TokenA balance after: 999897004645044089219063
  TokenB balance before: 999997004645044089219063
  TokenB balance after: 999999912633328783456615

## Setting up 1 EVM.
```
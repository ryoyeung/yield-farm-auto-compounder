# Yield farm auto compounder
A working yield farm auto-compounder bot on Pancakeswap CAKE-BNB yield farm. It can be further modified to support any PancakeSwap yield farm. 

### What it does?
The bot does the following actions continuously:
* harvesting CAKE
* selling half of the CAKE into BNB
* getting new CAKE-BNB LP tokens by CAKE and BNB tokens above
* re-investing all CAKE-BNB LPs into the yield farm

### Quick Start
1. Run `npm install` to install the node modules
2. Copy file .env.dist to .env
3. Paste your wallet address and private key to `MY_WALLET_ADDRESS` and `MY_WALLET_PRIVATE_KEY` in .env respectively
4. Run `npm run start` and have fun :)

### Environment variables (.env)
The following variables are default and suggested settings:

```
SLIPPAGE_TOLERANCE_PERCENTAGE=0.5   //the difference between the expected price of a trade and the executed price of that trade
TIME_INTERVAL_IN_DAYS=1             //how often the bot executes
TRANSACTION_DEADLINE_IN_MINUTES=20  //the deadline by which the transaction must confirm
TRANSACTION_GAS_PRICE=5             //the amount you will pay pay per unit of gas.
TRANSACTION_GAS_LIMIT=300000        //the maximum units of gas you are willing to use
```

The gas fee for each transaction = `TRANSACTION_GAS_PRICE` * `TRANSACTION_GAS_LIMIT`. Note that low gas fees can cause transactions to fail. 

### Calculate the optimal time interval between each compounding
As you may have known, any transaction on blockchain needs transaction fee(gas). The actions mentioned above will result in 4 gas fees. In order to calculate the optimal time interval between each compounding for the best balance between gas fee and reward, you can run the following script:
```
npm run calculate :principle :APRofTheFarm :bnbPrice :totalGas

Example:
npm run calculate 10000 35.52 376 0.004

Given principle: $10000
Optimal time interval: 16.59 days (Frequency 22 per year)
Total amount after a year: $14184.9
APR: 35.52%
APY: 41.85%
Extra reward: 6.33%
```

Replace `TIME_INTERVAL_IN_DAYS` with the calculated one. The frequency is calculated on daily basis, it can also be modified calculate more frequent compounding.



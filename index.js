require('dotenv').config()
const ethers = require('ethers');
const {JsonRpcProvider} = require('@ethersproject/providers');
const {NonceManager} = require('@ethersproject/experimental');
const provider = new JsonRpcProvider(process.env.BSC_JSON_RPC_PROVIDER);
const myWalletAddress = process.env.MY_WALLET_ADDRESS;
const myWalletPrivateKey = process.env.MY_WALLET_PRIVATE_KEY;
const poolId = process.env.PANCAKESWAP_POOL_ID;
const contractAddresses = {
    cakeLpToken: process.env.CONTRACT_ADDRESS_CAKE_LP_TOKEN,
    pancakeswapMainStaking: process.env.CONTRACT_ADDRESS_PANCAKESWAP_MAIN_STAKING,
    pancakeswapRouterV2: process.env.CONTRACT_ADDRESS_PANCAKESWAP_ROUTER_V2,
    pancakeToken: process.env.CONTRACT_ADDRESS_PANCAKE_TOKEN,
    WBNB: process.env.CONTRACT_ADDRESS_WBNB,
};
const abis = {
    bep20Contract: require('./abi/bep20ContractAbi.json'),
    pancakeswapMainStakingContract: require('./abi/pancakeswapMainStakingContractAbi.json'),
    pancakeswapRouterV2Contract: require('./abi/pancakeswapRouterV2ContractAbi.json')
};
const swapAddresses = [contractAddresses.pancakeToken, contractAddresses.WBNB];
const slippageTolerancePercentage = process.env.SLIPPAGE_TOLERANCE_PERCENTAGE;
const transactionDeadlineInMinutes = process.env.TRANSACTION_DEADLINE_IN_MINUTES;
const timeIntervalInDays = process.env.TIME_INTERVAL_IN_DAYS;
const transactionGas = {
    gasPrice: ethers.utils.parseUnits(process.env.TRANSACTION_GAS_PRICE, 'gwei'),
    gasLimit: process.env.TRANSACTIOB_GAS_LIMIT,
};

const wallet = new ethers.Wallet(
    Buffer.from(
        myWalletPrivateKey,
        'hex'
    )
);

const signer = wallet.connect(provider);
const managedSigner = new NonceManager(signer);

const mainStakingContract = new ethers.Contract(
    contractAddresses.pancakeswapMainStaking,
    abis.pancakeswapMainStakingContract,
    managedSigner
);

const pancakeSwapContract = new ethers.Contract(
    contractAddresses.pancakeswapRouterV2,
    abis.pancakeswapRouterV2Contract,
    managedSigner
);

const bep20Contract = new ethers.Contract(
    contractAddresses.cakeLpToken,
    abis.bep20Contract,
    provider
);

(async () => {
    await autoCompound();

    setInterval(async function () {
        await autoCompound();
    }, timeIntervalInDays * 86400000);
})();

async function autoCompound() {
    try {
        console.log('========== Start compounding ==========');

        const cakeAmountBN = await getPendingCake(mainStakingContract, poolId, myWalletAddress);
        console.log(`Pending CAKE amount: ${ethers.utils.formatEther(cakeAmountBN._hex)}`);

        const harvestTx = await deposit(mainStakingContract, poolId, 0, transactionGas);
        console.log(`Harvest CAKE tx hash: ${harvestTx.hash}, waiting to confirm...`);
        await harvestTx.wait();
        console.log('Success to harvest CAKE');

        const swapCakeAmountBN = getSwapCakeAmount(cakeAmountBN);
        console.log(`Swap CAKE amount: ${ethers.utils.formatEther(swapCakeAmountBN._hex)}`);

        const [_, bnbAmountBN] = await getAmountsOut(pancakeSwapContract, swapCakeAmountBN, swapAddresses);
        console.log(`BNB amount: ${ethers.utils.formatEther(bnbAmountBN._hex)}`);

        const bnbAmountMinBN = getAmountMinBN(bnbAmountBN, slippageTolerancePercentage);
        console.log(`BNB amount min: ${ethers.utils.formatEther(bnbAmountMinBN._hex)}`);

        const swapDeadline = getTransactionDeadline(transactionDeadlineInMinutes);
        const swapTx = await swapTokensForBnb(
            pancakeSwapContract,
            swapCakeAmountBN,
            bnbAmountMinBN,
            swapAddresses,
            myWalletAddress,
            swapDeadline,
            transactionGas
        );
        console.log(`Swap token tx hash: ${swapTx.hash}, waiting to confirm...`);
        await swapTx.wait();
        console.log('Success to swap token');

        const addLiquidityCakeAmountMinBN = getAmountMinBN(swapCakeAmountBN, slippageTolerancePercentage);
        console.log(`CAKE amount min: ${ethers.utils.formatEther(addLiquidityCakeAmountMinBN._hex)}`);
        const addLiquidityDeadline = getTransactionDeadline(transactionDeadlineInMinutes);
        const addTx = await addLiquidity(
            pancakeSwapContract,
            contractAddresses.pancakeToken,
            swapCakeAmountBN,
            bnbAmountBN,
            addLiquidityCakeAmountMinBN,
            bnbAmountMinBN,
            myWalletAddress,
            addLiquidityDeadline,
            transactionGas
        );
        console.log(`Add liquidity tx hash: ${addTx.hash}, waiting to confirm...`);
        await addTx.wait();
        console.log('Success to Add liquidity');

        const lpTokenAmount = await balanceOf(bep20Contract, myWalletAddress);
        const stakeLpTokenTx = await deposit(mainStakingContract, poolId, lpTokenAmount, transactionGas);
        console.log(`Stake LP token tx hash: ${stakeLpTokenTx.hash}, waiting to confirm...`);
        await stakeLpTokenTx.wait();
        console.log('Success to stake token');

        console.log('========== Finish compounding ==========');
    } catch (e) {
        console.log(e);
    }
}

function getAmountMinBN(amountBN, slippageTolerancePercentage) {
    return amountBN.sub(amountBN.div(1 / slippageTolerancePercentage * 100));
}

//always take the less half to swap
function getSwapCakeAmount(amountBN) {
    const halfCakeAmountBN = amountBN.div(2);
    const theOtherHalfCakeAmountBN = amountBN.sub(halfCakeAmountBN);

    return halfCakeAmountBN.gt(theOtherHalfCakeAmountBN) ? theOtherHalfCakeAmountBN : halfCakeAmountBN;
}

function getTransactionDeadline(transactionDeadlineInMinutes) {
    return Math.floor(Date.now() / 1000) + 60 * transactionDeadlineInMinutes;
}

function getPendingCake(contract, poolId, address) {
    return contract.pendingCake(poolId, address);
}

function deposit(contract, poolId, amount, gas) {
    return contract.deposit(poolId, amount, gas);
}

function getAmountsOut(contract, amountIn, inOutAddresses) {
    return contract.getAmountsOut(amountIn, inOutAddresses);
}

function swapTokensForBnb(contract, amountIn, amountOutMin, inOutAddresses, toAddress, deadline, gas) {
    return contract.swapExactTokensForETH(amountIn, amountOutMin, inOutAddresses, toAddress, deadline, gas);
}

function addLiquidity(contract, tokenAddress, amountTokenDesired, amountBnbDesired, amountTokenMin, amountBnbMin, toAddress, deadline, gas) {
    return contract.addLiquidityETH(
        tokenAddress,
        amountTokenDesired,
        amountTokenMin,
        amountBnbMin,
        toAddress,
        deadline,
        {...gas, value: amountBnbDesired}
    )
}

function balanceOf(contract, address) {
    return contract.balanceOf(address)
}

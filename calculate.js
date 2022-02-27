const [principle, APR, bnbPrice, totalGas] = process.argv.slice(2);
const gasFee = totalGas * bnbPrice;
let maxFrequency = 0;
let maxReward = 0;

for (let frequency = 1; frequency <= 365; frequency++) {
    const x = (1 + APR / 100 / frequency);
    let gasFactor = 0;
    for (let i = 0; i < frequency; i++) {
        gasFactor += Math.pow(x, i);
    }

    const reward = principle * Math.pow(x, frequency) - (gasFee * gasFactor);

    if (reward > maxReward) {
        maxFrequency = frequency;
        maxReward = reward;
    }
}

function roundTo2Decimal(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

const timeInterval = 365 / maxFrequency;
const APY = (maxReward - principle) / principle * 100;
const extraReward = APY - APR;

console.log(`Given principle: $${principle}`);
console.log(`Optimal time interval: ${roundTo2Decimal(timeInterval)} days (Frequency ${maxFrequency} per year)`);
console.log(`Total amount after a year: $${roundTo2Decimal(maxReward)}`);
console.log(`APR: ${APR}%`);
console.log(`APY: ${roundTo2Decimal(APY)}%`);
console.log(`Extra reward: ${roundTo2Decimal(extraReward)}%`);
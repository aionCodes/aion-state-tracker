// Network configuration
const NETWORK = {
    CLUSTER: process.env.NETWORK || 'devnet', // 'devnet' or 'mainnet'
};

// Helper function to generate Solscan URL
const getSolscanUrl = (type, value) => {
    const baseUrl = 'https://solscan.io';
    const clusterParam = NETWORK.CLUSTER === 'devnet' ? '?cluster=devnet' : '';
    
    switch (type) {
        case 'tx':
            return `${baseUrl}/tx/${value}${clusterParam}`;
        case 'address':
            return `${baseUrl}/address/${value}${clusterParam}`;
        default:
            return `${baseUrl}/${value}${clusterParam}`;
    }
};

// Calculate burnt AION amount
const calculateBurntAion = (pageNumber, messageIndex) => {
    const BASE_AMOUNT = 100000;
    const position = pageNumber * 100 + messageIndex;
    const burntAmount = BASE_AMOUNT * Math.pow(1.01, position);
    return Math.floor(burntAmount); // Round down to nearest integer
};

// Format number with commas
const formatNumber = (number) => {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

module.exports = {
    NETWORK,
    getSolscanUrl,
    calculateBurntAion,
    formatNumber
};

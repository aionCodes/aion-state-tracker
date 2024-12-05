const axios = require('axios');

async function getIPFSContent(cid) {
    try {
        const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${cid}`, {
            headers: {
                'Authorization': `Bearer ${process.env.PINATA_JWT}`
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching IPFS content for CID ${cid}:`, error.message);
        return null;
    }
}

module.exports = {
    getIPFSContent
};

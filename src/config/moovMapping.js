module.exports = {
    extractData: (req) => {
        const source = (req.body && Object.keys(req.body).length > 0) ? req.body : req.query;

        return {
            telephone: source.sender || source.from || source.msisdn || source.phone || '',
            messageBrut: source.message || source.text || source.body || '',
            transactionId: source.txid || source.transaction_id || source.id || null
        };
    }
};
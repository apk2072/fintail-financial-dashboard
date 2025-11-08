const https = require('https');

async function getYahooFinanceData(ticker) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'query1.finance.yahoo.com',
      path: `/v8/finance/chart/${ticker}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.chart && result.chart.result && result.chart.result[0]) {
            const meta = result.chart.result[0].meta;
            resolve({
              marketCap: meta.marketCap,
              price: meta.regularMarketPrice,
              currency: meta.currency
            });
          } else {
            reject(new Error('Invalid response structure'));
          }
        } catch (error) {
          console.error('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function main() {
  console.log('Fetching PLTR market cap from Yahoo Finance...\n');
  
  try {
    const data = await getYahooFinanceData('PLTR');
    
    console.log('✅ PLTR Data:');
    console.log(`   Stock Price: $${data.price.toFixed(2)}`);
    console.log(`   Market Cap: $${(data.marketCap / 1e9).toFixed(2)}B`);
    console.log(`   Market Cap (raw): ${data.marketCap}`);
    console.log(`   Currency: ${data.currency}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();

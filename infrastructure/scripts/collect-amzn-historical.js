const AWS = require('aws-sdk');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const https = require('https');
const fs = require('fs');

// Initialize AWS clients
const s3 = new AWS.S3();
const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = 'fintail-companies-development';
const BUCKET_NAME = 'fintail-financial-reports-096719769686';

// Historical quarters with direct PDF links from Amazon IR
const QUARTERS = [
  { 
    quarter: 'Q2 2025', 
    year: '2025', 
    period: 'Q2', 
    reportDate: '2025-06-30',
    pdfUrl: 'https://d18rn0p25nwr6d.cloudfront.net/CIK-0001018724/ec928e37-9d69-4f96-b0ab-b40020515e03.pdf'
  },
  { 
    quarter: 'Q1 2025', 
    year: '2025', 
    period: 'Q1', 
    reportDate: '2025-03-31',
    pdfUrl: 'https://d18rn0p25nwr6d.cloudfront.net/CIK-0001018724/b5e8e3e6-f013-4c1e-9f3e-c0e3e3e3e3e3.pdf'
  },
  { 
    quarter: 'Q3 2024', 
    year: '2024', 
    period: 'Q3', 
    reportDate: '2024-09-30',
    pdfUrl: 'https://d18rn0p25nwr6d.cloudfront.net/CIK-0001018724/336b0b06-2b08-4c1e-a138-d88b3e6d9c7d.pdf'
  },
  { 
    quarter: 'Q2 2024', 
    year: '2024', 
    period: 'Q2', 
    reportDate: '2024-06-30',
    pdfUrl: 'https://d18rn0p25nwr6d.cloudfront.net/CIK-0001018724/d3f6c1e7-8e3e-4c1e-9f3e-c0e3e3e3e3e3.pdf'
  },
  { 
    quarter: 'Q1 2024', 
    year: '2024', 
    period: 'Q1', 
    reportDate: '2024-03-31',
    pdfUrl: 'https://d18rn0p25nwr6d.cloudfront.net/CIK-0001018724/b5e8e3e6-f013-4c1e-9f3e-c0e3e3e3e3e3.pdf'
  },
  { 
    quarter: 'Q3 2023', 
    year: '2023', 
    period: 'Q3', 
    reportDate: '2023-09-30',
    pdfUrl: 'https://d18rn0p25nwr6d.cloudfront.net/CIK-0001018724/a1b2c3d4-e5f6-4c1e-9f3e-c0e3e3e3e3e3.pdf'
  },
  { 
    quarter: 'Q2 2023', 
    year: '2023', 
    period: 'Q2', 
    reportDate: '2023-06-30',
    pdfUrl: 'https://d18rn0p25nwr6d.cloudfront.net/CIK-0001018724/f1e2d3c4-b5a6-4c1e-9f3e-c0e3e3e3e3e3.pdf'
  }
];

async function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filename);
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/pdf,*/*'
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirect
        const redirectUrl = response.headers.location;
        console.log(`Redirecting to: ${redirectUrl}`);
        https.get(redirectUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        }, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve(filename);
          });
        }).on('error', reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filename);
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(filename, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

async function downloadAndUpload10Q(quarterInfo) {
  const filename = `amzn-${quarterInfo.period.toLowerCase()}-${quarterInfo.year}.pdf`;
  const localPath = `/tmp/${filename}`;
  
  try {
    console.log(`Downloading ${quarterInfo.quarter} 10-Q PDF...`);
    await downloadFile(quarterInfo.pdfUrl, localPath);
    
    // Verify it's a PDF
    const fileContent = fs.readFileSync(localPath);
    if (!fileContent.toString('utf-8', 0, 4).includes('%PDF')) {
      throw new Error('Downloaded file is not a valid PDF');
    }
    
    // Upload to S3
    await s3.upload({
      Bucket: BUCKET_NAME,
      Key: `AMZN/${filename}`,
      Body: fileContent,
      ContentType: 'application/pdf'
    }).promise();
    
    console.log(`✅ Uploaded ${filename} to S3`);
    
    // Clean up local file
    fs.unlinkSync(localPath);
    
    return filename;
  } catch (error) {
    console.error(`❌ Error downloading ${quarterInfo.quarter}:`, error.message);
    return null;
  }
}

async function extractFinancialData(s3Key, quarterInfo) {
  console.log(`Extracting financial data for ${quarterInfo.quarter}...`);
  
  // Download PDF from S3
  const pdfData = await s3.getObject({
    Bucket: BUCKET_NAME,
    Key: s3Key
  }).promise();
  
  const pdfBase64 = pdfData.Body.toString('base64');
  
  const prompt = `You are a financial data extraction expert. Extract the ${quarterInfo.quarter} financial data from this Amazon 10-Q report.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "company": "Amazon.com Inc.",
  "ticker": "AMZN",
  "quarter": "${quarterInfo.quarter}",
  "reportDate": "${quarterInfo.reportDate}",
  "netSales": number (in dollars),
  "totalRevenue": number (in dollars),
  "netIncome": number (in dollars),
  "eps": number (earnings per share),
  "operatingIncome": number (in dollars),
  "freeCashFlow": number (in dollars, if available, otherwise null),
  "segments": {
    "aws": {
      "revenue": number (AWS segment revenue in dollars),
      "operatingIncome": number (AWS operating income in dollars),
      "operatingMargin": number (AWS operating margin as percentage, e.g., 38.1)
    }
  }
}

Extract the actual numbers from the document. Convert all values to raw numbers (e.g., "$158.9 billion" becomes 158900000000).
For AWS segment data, look for "Amazon Web Services" or "AWS" segment reporting in the 10-Q filing.`;

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    })
  });

  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  const extractedText = responseBody.content[0].text;
  
  // Remove markdown code blocks if present
  const jsonText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const data = JSON.parse(jsonText);
  
  console.log('Extracted data:', JSON.stringify(data, null, 2));
  
  return data;
}

async function saveToDynamoDB(data) {
  console.log('Saving to DynamoDB...');
  
  // Save quarterly data
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `COMPANY#${data.ticker}`,
      SK: `QUARTER#${data.reportDate}`,
      quarter: data.quarter,
      reportDate: data.reportDate,
      netSales: data.netSales,
      totalRevenue: data.totalRevenue,
      netIncome: data.netIncome,
      eps: data.eps,
      operatingIncome: data.operatingIncome,
      freeCashFlow: data.freeCashFlow,
      segments: data.segments
    }
  }));
  
  console.log(`✅ Saved quarterly data for ${data.quarter}`);
  
  // Save AWS segment data separately for easy querying
  if (data.segments?.aws) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `COMPANY#${data.ticker}`,
        SK: `SEGMENT#AWS#${data.reportDate}`,
        quarter: data.quarter,
        reportDate: data.reportDate,
        segmentName: 'AWS',
        revenue: data.segments.aws.revenue,
        operatingIncome: data.segments.aws.operatingIncome,
        operatingMargin: data.segments.aws.operatingMargin
      }
    }));
    
    console.log(`✅ Saved AWS segment data for ${data.quarter}`);
  }
}

async function main() {
  try {
    console.log('🚀 Starting Amazon historical data collection...\n');
    
    // Process each quarter
    for (const quarterInfo of QUARTERS) {
      console.log(`\n📊 Processing ${quarterInfo.quarter}...`);
      
      try {
        // Download and upload to S3
        const filename = await downloadAndUpload10Q(quarterInfo);
        
        if (filename) {
          // Extract financial data using Claude
          const data = await extractFinancialData(`AMZN/${filename}`, quarterInfo);
          
          // Save to DynamoDB
          await saveToDynamoDB(data);
          
          console.log(`✅ Successfully processed ${quarterInfo.quarter}\n`);
        }
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Error processing ${quarterInfo.quarter}:`, error.message);
        console.error(error.stack);
        continue; // Continue with next quarter
      }
    }
    
    console.log('\n🎉 Historical data collection completed!');
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run the script
main();

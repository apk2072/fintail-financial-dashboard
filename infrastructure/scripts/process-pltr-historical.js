const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize AWS clients
const s3Client = new S3Client({ region: 'us-east-1' });
const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = 'fintail-companies-development';
const BUCKET_NAME = 'fintail-financial-reports-096719769686';

// Quarters to process with their metadata
const QUARTERS = [
  { filename: 'pltr-q3-2025.pdf', quarter: 'Q3 2025', reportDate: '2025-09-30' },
  { filename: 'pltr-q2-2025.pdf', quarter: 'Q2 2025', reportDate: '2025-06-30' },
  { filename: 'pltr-q1-2025.pdf', quarter: 'Q1 2025', reportDate: '2025-03-31' },
  { filename: 'pltr-q3-2024.pdf', quarter: 'Q3 2024', reportDate: '2024-09-30' },
  { filename: 'pltr-q2-2024.pdf', quarter: 'Q2 2024', reportDate: '2024-06-30' },
  { filename: 'pltr-q1-2024.pdf', quarter: 'Q1 2024', reportDate: '2024-03-31' }
];

async function extractFinancialData(s3Key, quarterInfo) {
  console.log(`\n📊 Extracting financial data for ${quarterInfo.quarter}...`);
  
  // Download PDF from S3
  const getObjectCommand = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key
  });
  
  const pdfData = await s3Client.send(getObjectCommand);
  const chunks = [];
  for await (const chunk of pdfData.Body) {
    chunks.push(chunk);
  }
  const pdfBuffer = Buffer.concat(chunks);
  const pdfBase64 = pdfBuffer.toString('base64');
  
  const prompt = `You are a financial data extraction expert. Extract the ${quarterInfo.quarter} financial data from this Palantir 10-Q report.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "company": "Palantir Technologies Inc.",
  "ticker": "PLTR",
  "quarter": "${quarterInfo.quarter}",
  "reportDate": "${quarterInfo.reportDate}",
  "totalRevenue": number (in dollars),
  "netIncome": number (in dollars),
  "eps": number (earnings per share as decimal),
  "operatingIncome": number (in dollars),
  "freeCashFlow": number (in dollars, if available, otherwise null),
  "segments": {
    "government": {
      "revenue": number (Government segment revenue in dollars, if reported)
    },
    "commercial": {
      "revenue": number (Commercial segment revenue in dollars, if reported)
    }
  }
}

Extract the actual numbers from the document. Convert all values to raw numbers (e.g., "$726 million" becomes 726000000).
For segment data, look for "Government" and "Commercial" segment reporting in the 10-Q filing.
Make sure to extract the correct quarter's data matching ${quarterInfo.quarter}.`;

  const invokeCommand = new InvokeModelCommand({
    modelId: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
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

  const response = await bedrock.send(invokeCommand);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  const extractedText = responseBody.content[0].text;
  
  // Remove markdown code blocks if present
  const jsonText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const data = JSON.parse(jsonText);
  
  console.log('Extracted data:', JSON.stringify(data, null, 2));
  
  return data;
}

async function saveToDynamoDB(data) {
  console.log('💾 Saving to DynamoDB...');
  
  // Save quarterly data
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `COMPANY#${data.ticker}`,
      SK: `QUARTER#${data.reportDate}`,
      quarter: data.quarter,
      reportDate: data.reportDate,
      totalRevenue: data.totalRevenue,
      netIncome: data.netIncome,
      eps: data.eps,
      operatingIncome: data.operatingIncome,
      freeCashFlow: data.freeCashFlow,
      segments: data.segments
    }
  }));
  
  console.log(`✅ Saved quarterly data for ${data.quarter}`);
  
  // Save Government segment data separately
  if (data.segments?.government?.revenue) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `COMPANY#${data.ticker}`,
        SK: `SEGMENT#GOVERNMENT#${data.reportDate}`,
        quarter: data.quarter,
        reportDate: data.reportDate,
        segmentName: 'Government',
        revenue: data.segments.government.revenue
      }
    }));
    console.log(`✅ Saved Government segment data for ${data.quarter}`);
  }
  
  // Save Commercial segment data separately
  if (data.segments?.commercial?.revenue) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `COMPANY#${data.ticker}`,
        SK: `SEGMENT#COMMERCIAL#${data.reportDate}`,
        quarter: data.quarter,
        reportDate: data.reportDate,
        segmentName: 'Commercial',
        revenue: data.segments.commercial.revenue
      }
    }));
    console.log(`✅ Saved Commercial segment data for ${data.quarter}`);
  }
}

async function saveCompanyMetadata() {
  console.log('💾 Saving company metadata...');
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: 'COMPANY#PLTR',
      SK: 'METADATA',
      name: 'Palantir Technologies Inc.',
      ticker: 'PLTR',
      sector: 'Technology',
      industry: 'Software - Infrastructure',
      marketCap: 424084799488, // Updated from Yahoo Finance (Nov 2025)
      lastUpdated: new Date().toISOString(),
      GSI1PK: 'SECTOR#Technology',
      GSI1SK: 'COMPANY#Palantir Technologies Inc.'
    }
  }));
  
  console.log('✅ Saved company metadata');
}

async function main() {
  try {
    console.log('🚀 Starting Palantir historical data processing from S3...\n');
    console.log(`Processing ${QUARTERS.length} quarters\n`);
    
    // Save company metadata first
    await saveCompanyMetadata();
    
    // Process each quarter
    for (const quarterInfo of QUARTERS) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing ${quarterInfo.quarter} (${quarterInfo.filename})`);
      console.log('='.repeat(60));
      
      try {
        const s3Key = `PLTR/${quarterInfo.filename}`;
        
        // Extract financial data using Claude
        const data = await extractFinancialData(s3Key, quarterInfo);
        
        // Save to DynamoDB
        await saveToDynamoDB(data);
        
        console.log(`\n✅ Successfully processed ${quarterInfo.quarter}`);
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`\n❌ Error processing ${quarterInfo.quarter}:`, error.message);
        console.error(error.stack);
        continue; // Continue with next quarter
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Historical data processing completed!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run the script
main();

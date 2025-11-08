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
  { filename: 'amzn-q1-2025.pdf', quarter: 'Q1 2025', reportDate: '2025-03-31' },
  { filename: 'amzn-q2-2025.pdf', quarter: 'Q2 2025', reportDate: '2025-06-30' },
  { filename: 'amzn-q4-2024.pdf', quarter: 'Q4 2024', reportDate: '2024-12-31' },
  { filename: 'amzn-q3-2024.pdf', quarter: 'Q3 2024', reportDate: '2024-09-30' },
  { filename: 'amzn-q2-2024.pdf', quarter: 'Q2 2024', reportDate: '2024-06-30' },
  { filename: 'amzn-q1-2024.pdf', quarter: 'Q1 2024', reportDate: '2024-03-31' },
  { filename: 'amzn-q4-2023.pdf', quarter: 'Q4 2023', reportDate: '2023-12-31' }
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
  "eps": number (earnings per share as decimal),
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
For AWS segment data, look for "Amazon Web Services" or "AWS" segment reporting in the 10-Q filing.
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
    console.log('🚀 Starting Amazon historical data processing from S3...\n');
    console.log(`Processing ${QUARTERS.length} quarters\n`);
    
    // Process each quarter
    for (const quarterInfo of QUARTERS) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing ${quarterInfo.quarter} (${quarterInfo.filename})`);
      console.log('='.repeat(60));
      
      try {
        const s3Key = `AMZN/${quarterInfo.filename}`;
        
        // Extract financial data using Claude
        const data = await extractFinancialData(s3Key, quarterInfo);
        
        // Save to DynamoDB
        await saveToDynamoDB(data);
        
        console.log(`\n✅ Successfully processed ${quarterInfo.quarter}`);
        
        // Add delay between requests to avoid rate limiting
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

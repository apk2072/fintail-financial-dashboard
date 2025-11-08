const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const s3Client = new S3Client({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new BedrockRuntimeClient({ region: 'us-west-2' });

const TABLE_NAME = 'fintail-companies-development';
const BUCKET_NAME = 'fintail-financial-reports-096719769686';
const MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

async function extractTextFromPDF(bucket, key) {
  console.log(`Downloading ${key}...`);
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);
  
  // For simplicity, we'll use the earnings call transcript which is text-based
  const stream = response.Body;
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function extractFinancialData(text, ticker) {
  console.log(`Extracting financial data for ${ticker} using Bedrock...`);
  
  const prompt = `Extract the Q3 2025 financial data from this Meta earnings document. 

Document text (first 15000 chars):
${text.substring(0, 15000)}

Extract and return ONLY a JSON object with this exact structure (no additional text):
{
  "quarter": "Q3 2025",
  "reportDate": "2025-09-30",
  "totalRevenue": <number in dollars>,
  "netIncome": <number in dollars>,
  "eps": <number>,
  "operatingIncome": <number in dollars>,
  "freeCashFlow": <number in dollars>
}

Use the actual numbers from the document. Return ONLY the JSON, no explanation.`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: prompt
    }],
    temperature: 0.1
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload)
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text_response = responseBody.content[0].text;
  
  // Extract JSON from response
  const jsonMatch = text_response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error('Could not extract JSON from Bedrock response');
}

async function clearProjectionCache(ticker) {
  console.log(`Clearing projection cache for ${ticker}...`);
  try {
    const today = new Date().toISOString().split('T')[0];
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `PROJECTION#${ticker}`,
        SK: today
      }
    }));
    console.log(`✓ Cleared projection cache for ${ticker}`);
  } catch (error) {
    console.log(`No cache to clear for ${ticker}`);
  }
}

async function updateCompanyData(ticker, financialData) {
  console.log(`Updating ${ticker} financial data in DynamoDB...`);
  
  // Add the quarterly data
  const item = {
    PK: `COMPANY#${ticker}`,
    SK: `QUARTER#${financialData.reportDate}`,
    quarter: financialData.quarter,
    reportDate: financialData.reportDate,
    totalRevenue: financialData.totalRevenue,
    netSales: financialData.totalRevenue,
    netIncome: financialData.netIncome,
    eps: financialData.eps,
    operatingIncome: financialData.operatingIncome,
    freeCashFlow: financialData.freeCashFlow,
    lastUpdated: new Date().toISOString()
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  }));

  console.log(`✓ Updated ${ticker} ${financialData.quarter} data`);
}

async function main() {
  try {
    console.log('Processing META Q3 2025 earnings report...\n');
    
    // Use the earnings call transcript (easier to parse than PDF)
    const key = 'META/META-Q3-2025-Earnings-Call-Transcript.pdf';
    
    // Download and extract text
    const text = await extractTextFromPDF(BUCKET_NAME, key);
    console.log(`✓ Downloaded document (${text.length} characters)\n`);
    
    // Extract financial data using Bedrock
    const financialData = await extractFinancialData(text, 'META');
    console.log('✓ Extracted financial data:');
    console.log(JSON.stringify(financialData, null, 2));
    console.log();
    
    // Update DynamoDB
    await updateCompanyData('META', financialData);
    
    // Clear projection cache
    await clearProjectionCache('META');
    
    console.log('\n✅ Successfully processed META Q3 2025 earnings!');
    console.log('\nYou can now view the updated data at:');
    console.log('https://dgoske3le3stp.cloudfront.net/company/META');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

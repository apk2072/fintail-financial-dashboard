const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: 'us-east-1' });
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });

const TABLE_NAME = 'fintail-companies-development';
const BUCKET_NAME = 'fintail-financial-reports-096719769686';
const PDF_KEY = 'AMZN-Q3-2025-Earnings-Release.pdf';

async function clearOldData() {
  console.log('Clearing old Amazon data...');
  
  const queryResult = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'COMPANY#AMZN'
    }
  }));

  for (const item of queryResult.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: item.PK,
        SK: item.SK
      }
    }));
    console.log(`Deleted: ${item.SK}`);
  }
}

async function extractTextFromPDF() {
  console.log('Downloading PDF from S3...');
  
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: PDF_KEY
  }));

  const pdfBuffer = await streamToBuffer(response.Body);
  return pdfBuffer.toString('base64');
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function extractFinancialData(pdfBase64) {
  console.log('Extracting financial data using Claude...');
  
  const prompt = `You are a financial data extraction expert. Extract the Q3 2025 financial data from this Amazon earnings report.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "company": "Amazon.com Inc.",
  "ticker": "AMZN",
  "quarter": "Q3 2025",
  "reportDate": "YYYY-MM-DD",
  "netSales": number (in dollars),
  "totalRevenue": number (in dollars),
  "netIncome": number (in dollars),
  "eps": number (earnings per share),
  "operatingIncome": number (in dollars),
  "freeCashFlow": number (in dollars, if available, otherwise null),
  "marketCap": number (market capitalization in dollars, if mentioned, otherwise calculate from stock price and shares outstanding),
  "segments": {
    "aws": {
      "revenue": number (AWS segment revenue in dollars),
      "operatingIncome": number (AWS operating income in dollars),
      "operatingMargin": number (AWS operating margin as percentage, e.g., 38.1)
    }
  }
}

Extract the actual numbers from the document. Convert all values to raw numbers (e.g., "$158.9 billion" becomes 158900000000).
For AWS segment data, look for "Amazon Web Services" or "AWS" segment reporting in the earnings release.
For market cap, if not directly stated, you can estimate it from the stock price and shares outstanding mentioned in the report.`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4096,
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
  };

  const command = new InvokeModelCommand({
    modelId: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload)
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  console.log('Claude response:', JSON.stringify(responseBody, null, 2));
  
  const extractedText = responseBody.content[0].text;
  const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error('Could not extract JSON from response');
  }
  
  return JSON.parse(jsonMatch[0]);
}

async function saveToDatabase(data) {
  console.log('Saving to DynamoDB...');
  
  // Save company metadata
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `COMPANY#${data.ticker}`,
      SK: 'METADATA',
      name: data.company,
      ticker: data.ticker,
      sector: 'Technology',
      industry: 'E-commerce & Cloud Computing',
      marketCap: data.marketCap || 2100000000000, // Default to ~2.1T if not extracted
      lastUpdated: new Date().toISOString(),
      GSI1PK: 'SECTOR#Technology',
      GSI1SK: `COMPANY#${data.company}`
    }
  }));
  console.log('Saved company metadata');

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
  console.log('Saved quarterly data');
  
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
    console.log('Saved AWS segment data');
  }
}

async function main() {
  try {
    await clearOldData();
    const pdfBase64 = await extractTextFromPDF();
    const financialData = await extractFinancialData(pdfBase64);
    console.log('Extracted data:', JSON.stringify(financialData, null, 2));
    await saveToDatabase(financialData);
    console.log('✅ Successfully processed Amazon Q3 2025 data!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

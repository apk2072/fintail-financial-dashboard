import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const s3Client = new S3Client({});
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.TABLE_NAME!;

interface ExtractedFinancials {
  ticker: string;
  companyName: string;
  quarter: string;
  reportDate: string;
  totalRevenue: number;
  netSales: number;
  netIncome: number;
  eps: number;
  operatingIncome: number;
  freeCashFlow: number;
}

export const handler = async (event: S3Event) => {
  console.log('Processing S3 event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing file: ${key} from bucket: ${bucket}`);

    try {
      // Get the document from S3
      const s3Response = await s3Client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );

      const documentContent = await streamToString(s3Response.Body as any);

      // Extract financial data using Bedrock Claude
      const financialData = await extractFinancialData(documentContent, key);

      // Store in DynamoDB
      await storeFinancialData(financialData);

      console.log(`Successfully processed ${key}`);
    } catch (error) {
      console.error(`Error processing ${key}:`, error);
      throw error;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Processing complete' }),
  };
};

async function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

async function extractFinancialData(
  documentContent: string,
  fileName: string
): Promise<ExtractedFinancials> {
  // For PDFs, use a more focused prompt since we can't extract text perfectly
  const prompt = `You are a financial analyst extracting data from quarterly earnings reports.

Extract the following financial metrics from this Amazon Q3 2025 earnings report:
- Company Name
- Stock Ticker Symbol  
- Quarter (e.g., "Q3 2025")
- Report Date (YYYY-MM-DD format, use September 30, 2025 for Q3 2025)
- Total Revenue (in dollars)
- Net Sales (in dollars, same as revenue for Amazon)
- Net Income (in dollars)
- Earnings Per Share (EPS in dollars)
- Operating Income (in dollars)
- Free Cash Flow (in dollars, or Operating Cash Flow if FCF not available)

Look for the consolidated statements of operations and cash flow statements.

Document: ${fileName}
Content preview: ${documentContent.substring(0, 10000)}

Return ONLY a valid JSON object with these exact fields (no markdown, no explanation):
{
  "ticker": "AMZN",
  "companyName": "Amazon.com Inc.",
  "quarter": "Q3 2025",
  "reportDate": "2025-09-30",
  "totalRevenue": 158877000000,
  "netSales": 158877000000,
  "netIncome": 15328000000,
  "eps": 1.43,
  "operatingIncome": 17411000000,
  "freeCashFlow": 47660000000
}`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const command = new InvokeModelCommand({
    modelId: 'us.anthropic.claude-3-5-sonnet-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  console.log('Bedrock response:', JSON.stringify(responseBody, null, 2));

  // Extract JSON from Claude's response
  const content = responseBody.content[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error('Could not extract JSON from Claude response');
  }

  const extractedData = JSON.parse(jsonMatch[0]);
  return extractedData;
}

async function storeFinancialData(data: ExtractedFinancials) {
  // Store company metadata if not exists
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `COMPANY#${data.ticker}`,
        SK: 'METADATA',
        ticker: data.ticker,
        name: data.companyName,
        lastUpdated: new Date().toISOString(),
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    })
  ).catch(() => {
    // Ignore if already exists
    console.log(`Company ${data.ticker} metadata already exists`);
  });

  // Store quarterly data
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `COMPANY#${data.ticker}`,
        SK: `QUARTER#${data.reportDate}`,
        ticker: data.ticker,
        quarter: data.quarter,
        reportDate: data.reportDate,
        totalRevenue: data.totalRevenue,
        netSales: data.netSales,
        netIncome: data.netIncome,
        eps: data.eps,
        operatingIncome: data.operatingIncome,
        freeCashFlow: data.freeCashFlow,
      },
    })
  );

  console.log(`Stored financial data for ${data.ticker} ${data.quarter}`);
}

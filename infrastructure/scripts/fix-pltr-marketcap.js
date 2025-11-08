const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = 'fintail-companies-development';

async function fixMarketCap() {
  console.log('Fixing PLTR market cap...');
  
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: 'COMPANY#PLTR',
      SK: 'METADATA'
    },
    UpdateExpression: 'SET marketCap = :mc',
    ExpressionAttributeValues: {
      ':mc': 180000000000  // $180B
    }
  }));
  
  console.log('✅ Updated PLTR market cap to $180B');
}

fixMarketCap().catch(console.error);

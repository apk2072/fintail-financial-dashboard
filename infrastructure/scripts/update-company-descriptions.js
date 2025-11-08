const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = 'fintail-companies-development';

async function updateCompanyDescriptions() {
  console.log('🚀 Updating company descriptions...\n');

  // Update Amazon description
  console.log('Updating Amazon...');
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: 'COMPANY#AMZN',
      SK: 'METADATA'
    },
    UpdateExpression: 'SET description = :desc',
    ExpressionAttributeValues: {
      ':desc': 'Amazon.com, Inc. is an American multinational technology company focusing on e-commerce, cloud computing, online advertising, digital streaming, and artificial intelligence. Amazon Web Services (AWS) is the world\'s most comprehensive and broadly adopted cloud platform, offering over 200 fully featured services from data centers globally.'
    }
  }));
  console.log('✅ Updated Amazon description');

  // Update Palantir description
  console.log('Updating Palantir...');
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: 'COMPANY#PLTR',
      SK: 'METADATA'
    },
    UpdateExpression: 'SET description = :desc',
    ExpressionAttributeValues: {
      ':desc': 'Palantir Technologies Inc. builds and deploys software platforms for the intelligence community and defense sector to assist in counterterrorism investigations and operations. The company also serves commercial clients in industries including healthcare, energy, finance, and manufacturing with data integration and analytics solutions.'
    }
  }));
  console.log('✅ Updated Palantir description');

  // Update Meta description
  console.log('Updating Meta...');
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: 'COMPANY#META',
      SK: 'METADATA'
    },
    UpdateExpression: 'SET description = :desc',
    ExpressionAttributeValues: {
      ':desc': 'Meta Platforms, Inc. develops products that enable people to connect and share with friends and family through mobile devices, personal computers, virtual reality headsets, and wearables. The company operates Facebook, Instagram, Messenger, WhatsApp, and develops virtual and augmented reality technologies through Reality Labs.'
    }
  }));
  console.log('✅ Updated Meta description');

  console.log('\n🎉 All company descriptions updated successfully!');
}

updateCompanyDescriptions().catch(console.error);

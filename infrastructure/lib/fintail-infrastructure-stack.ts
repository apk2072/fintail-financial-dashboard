import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface FintailInfrastructureStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
  environmentName: string;
}

export class FintailInfrastructureStack extends cdk.Stack {
  public readonly companyTable: dynamodb.Table;
  public readonly api: apigateway.RestApi;
  public readonly websiteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  private readonly config: EnvironmentConfig;
  private readonly environmentName: string;

  constructor(scope: Construct, id: string, props: FintailInfrastructureStackProps) {
    super(scope, id, props);
    
    this.config = props.environmentConfig;
    this.environmentName = props.environmentName;

    // DynamoDB table for companies and quarterly financials
    this.companyTable = new dynamodb.Table(this, 'CompanyTable', {
      tableName: `fintail-companies-${this.environmentName}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: this.config.enablePointInTimeRecovery,
      },
      removalPolicy: this.config.removalPolicy === 'DESTROY' 
        ? cdk.RemovalPolicy.DESTROY 
        : cdk.RemovalPolicy.RETAIN,
    });

    // Global Secondary Index for sector-based queries
    this.companyTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Global Secondary Index for search functionality
    this.companyTable.addGlobalSecondaryIndex({
      indexName: 'SearchIndex',
      partitionKey: {
        name: 'SearchPK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SearchSK',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // S3 bucket for financial reports
    const financialReportsBucket = new s3.Bucket(this, 'FinancialReportsBucket', {
      bucketName: `fintail-financial-reports-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(365), // Keep reports for 1 year
        },
      ],
    });

    // Output the table name for reference
    new cdk.CfnOutput(this, 'CompanyTableName', {
      value: this.companyTable.tableName,
      description: 'Name of the DynamoDB table for companies and financial data',
    });

    new cdk.CfnOutput(this, 'CompanyTableArn', {
      value: this.companyTable.tableArn,
      description: 'ARN of the DynamoDB table for companies and financial data',
    });

    new cdk.CfnOutput(this, 'FinancialReportsBucketName', {
      value: financialReportsBucket.bucketName,
      description: 'S3 bucket for storing financial reports',
    });

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant DynamoDB permissions to Lambda role
    this.companyTable.grantReadWriteData(lambdaRole);

    // Bedrock document processor role
    const bedrockProcessorRole = new iam.Role(this, 'BedrockProcessorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant permissions
    this.companyTable.grantReadWriteData(bedrockProcessorRole);
    financialReportsBucket.grantRead(bedrockProcessorRole);
    
    // Grant Bedrock permissions (using cross-region inference profiles)
    bedrockProcessorRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:us-east-1:${cdk.Aws.ACCOUNT_ID}:inference-profile/*`,
        ],
      })
    );

    // Companies Lambda function
    const companiesFunction = new lambda.Function(this, 'CompaniesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'companies.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      role: lambdaRole,
      environment: {
        TABLE_NAME: this.companyTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Search Lambda function
    const searchFunction = new lambda.Function(this, 'SearchFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'search.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      role: lambdaRole,
      environment: {
        TABLE_NAME: this.companyTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Data sync Lambda function
    const dataSyncFunction = new lambda.Function(this, 'DataSyncFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'data-sync.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      role: lambdaRole,
      environment: {
        TABLE_NAME: this.companyTable.tableName,
        // API keys will be set via environment variables or AWS Secrets Manager
        // ALPHA_VANTAGE_API_KEY: 'your-api-key-here',
        // FMP_API_KEY: 'your-api-key-here',
      },
      timeout: cdk.Duration.minutes(15), // Longer timeout for data processing
      memorySize: 1024, // More memory for data processing
    });

    // Bedrock document processor Lambda
    const bedrockProcessorFunction = new lambda.Function(this, 'BedrockDocumentProcessor', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'bedrock-document-processor.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      role: bedrockProcessorRole,
      environment: {
        TABLE_NAME: this.companyTable.tableName,
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 2048, // More memory for document processing
    });

    // Stock projection Lambda function
    const projectionRole = new iam.Role(this, 'ProjectionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    this.companyTable.grantReadWriteData(projectionRole);
    
    projectionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:us-west-2::foundation-model/*`,
          `arn:aws:bedrock:us-east-1::foundation-model/*`,
        ],
      })
    );

    const projectionFunction = new lambda.Function(this, 'ProjectionFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'stock-projection.handler',
      code: lambda.Code.fromAsset('lambda/dist'),
      role: projectionRole,
      environment: {
        TABLE_NAME: this.companyTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
    });

    // S3 trigger for document processor (PDF files)
    bedrockProcessorFunction.addEventSource(
      new lambdaEventSources.S3EventSource(financialReportsBucket, {
        events: [s3.EventType.OBJECT_CREATED],
        filters: [{ suffix: '.pdf' }],
      })
    );

    // API Gateway
    this.api = new apigateway.RestApi(this, 'FintailApi', {
      restApiName: 'Fintail Financial Dashboard API',
      description: 'API for the Fintail Financial Dashboard',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // API Gateway integrations
    const companiesIntegration = new apigateway.LambdaIntegration(companiesFunction);
    const searchIntegration = new apigateway.LambdaIntegration(searchFunction);
    const projectionIntegration = new apigateway.LambdaIntegration(projectionFunction);

    // API routes
    const companiesResource = this.api.root.addResource('companies');
    companiesResource.addMethod('GET', companiesIntegration); // GET /companies
    
    const companyResource = companiesResource.addResource('{ticker}');
    companyResource.addMethod('GET', companiesIntegration); // GET /companies/{ticker}
    
    const projectionResource = companyResource.addResource('projection');
    projectionResource.addMethod('GET', projectionIntegration); // GET /companies/{ticker}/projection
    
    const segmentsResource = companyResource.addResource('segments');
    const segmentResource = segmentsResource.addResource('{segment}');
    segmentResource.addMethod('GET', companiesIntegration); // GET /companies/{ticker}/segments/{segment}

    const searchResource = this.api.root.addResource('search');
    searchResource.addMethod('GET', searchIntegration); // GET /search

    // Output API Gateway URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'URL of the API Gateway',
    });

    // S3 bucket for static website hosting
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `fintail-website-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA routing
      publicReadAccess: false, // We'll use CloudFront OAC
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
      autoDeleteObjects: true, // For development
    });

    // Origin Access Control for CloudFront
    const originAccessControl = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      description: 'OAC for Fintail website',
    });

    // CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.websiteBucket, {
          originAccessControl,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.RestApiOrigin(this.api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US, Canada, Europe
      comment: 'Fintail Financial Dashboard Distribution',
    });

    // Grant CloudFront access to S3 bucket
    this.websiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [this.websiteBucket.arnForObjects('*')],
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${this.distribution.distributionId}`,
          },
        },
      })
    );

    // Output CloudFront URL
    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'URL of the CloudFront distribution',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: this.websiteBucket.bucketName,
      description: 'Name of the S3 bucket for website hosting',
    });

    // EventBridge rule for daily data sync (6 AM EST = 11 AM UTC)
    const dataSyncRule = new events.Rule(this, 'DataSyncRule', {
      description: 'Trigger daily financial data synchronization',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '11', // 11 AM UTC = 6 AM EST
        day: '*',
        month: '*',
        year: '*',
      }),
    });

    // Add Lambda target to the rule
    dataSyncRule.addTarget(new targets.LambdaFunction(dataSyncFunction));

    // Output the data sync function name
    new cdk.CfnOutput(this, 'DataSyncFunctionName', {
      value: dataSyncFunction.functionName,
      description: 'Name of the data sync Lambda function',
    });

    // Set up monitoring and alerting
    this.setupMonitoring(companiesFunction, searchFunction, dataSyncFunction);
  }

  private setupMonitoring(
    companiesFunction: lambda.Function,
    searchFunction: lambda.Function,
    dataSyncFunction: lambda.Function
  ) {
    if (!this.config.monitoring.enableDetailedMetrics) {
      return;
    }

    // SNS topic for alerts
    let alertTopic: sns.Topic | undefined;
    if (this.config.monitoring.alarmEmail) {
      alertTopic = new sns.Topic(this, 'AlertTopic', {
        displayName: `Fintail Alerts - ${this.environmentName}`,
      });

      alertTopic.addSubscription(
        new subscriptions.EmailSubscription(this.config.monitoring.alarmEmail)
      );
    }

    // Lambda function alarms
    const functions = [
      { func: companiesFunction, name: 'Companies' },
      { func: searchFunction, name: 'Search' },
      { func: dataSyncFunction, name: 'DataSync' },
    ];

    functions.forEach(({ func, name }) => {
      // Error rate alarm
      const errorAlarm = new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        metric: func.metricErrors({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 2,
        alarmDescription: `${name} function error rate is too high`,
      });

      // Duration alarm
      const durationAlarm = new cloudwatch.Alarm(this, `${name}DurationAlarm`, {
        metric: func.metricDuration({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 25000, // 25 seconds
        evaluationPeriods: 3,
        alarmDescription: `${name} function duration is too high`,
      });

      // Throttle alarm
      const throttleAlarm = new cloudwatch.Alarm(this, `${name}ThrottleAlarm`, {
        metric: func.metricThrottles({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `${name} function is being throttled`,
      });

      if (alertTopic) {
        errorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
        durationAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
        throttleAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
      }
    });

    // DynamoDB alarms
    const readThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoDBReadThrottleAlarm', {
      metric: this.companyTable.metricUserErrors({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      alarmDescription: 'DynamoDB read throttling detected',
    });

    if (alertTopic) {
      readThrottleAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
    }

    // API Gateway alarms
    const apiErrorAlarm = new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      metric: this.api.metricServerError({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 2,
      alarmDescription: 'API Gateway 5xx error rate is too high',
    });

    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiGatewayLatencyAlarm', {
      metric: this.api.metricLatency({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5000, // 5 seconds
      evaluationPeriods: 3,
      alarmDescription: 'API Gateway latency is too high',
    });

    if (alertTopic) {
      apiErrorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
      apiLatencyAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
    }

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'FintailDashboard', {
      dashboardName: `Fintail-${this.environmentName}`,
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [
          companiesFunction.metricInvocations(),
          searchFunction.metricInvocations(),
          dataSyncFunction.metricInvocations(),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [
          companiesFunction.metricErrors(),
          searchFunction.metricErrors(),
          dataSyncFunction.metricErrors(),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [
          companiesFunction.metricDuration(),
          searchFunction.metricDuration(),
          dataSyncFunction.metricDuration(),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Metrics',
        left: [this.api.metricCount()],
        right: [this.api.metricLatency()],
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Metrics',
        left: [
          this.companyTable.metricConsumedReadCapacityUnits(),
          this.companyTable.metricConsumedWriteCapacityUnits(),
        ],
      })
    );
  }
}

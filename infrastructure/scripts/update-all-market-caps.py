#!/usr/bin/env python3
"""
Update market caps for all companies from Yahoo Finance using yfinance library.
This script is more reliable than direct API calls as it handles rate limiting better.
"""
import json
import subprocess
import sys

try:
    import yfinance as yf
    import boto3
except ImportError:
    print("Installing required packages...")
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'yfinance', 'boto3', '-q'])
    import yfinance as yf
    import boto3

# Initialize DynamoDB client
dynamodb = boto3.client('dynamodb', region_name='us-east-1')
TABLE_NAME = 'fintail-companies-development'

def update_market_cap(ticker):
    """Fetch and update market cap for a given ticker"""
    print(f"\nFetching data for {ticker}...")
    
    try:
        # Fetch data from Yahoo Finance
        stock = yf.Ticker(ticker)
        info = stock.info
        
        market_cap = info.get('marketCap')
        current_price = info.get('currentPrice', info.get('regularMarketPrice'))
        shares_outstanding = info.get('sharesOutstanding')
        
        if not market_cap:
            print(f"❌ No market cap data available for {ticker}")
            return
        
        print(f"   Stock Price: ${current_price:.2f}")
        print(f"   Market Cap: ${market_cap / 1e9:.2f}B")
        print(f"   Shares Outstanding: {shares_outstanding:,}")
        
        # Update DynamoDB
        dynamodb.update_item(
            TableName=TABLE_NAME,
            Key={
                'PK': {'S': f'COMPANY#{ticker}'},
                'SK': {'S': 'METADATA'}
            },
            UpdateExpression='SET marketCap = :mc',
            ExpressionAttributeValues={
                ':mc': {'N': str(market_cap)}
            }
        )
        
        print(f"✅ Updated {ticker} market cap in DynamoDB")
        
    except Exception as e:
        print(f"❌ Error updating {ticker}: {str(e)}")

def main():
    print("🚀 Updating market caps from Yahoo Finance...\n")
    
    tickers = ['PLTR', 'AMZN', 'META']
    
    for ticker in tickers:
        update_market_cap(ticker)
    
    print("\n🎉 Market cap updates completed!")

if __name__ == '__main__':
    main()

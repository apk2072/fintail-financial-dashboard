#!/usr/bin/env python3
import json
try:
    import yfinance as yf
except ImportError:
    print("Installing yfinance...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'yfinance', '-q'])
    import yfinance as yf

# Fetch PLTR data
ticker = yf.Ticker("PLTR")
info = ticker.info

print(f"\n✅ PLTR Market Data:")
print(f"   Stock Price: ${info.get('currentPrice', info.get('regularMarketPrice', 'N/A'))}")
print(f"   Market Cap: ${info.get('marketCap', 0) / 1e9:.2f}B")
print(f"   Market Cap (raw): {info.get('marketCap', 0)}")
print(f"   Shares Outstanding: {info.get('sharesOutstanding', 0):,}")

import MetaTrader5 as mt5
import sys
import json
import datetime

def get_tf(tf_str):
    mapping = {
        '1m': mt5.TIMEFRAME_M1,
        '5m': mt5.TIMEFRAME_M5,
        '15m': mt5.TIMEFRAME_M15,
        '1h': mt5.TIMEFRAME_H1,
        '4h': mt5.TIMEFRAME_H4,
        '1d': mt5.TIMEFRAME_D1
    }
    return mapping.get(tf_str.lower(), mt5.TIMEFRAME_M15)

def main():
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: python mt5_bridge.py <symbol> <timeframe> <limit>"}))
        sys.exit(1)
        
    symbol = sys.argv[1]
    tf_str = sys.argv[2]
    limit = int(sys.argv[3])
    
    if not mt5.initialize():
        print(json.dumps({"error": f"initialize() failed, error code = {mt5.last_error()}"}))
        sys.exit(1)
        
    tf = get_tf(tf_str)
    
    rates = mt5.copy_rates_from_pos(symbol, tf, 0, limit)
    
    if rates is None:
        print(json.dumps({"error": f"Failed to get rates for {symbol}, error code = {mt5.last_error()}"}))
        mt5.shutdown()
        sys.exit(1)
        
    # Convert to the format expected by indicators.js:
    # { time: timestamp_ms, open, high, low, close, volume }
    formatted = []
    for r in rates:
        formatted.append({
            "time": int(r['time']) * 1000,
            "open": float(r['open']),
            "high": float(r['high']),
            "low": float(r['low']),
            "close": float(r['close']),
            "volume": float(r['tick_volume'])
        })
        
    mt5.shutdown()
    print(json.dumps(formatted))

if __name__ == '__main__':
    main()

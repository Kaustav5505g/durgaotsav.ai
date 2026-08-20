from flask import Flask, render_template, jsonify, request
import joblib
import pandas as pd
import numpy as np
import json
import os
import logging

app = Flask(__name__)
logger = logging.getLogger(__name__)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE, 'data')
DATASET_PATH = os.path.join(DATA_DIR, 'durgotsavai_crowd_data (1).csv')
crowd_dataset = pd.read_csv(DATASET_PATH)
model = joblib.load(os.path.join(DATA_DIR, 'durgotsavai_model.pkl'))
le_weather = joblib.load(os.path.join(DATA_DIR, 'le_weather.pkl'))
le_pandal = joblib.load(os.path.join(DATA_DIR, 'le_pandal.pkl'))
with open(os.path.join(DATA_DIR, 'pandals.json'), encoding='utf-8') as handle:
    pandal_coordinates = {p['name']: p for p in json.load(handle)}
with open(os.path.join(DATA_DIR, 'model_metrics.json'), encoding='utf-8') as handle:
    model_metrics = json.load(handle)

pandals = [
    pandal_coordinates[name] | {'name': name, 'popularity': pandal_coordinates[name]['popularity']}
    for name in le_pandal.classes_ if name in pandal_coordinates
]


def predict_risk(pandal_name, popularity, hour, weather):
    weather_enc = le_weather.transform([weather])[0]
    pandal_enc = le_pandal.transform([pandal_name])[0]
    features = pd.DataFrame([{
        'hour': hour,
        'weather': weather_enc,
        'popularity_score': popularity,
        'historical_density': popularity / 10,
        'pandal': pandal_enc,
    }])
    return model.predict(features)[0]

def build_predictions(hour, weather):
    weather_enc = le_weather.transform([weather])[0]
    feature_rows = []
    forecast_keys = []
    for pandal in pandals:
        pandal_enc = le_pandal.transform([pandal['name']])[0]
        for forecast_hour in range(hour, hour + 6):
            feature_rows.append({
                'hour': forecast_hour % 24,
                'weather': weather_enc,
                'popularity_score': pandal['popularity'],
                'historical_density': pandal['popularity'] / 10,
                'pandal': pandal_enc,
            })
            forecast_keys.append((pandal['name'], forecast_hour % 24))

    predictions = model.predict(pd.DataFrame(feature_rows))
    risk_by_pandal = {}
    for (pandal_name, forecast_hour), risk in zip(forecast_keys, predictions):
        risk_by_pandal.setdefault(pandal_name, []).append({'hour': forecast_hour, 'risk': risk})

    results = []
    for pandal in pandals:
        forecast = risk_by_pandal[pandal['name']]
        results.append({
            'name': pandal['name'], 'lat': pandal['lat'], 'lon': pandal['lon'],
            'popularity': pandal['popularity'], 'risk': forecast[0]['risk'],
            'hour': hour, 'weather': weather, 'forecast': forecast,
        })
    return results

def add_alternatives(results):
    for pandal in results:
        if pandal['risk'] != 'Red':
            pandal['alternatives'] = []
            continue
        safe = [other for other in results if other['risk'] == 'Green' and other['name'] != pandal['name']]
        safe.sort(key=lambda other: haversine(pandal['lat'], pandal['lon'], other['lat'], other['lon']))
        pandal['alternatives'] = [
            {'name': other['name'], 'distance': round(haversine(pandal['lat'], pandal['lon'], other['lat'], other['lon']), 2)}
            for other in safe[:2]
        ]
    return results

def build_live_response(hour, weather):
    results = add_alternatives(build_predictions(hour, weather))
    for result in results:
        density_by_risk = {'Green': 20.0, 'Yellow': 55.0, 'Red': 85.0}
        density = min(100.0, density_by_risk[result['risk']] + max(0, result['popularity'] - 6) * 1.5)
        result['coordinates'] = [result['lon'], result['lat']]
        result['current_density_percentage'] = round(density, 1)
        result['risk_level'] = {'Green': 'SAFE', 'Yellow': 'MODERATE', 'Red': 'CRITICAL'}[result['risk']]
        result['estimated_wait_minutes'] = int(round(5 + density * 0.45))
    return {'pandals': results, 'stats': {
        'green': sum(r['risk'] == 'Green' for r in results),
        'yellow': sum(r['risk'] == 'Yellow' for r in results),
        'red': sum(r['risk'] == 'Red' for r in results),
    }}

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = np.sin(dlat/2)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon/2)**2
    return R * 2 * np.arcsin(np.sqrt(a))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['GET'])
def predict():
    hour = request.args.get('hour', pd.Timestamp.now().hour, type=int)
    weather = request.args.get('weather', 'Clear')
    results = add_alternatives(build_predictions(hour, weather))

    # stats
    green = sum(1 for r in results if r['risk'] == 'Green')
    yellow = sum(1 for r in results if r['risk'] == 'Yellow')
    red = sum(1 for r in results if r['risk'] == 'Red')

    return jsonify({'pandals': results, 'stats': {'green': green, 'yellow': yellow, 'red': red}})

@app.route('/api/predict', methods=['GET', 'POST'])
def api_predict():
    payload = request.get_json(silent=True) or {}
    hour = payload.get('hour', request.args.get('hour', pd.Timestamp.now().hour, type=int))
    weather = payload.get('weather', request.args.get('weather', 'Clear'))
    results = add_alternatives(build_predictions(hour, weather))
    return jsonify({'pandals': results, 'stats': {
        'green': sum(r['risk'] == 'Green' for r in results),
        'yellow': sum(r['risk'] == 'Yellow' for r in results),
        'red': sum(r['risk'] == 'Red' for r in results),
    }})

@app.route('/api/pandals/live', methods=['GET'])
def api_live_pandals():
    try:
        hour = request.args.get('hour', pd.Timestamp.now().hour, type=int)
        weather = request.args.get('weather', 'Clear')
        return jsonify(build_live_response(hour, weather))
    except Exception:
        logger.exception('Live pandal prediction failed')
        return jsonify({
            'error': 'Live pandal prediction failed',
            'message': 'The monitoring data is temporarily unavailable. Please retry shortly.'
        }), 500

@app.route('/api/model-info', methods=['GET'])
def api_model_info():
    return jsonify({
        'accuracy': model_metrics['accuracy'],
        'feature_importances': model_metrics['feature_importances'],
        'total_records': model_metrics['total_records'],
        'total_pandals': len(le_pandal.classes_),
        'classes': list(le_pandal.classes_),
    })

@app.route('/api/recommend-alternatives', methods=['GET'])
def api_recommend_alternatives():
    name = request.args.get('pandal_name', '')
    hour = request.args.get('hour', pd.Timestamp.now().hour, type=int)
    weather = request.args.get('weather', 'Clear')
    current = next((p for p in pandals if p['name'] == name), None)
    if current is None:
        return jsonify({'error': 'Unknown pandal', 'alternatives': []}), 404
    results = build_predictions(hour, weather)
    current_risk = next(r['risk'] for r in results if r['name'] == name)
    alternatives = []
    for result in results:
        if result['name'] == name or result['risk'] == 'Red':
            continue
        alternatives.append({
            'name': result['name'], 'risk': result['risk'],
            'distance': round(haversine(current['lat'], current['lon'], result['lat'], result['lon']), 2),
        })
    alternatives.sort(key=lambda item: (item['risk'] != 'Green', item['distance']))
    return jsonify({'pandal_name': name, 'risk': current_risk, 'alternatives': alternatives[:5]})

if __name__ == '__main__':
    app.run(debug=True)
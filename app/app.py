from flask import Flask, render_template, jsonify, request
import joblib
import pandas as pd
import numpy as np
import os

app = Flask(__name__)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model = joblib.load(os.path.join(BASE, 'model', 'durgotsavai_model.pkl'))
le_weather = joblib.load(os.path.join(BASE, 'model', 'le_weather.pkl'))
le_pandal = joblib.load(os.path.join(BASE, 'model', 'le_pandal.pkl'))

pandals = [
    {'name': 'Bagbazar Sarbojanin',      'lat': 22.5958, 'lon': 88.3697, 'popularity': 9},
    {'name': 'College Square',           'lat': 22.5790, 'lon': 88.3630, 'popularity': 9},
    {'name': 'Deshapriya Park',          'lat': 22.5263, 'lon': 88.3642, 'popularity': 8},
    {'name': 'Kumartuli Park',           'lat': 22.5950, 'lon': 88.3580, 'popularity': 7},
    {'name': 'Suruchi Sangha',           'lat': 22.5180, 'lon': 88.3470, 'popularity': 8},
    {'name': 'Sreebhumi Sporting Club',  'lat': 22.5780, 'lon': 88.4210, 'popularity': 9},
    {'name': 'Ekdalia Evergreen',        'lat': 22.5220, 'lon': 88.3560, 'popularity': 7},
    {'name': 'Tridhara Sammilani',       'lat': 22.5150, 'lon': 88.3620, 'popularity': 6},
    {'name': 'Badamtala Ashar Sangha',   'lat': 22.5350, 'lon': 88.3450, 'popularity': 7},
    {'name': 'Naktala Udayan Sangha',    'lat': 22.4890, 'lon': 88.3720, 'popularity': 6},
    {'name': 'Bosepukur Sitala Mandir',  'lat': 22.5050, 'lon': 88.3900, 'popularity': 6},
    {'name': 'Dum Dum Park Tarun Dal',   'lat': 22.6150, 'lon': 88.3980, 'popularity': 7},
    {'name': 'Santosh Mitra Square',     'lat': 22.5710, 'lon': 88.3560, 'popularity': 8},
    {'name': 'Mohammad Ali Park',        'lat': 22.5750, 'lon': 88.3510, 'popularity': 8},
    {'name': 'Jodhpur Park',             'lat': 22.5100, 'lon': 88.3690, 'popularity': 6},
]

def predict_risk(pandal_name, popularity, hour, weather):
    try:
        weather_enc = le_weather.transform([weather])[0]
        pandal_enc = le_pandal.transform([pandal_name])[0]
        features = np.array([[hour, popularity, weather_enc, pandal_enc]])
        return model.predict(features)[0]
    except:
        return 'Green'

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

    results = []
    for pandal in pandals:
        risk = predict_risk(pandal['name'], pandal['popularity'], hour, weather)
        
        # forecast next 6 hours
        forecast = []
        for h in range(hour, hour + 6):
            forecast.append({
                'hour': h % 24,
                'risk': predict_risk(pandal['name'], pandal['popularity'], h % 24, weather)
            })

        results.append({
            'name': pandal['name'],
            'lat': pandal['lat'],
            'lon': pandal['lon'],
            'popularity': pandal['popularity'],
            'risk': risk,
            'hour': hour,
            'weather': weather,
            'forecast': forecast
        })

    # find safe alternatives for red pandals
    for i, pandal in enumerate(results):
        if pandal['risk'] == 'Red':
            distances = []
            for j, other in enumerate(results):
                if i != j and other['risk'] == 'Green':
                    dist = haversine(pandal['lat'], pandal['lon'], other['lat'], other['lon'])
                    distances.append({'name': other['name'], 'distance': round(dist, 2)})
            distances.sort(key=lambda x: x['distance'])
            pandal['alternatives'] = distances[:2]
        else:
            pandal['alternatives'] = []

    # stats
    green = sum(1 for r in results if r['risk'] == 'Green')
    yellow = sum(1 for r in results if r['risk'] == 'Yellow')
    red = sum(1 for r in results if r['risk'] == 'Red')

    return jsonify({'pandals': results, 'stats': {'green': green, 'yellow': yellow, 'red': red}})

if __name__ == '__main__':
    app.run(debug=True)
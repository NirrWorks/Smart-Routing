from flask import Flask, render_template, jsonify, request
import json
import os
import requests
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

# Load GeoJSON data
def load_geojson():
    geojson_path = os.path.join(app.root_path, 'data', 'hotspots.geojson')
    with open(geojson_path, 'r') as f:
        return json.load(f)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/features')
def features():
    return render_template('features.html', 
                        default_lat=app.config['DEFAULT_LAT'],
                        default_lon=app.config['DEFAULT_LON'],
                        default_zoom=app.config['DEFAULT_ZOOM'],
                        geoserver_url=app.config['GEOSERVER_URL'])

@app.route('/api/geoserver-layers')
def get_geoserver_layers():
    """Endpoint to get available GeoServer layers"""
    try:
        # You might want to make this dynamic by actually querying GeoServer's REST API
        layers = {
            'Municipal_boundary': 'demo:Municipal_boundary',
            'NepalLocalUnits0': 'demo:NepalLocalUnits0',
            'Road': 'demo:Road',
            'Settlements': 'demo:Settlements',
            'Ward_boundary': 'demo:Ward_boundary',
            'nepal': 'demo:nepal'
        }
        return jsonify(layers)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/documentation')
def documentation():
    return render_template('documentation.html')

@app.route('/api/hotspots')
def get_hotspots():
    try:
        geojson_data = load_geojson()
        return jsonify(geojson_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/route')
def get_route():
    try:
        start = request.args.get('start')
        end = request.args.get('end')
        
        url = f"{app.config['OSRM_API_URL']}/driving/{start};{end}"
        response = requests.get(url)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/landmarks')
def get_landmarks():
    try:
        bounds = request.args.get('bounds')
        query = f"""
        [out:json];
        (
        node["tourism"="attraction"]({bounds});
        way["tourism"="attraction"]({bounds});
        );
        out body;
        >;
        out skel qt;
        """
        response = requests.post(app.config['OVERPASS_API_URL'], data=query)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
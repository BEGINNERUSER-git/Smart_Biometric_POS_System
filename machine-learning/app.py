
from flask import Flask,request,jsonify
import joblib
import numpy as np

app=Flask(__name__)

scaler=joblib.load("scaler.pkl")
scaler_col=joblib.load("scaler_columns.pkl")
iso_model=joblib.load("isolation_forest.pkl")
xgb_model=joblib.load("xgb_fraud.pkl")

feature_cols=[
    "amount",
    "time_diff",
    "tx_count_24h",
    "distance_km",
    "city_pop",
    "location_change",
    "device_change",
    "hour",
    "day_of_week",
    "is_weekend"
]

@app.route("/predict",methods=["POST"])
def predict():
    try:
        data=request.json
        features=np.array([data[col] for col in feature_cols]).reshape(1, -1)
        scaled=features.copy()
        scaled[:,:len(scaler_col)]=scaler.transform(scaled[:, :len(scaler_col)])
        iso_pred=iso_model.predict(scaled)
        final_features=np.hstack((scaled, iso_pred.reshape(-1, 1)))
        xgb_pred=xgb_model.predict_proba(final_features)[0][1]
        if xgb_pred > 0.80:
            risk="High"
        elif xgb_pred > 0.50:
            risk="Medium"
        else:
            risk="Low"
        return jsonify({"fraud_score": round(xgb_pred, 4), "risk_label": risk})
    except Exception as e:
        return jsonify({"error": "Invalid input format", "message": str(e)}), 400




@app.route("/")
def home():
    return "Welcome to the Fraud Detection API! Use the /predict endpoint to get fraud scores."

if __name__=="__main__":
    app.run(port=5000, debug=True) 
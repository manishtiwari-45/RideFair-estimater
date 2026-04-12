import pandas as pd
import numpy as np
import pickle
import random
import mysql.connector
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.cluster import KMeans
from sklearn.metrics import r2_score, accuracy_score
from sklearn.model_selection import train_test_split

print("=" * 50)
print("  RideFair — AI Engine Build")
print("=" * 50)

DB_CONFIG = {
    "host":     "localhost",
    "user":     "root",
    "password": "2401",
    "database": "ride_estimator",
}

# ── Generate synthetic ride data ──────────────────────────────────────────────
print("\n📦 Generating 2,000 synthetic ride records...")

data = []
zones = [
    {"lat": 28.54, "lon": 77.33},  # College
    {"lat": 28.58, "lon": 77.38},  # Mall
    {"lat": 28.62, "lon": 77.29},  # Metro Station
]

for _ in range(2000):
    zone = random.choice(zones)
    lat  = zone["lat"] + random.uniform(-0.01, 0.01)
    lon  = zone["lon"] + random.uniform(-0.01, 0.01)

    # Trip features
    dist_km    = round(random.uniform(1.0, 15.0), 2)
    hour       = random.randint(6, 22)
    is_weekend = random.choice([0, 1])
    is_peak    = 1 if (8 <= hour <= 10) or (17 <= hour <= 20) else 0

    # Fair price formula
    fair_price = 25 + (dist_km * 12)
    if is_peak:    fair_price *= 1.4
    if is_weekend: fair_price += 20

    # Scam injection (~15 % of rides)
    is_scam    = 0
    price_paid = fair_price
    if random.random() < 0.15:
        is_scam    = 1
        price_paid = fair_price * random.uniform(1.8, 3.0)
    else:
        price_paid += random.uniform(-10, 10)

    data.append([lat, lon, dist_km, hour, is_weekend, round(price_paid), is_scam])

df = pd.DataFrame(
    data,
    columns=["lat", "lon", "dist_km", "hour", "is_weekend", "price", "is_scam"],
)
df["price_per_km"] = df["price"] / df["dist_km"]

# ── Model 1: Linear Regression (Price Estimator) ──────────────────────────────
print("\n🔵 Training Linear Regression (Price Estimator)...")
X_price = df[["dist_km", "hour", "is_weekend"]]
y_price = df["price"]
X_train_p, X_test_p, y_train_p, y_test_p = train_test_split(X_price, y_price, test_size=0.2, random_state=42)
lin_reg = LinearRegression()
lin_reg.fit(X_train_p, y_train_p)
r2 = r2_score(y_test_p, lin_reg.predict(X_test_p))

# ── Model 2: Logistic Regression (Scam Detector) ─────────────────────────────
print("🔴 Training Logistic Regression (Scam Detector)...")
X_scam = df[["dist_km", "price", "price_per_km"]]
y_scam = df["is_scam"]
X_train_s, X_test_s, y_train_s, y_test_s = train_test_split(X_scam, y_scam, test_size=0.2, random_state=42)
log_reg = LogisticRegression()
log_reg.fit(X_train_s, y_train_s)
acc = accuracy_score(y_test_s, log_reg.predict(X_test_s))

# ── Model 3: K-Means (Hotspot Finder) ────────────────────────────────────────
print("🟢 Training K-Means (Hotspot Finder)...")
X_loc  = df[["lat", "lon"]]
kmeans = KMeans(n_clusters=3, random_state=42, n_init="auto")
kmeans.fit(X_loc)
inertia = kmeans.inertia_

# ── Save models ───────────────────────────────────────────────────────────────
print("\n💾 Saving models to 'all_models.pkl'...")
models_bundle = {
    "price_model":   lin_reg,
    "scam_model":    log_reg,
    "hotspot_model": kmeans,
}
with open("all_models.pkl", "wb") as f:
    pickle.dump(models_bundle, f)

# ── Print score summary ───────────────────────────────────────────────────────
print("\n" + "=" * 50)
print("  Model Performance Summary")
print("=" * 50)
print(f"  Linear Regression  (Price)  →  R² Score  : {r2:.4f}")
print(f"  Logistic Regression (Scam)  →  Accuracy  : {acc * 100:.2f}%")
print(f"  K-Means Clustering (Zones)  →  Inertia   : {inertia:.2f}")
print("=" * 50)

# ── (Optional) Seed MySQL ─────────────────────────────────────────────────────
try:
    print("\n🗄️  Connecting to MySQL to seed data...")
    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    count = 0
    for row in data[:100]:
        sql = """
        INSERT INTO ride_data
        (pickup_loc, distance_km, hour_of_day, is_weekend, price_paid, is_scam)
        VALUES (ST_GeomFromText('POINT(%s %s)', 4326), %s, %s, %s, %s, %s)
        """
        val = (row[1], row[0], row[2], row[3], row[4], row[5], row[6])
        cursor.execute(sql, val)
        count += 1

    conn.commit()
    print(f"✅ Inserted {count} rows into MySQL.")
    cursor.close()
    conn.close()

except Exception as e:
    print(f"⚠️  MySQL skipped: {e}")
    print("   (Models are still saved — this step is optional)\n")

print("\n✅ All done! Run: uvicorn main:app --reload\n")
